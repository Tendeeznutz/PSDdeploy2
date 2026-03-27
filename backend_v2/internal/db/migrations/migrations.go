// Package migrations exposes the three SQL migration files as Go strings.
// The //go:embed directives work here because the .sql files are in the same
// directory as this file — no path traversal.
package migrations

import _ "embed"

//go:embed 001_initial_schema.sql
var Schema001 string

//go:embed 002_blockchain.sql
var Schema002 string

//go:embed 003_audit_logs.sql
var Schema003 string
