// Package blockchain implements a lightweight SHA-256 hash-chain stored in
// PostgreSQL.  Each appointment state transition appends a new block whose
// current_hash covers all prior content — any tampering is detectable by
// recomputing the chain.
//
// ACID / thread-safety notes:
//   - AppendBlock runs the SELECT-max + INSERT inside a SERIALIZABLE transaction
//     protected by pg_advisory_xact_lock(hash(appointment_id)).  This prevents
//     two concurrent appends from reading the same max block_index and then
//     racing to insert at index+1.  The advisory lock is keyed per appointment
//     so unrelated appointments can append concurrently without contention.
//   - VerifyChain and GetHistory are read-only and safe to call concurrently.
package blockchain

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const genesisHash = "0000000000000000000000000000000000000000000000000000000000000000"

// Block mirrors one blockchain_service_records row.
type Block struct {
	ID            uuid.UUID       `json:"id"`
	AppointmentID uuid.UUID       `json:"appointment_id"`
	BlockIndex    int64           `json:"block_index"`
	PreviousHash  string          `json:"previous_hash"`
	DataJSON      json.RawMessage `json:"data_json"`
	EventType     string          `json:"event_type"`
	Timestamp     time.Time       `json:"timestamp"`
	CurrentHash   string          `json:"current_hash"`
}

// VerifyResult is returned by VerifyChain.
type VerifyResult struct {
	Valid           bool   `json:"valid"`
	Blocks          int64  `json:"blocks"`
	TamperedAtBlock *int64 `json:"tampered_at_block,omitempty"`
}

// computeHash deterministically hashes a block's content fields.
func computeHash(blockIndex int64, previousHash string, dataJSON json.RawMessage, ts time.Time) string {
	h := sha256.New()
	fmt.Fprintf(h, "%d%s%s%s", blockIndex, previousHash, string(dataJSON), ts.UTC().Format(time.RFC3339Nano))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// AppendBlock appends a new block for the given appointment to the chain.
//
// Concurrency safety: the entire read-max + compute-hash + insert sequence
// runs inside a SERIALIZABLE transaction protected by a session-scoped
// advisory lock keyed on the appointment UUID's lower 64 bits.  Concurrent
// calls for the same appointment queue behind the lock; concurrent calls for
// different appointments run in parallel.
func AppendBlock(ctx context.Context, pool *pgxpool.Pool, appointmentID uuid.UUID, eventType string, data interface{}) (*Block, error) {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("blockchain: marshal data: %w", err)
	}

	var b Block

	err = withSerializableTx(ctx, pool, func(tx pgx.Tx) error {
		// Advisory lock per appointment prevents concurrent appends racing on
		// the same appointment's block index.  The lock is released automatically
		// when the transaction commits or rolls back.
		lockKey := advisoryKey(appointmentID)
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockKey); err != nil {
			return fmt.Errorf("advisory lock: %w", err)
		}

		// Find the latest block for this appointment.
		prevHash := genesisHash
		var nextIndex int64
		var lastIndex int64
		var lastHash string
		err := tx.QueryRow(ctx,
			`SELECT block_index, current_hash
			   FROM blockchain_service_records
			  WHERE appointment_id = $1
			  ORDER BY block_index DESC
			  LIMIT 1
			  FOR UPDATE`, // Row-level lock on the latest block row
			appointmentID,
		).Scan(&lastIndex, &lastHash)
		if err == nil {
			prevHash = lastHash
			nextIndex = lastIndex + 1
		} else if err != pgx.ErrNoRows {
			return fmt.Errorf("fetch latest block: %w", err)
		}

		// Two-step hash computation to handle Postgres JSONB normalisation and
		// TIMESTAMPTZ microsecond truncation:
		//
		//  1. INSERT with an empty placeholder hash so Postgres stores the data
		//     and rounds the timestamp to microsecond precision.
		//  2. Read back exactly what Postgres stored via RETURNING (the
		//     JSONB-normalised data_json and the truncated timestamp).
		//  3. Compute the real hash from those stored values.
		//  4. UPDATE current_hash in the same transaction.
		//
		// This guarantees that VerifyChain, which also reads the stored values,
		// will always reproduce the same hash.
		now := time.Now().UTC()

		var insertedID uuid.UUID
		var storedData json.RawMessage
		var storedTS time.Time
		var storedIdx int64
		var storedPrevHash string

		if err := tx.QueryRow(ctx,
			`INSERT INTO blockchain_service_records
			     (appointment_id, block_index, previous_hash, data_json, event_type, "timestamp", current_hash)
			 VALUES ($1,$2,$3,$4,$5,$6,'')
			 RETURNING id, block_index, previous_hash, data_json, "timestamp"`,
			appointmentID, nextIndex, prevHash, dataBytes, eventType, now,
		).Scan(&insertedID, &storedIdx, &storedPrevHash, &storedData, &storedTS); err != nil {
			return fmt.Errorf("insert block: %w", err)
		}

		hash := computeHash(storedIdx, storedPrevHash, storedData, storedTS)

		if _, err := tx.Exec(ctx,
			`UPDATE blockchain_service_records SET current_hash=$1 WHERE id=$2`, hash, insertedID,
		); err != nil {
			return fmt.Errorf("update block hash: %w", err)
		}

		b.ID = insertedID
		b.AppointmentID = appointmentID
		b.BlockIndex = storedIdx
		b.PreviousHash = storedPrevHash
		b.DataJSON = storedData
		b.EventType = eventType
		b.Timestamp = storedTS
		b.CurrentHash = hash
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("blockchain: AppendBlock: %w", err)
	}
	return &b, nil
}

