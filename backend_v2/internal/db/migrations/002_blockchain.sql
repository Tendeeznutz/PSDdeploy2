-- 002_blockchain.sql
-- Tamper-evident SHA-256 hash-chain for service history.
-- The app user has INSERT-only on this table (no UPDATE/DELETE).

CREATE TABLE IF NOT EXISTS blockchain_service_records (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID         NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    block_index     BIGINT       NOT NULL,
    previous_hash   CHAR(64)     NOT NULL,
    data_json       JSONB        NOT NULL,
    event_type      VARCHAR(20)  NOT NULL,  -- created|confirmed|completed|cancelled|rated
    "timestamp"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    current_hash    CHAR(64)     NOT NULL,
    UNIQUE (appointment_id, block_index)
);

CREATE INDEX IF NOT EXISTS idx_chain_appointment ON blockchain_service_records (appointment_id, block_index);
