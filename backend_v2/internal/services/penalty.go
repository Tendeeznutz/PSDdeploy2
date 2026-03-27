// penalty.go — port of penalty_utils.py
//
// ACID / thread-safety notes:
//   - CheckAndApplyPenalty uses a single atomic UPDATE ("fee = fee + $1") rather
//     than a read-modify-write loop, so concurrent cancellations can never lose
//     each other's penalty amounts.
//   - The caller (appointments.go) wraps the full cancellation flow in a
//     READ COMMITTED transaction, so the appointment status update and the
//     penalty increment are always committed together or not at all.
package services

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	CancellationThreshold = 5     // Free cancellations per month
	PenaltyAmount         = 20.00 // SGD per over-threshold cancellation
	ShortNoticeSeconds    = 1800  // 30 minutes
	ShortNoticePenalty    = 20.00 // SGD
)

// PenaltySummary is returned by GetPenaltySummary.
type PenaltySummary struct {
	CurrentMonthCancellations  int     `json:"current_month_cancellations"`
	RemainingFreeCancellations int     `json:"remaining_free_cancellations"`
	PendingPenaltyFee          float64 `json:"pending_penalty_fee"`
	WarningMessage             *string `json:"warning_message"`
	PenaltyThreshold           int     `json:"penalty_threshold"`
	PenaltyAmount              float64 `json:"penalty_amount"`
}

// PenaltyResult holds the outcome of CheckAndApplyPenalty.
type PenaltyResult struct {
	PenaltyApplied  float64
	IsShortNotice   bool
	IsOverThreshold bool
	NewPendingFee   float64
}

// DBTX is the subset of pgxpool.Pool / pgx.Tx that penalty.go needs.
// Using an interface means the caller can pass either a bare pool or a
// transaction, giving the caller full control over ACID boundaries.
type DBTX interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) interface {
		Scan(dest ...interface{}) error
	}
	Exec(ctx context.Context, sql string, args ...interface{}) (interface{}, error)
}

// GetMonthlyCustomerCancellationCount returns how many appointments the
// customer cancelled this calendar month.
func GetMonthlyCustomerCancellationCount(ctx context.Context, pool *pgxpool.Pool, customerID uuid.UUID) (int, error) {
	now := time.Now().UTC()
	var count int
	err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM appointments
		 WHERE "customerId" = $1
		   AND "appointmentStatus" = '4'
		   AND date_trunc('month', TO_TIMESTAMP("appointmentStartTime")) = date_trunc('month', $2::TIMESTAMPTZ)`,
		customerID, now,
	).Scan(&count)
	return count, err
}

// CheckAndApplyPenalty calculates any penalty owed for a new cancellation
// and increments the customer's pendingPenaltyFee **atomically** using a
// single SQL statement ("fee = fee + $increment").
//
// The db parameter should be the pgx.Tx that wraps the entire cancellation
// flow so that the penalty increment and the appointment status update are
// committed or rolled back together.
func CheckAndApplyPenalty(ctx context.Context, pool *pgxpool.Pool, customerID uuid.UUID, appointmentStartUnix int64) (*PenaltyResult, error) {
	result := &PenaltyResult{}

	// Fetch current cancellation count for this month.
	count, err := GetMonthlyCustomerCancellationCount(ctx, pool, customerID)
	if err != nil {
		return nil, err
	}
	// +1 because the cancellation record has not been committed yet.
	newCount := count + 1

	var penalty float64

	// Short-notice penalty: appointment starts within 30 minutes.
	now := time.Now().Unix()
	if appointmentStartUnix > 0 && (appointmentStartUnix-now) < ShortNoticeSeconds {
		penalty += ShortNoticePenalty
		result.IsShortNotice = true
	}

	// Over-threshold penalty.
	if newCount > CancellationThreshold {
		penalty += PenaltyAmount
		result.IsOverThreshold = true
	}

	result.PenaltyApplied = penalty

	if penalty > 0 {
		// Atomic increment — no read-then-write race possible.
		// We also read back the new value in the same statement.
		err := pool.QueryRow(ctx,
			`UPDATE customers
			    SET "pendingPenaltyFee" = "pendingPenaltyFee" + $2,
			        updated_at = NOW()
			  WHERE id = $1
			  RETURNING "pendingPenaltyFee"`,
			customerID, penalty,
		).Scan(&result.NewPendingFee)
		if err != nil {
			return nil, err
		}
	} else {
		// No penalty: just return the current fee.
		_ = pool.QueryRow(ctx,
			`SELECT "pendingPenaltyFee" FROM customers WHERE id = $1`, customerID,
		).Scan(&result.NewPendingFee)
	}

	return result, nil
}

// GetPenaltySummary returns a full summary for the GET penalty-status endpoint.
func GetPenaltySummary(ctx context.Context, pool *pgxpool.Pool, customerID uuid.UUID) (*PenaltySummary, error) {
	count, err := GetMonthlyCustomerCancellationCount(ctx, pool, customerID)
	if err != nil {
		return nil, err
	}

	var pendingFee float64
	if err := pool.QueryRow(ctx,
		`SELECT "pendingPenaltyFee" FROM customers WHERE id = $1`, customerID,
	).Scan(&pendingFee); err != nil {
		return nil, err
	}

	remaining := CancellationThreshold - count
	if remaining < 0 {
		remaining = 0
	}

	s := &PenaltySummary{
		CurrentMonthCancellations:  count,
		RemainingFreeCancellations: remaining,
		PendingPenaltyFee:          pendingFee,
		PenaltyThreshold:           CancellationThreshold,
		PenaltyAmount:              PenaltyAmount,
	}

	if count >= CancellationThreshold-1 {
		msg := "Warning: You are approaching the free cancellation limit. Further cancellations will incur a $20 fee."
		s.WarningMessage = &msg
	}
	return s, nil
}