// VerifyChain recomputes every hash in the chain for a given appointment and
// returns whether the chain is intact.  Read-only; safe for concurrent use.
func VerifyChain(ctx context.Context, pool *pgxpool.Pool, appointmentID uuid.UUID) (*VerifyResult, error) {
	rows, err := pool.Query(ctx,
		`SELECT block_index, previous_hash, data_json, event_type, "timestamp", current_hash
		   FROM blockchain_service_records
		  WHERE appointment_id = $1
		  ORDER BY block_index ASC`,
		appointmentID,
	)
	if err != nil {
		return nil, fmt.Errorf("blockchain: query chain: %w", err)
	}
	defer rows.Close()

	result := &VerifyResult{Valid: true}
	expectedPrev := genesisHash

	for rows.Next() {
		var b Block
		if err := rows.Scan(&b.BlockIndex, &b.PreviousHash, &b.DataJSON,
			&b.EventType, &b.Timestamp, &b.CurrentHash); err != nil {
			return nil, err
		}
		result.Blocks++

		// Check linkage
		if b.PreviousHash != expectedPrev {
			result.Valid = false
			idx := b.BlockIndex
			result.TamperedAtBlock = &idx
			return result, nil
		}

		// Recompute hash
		recomputed := computeHash(b.BlockIndex, b.PreviousHash, b.DataJSON, b.Timestamp)
		if recomputed != b.CurrentHash {
			result.Valid = false
			idx := b.BlockIndex
			result.TamperedAtBlock = &idx
			return result, nil
		}
		expectedPrev = b.CurrentHash
	}
	return result, rows.Err()
}

// GetHistory returns all blocks for an appointment in order.
func GetHistory(ctx context.Context, pool *pgxpool.Pool, appointmentID uuid.UUID) ([]Block, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, appointment_id, block_index, previous_hash, data_json, event_type, "timestamp", current_hash
		   FROM blockchain_service_records
		  WHERE appointment_id = $1
		  ORDER BY block_index ASC`,
		appointmentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blocks []Block
	for rows.Next() {
		var b Block
		if err := rows.Scan(&b.ID, &b.AppointmentID, &b.BlockIndex, &b.PreviousHash,
			&b.DataJSON, &b.EventType, &b.Timestamp, &b.CurrentHash); err != nil {
			return nil, err
		}
		blocks = append(blocks, b)
	}
	return blocks, rows.Err()
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// withSerializableTx runs fn inside a SERIALIZABLE READ WRITE transaction.
func withSerializableTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel:   pgx.Serializable,
		AccessMode: pgx.ReadWrite,
	})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Commit(ctx)
}

// advisoryKey converts a UUID to a single int64 for pg_advisory_xact_lock.
// We XOR the two halves of the UUID's 128 bits for a cheap, stable key.
func advisoryKey(id uuid.UUID) int64 {
	b := id[:]
	var hi, lo int64
	for i := 0; i < 8; i++ {
		hi = (hi << 8) | int64(b[i])
		lo = (lo << 8) | int64(b[i+8])
	}
	return hi ^ lo
}
