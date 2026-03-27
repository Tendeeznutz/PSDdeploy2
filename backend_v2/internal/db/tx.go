// Package db provides transaction helpers shared across handlers and services.
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is satisfied by both *pgxpool.Pool and pgx.Tx.
// Using this interface everywhere lets handlers pass either a bare pool
// or an in-flight transaction without changing the called code.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

// WithTx begins a serializable transaction, runs fn, and either commits or
// rolls back depending on whether fn returns an error.
//
// Serializable isolation is chosen over ReadCommitted because most of our
// multi-step operations (rating aggregation, penalty accumulation, block
// appending) require snapshot isolation to prevent lost updates.
// For purely additive operations that use atomic SQL (e.g., "SET fee = fee + $1"),
// the isolation level makes no functional difference but never hurts.
func WithTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
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

// WithTxReadCommitted begins a READ COMMITTED transaction.
// Use this for operations that only need atomicity (all-or-nothing) but NOT
// snapshot isolation — e.g., guest booking (3 inserts), hiring approval.
func WithTxReadCommitted(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel:   pgx.ReadCommitted,
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
