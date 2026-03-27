-- 003_audit_logs.sql
-- Immutable record of every mutating request (POST/PATCH/DELETE).

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type      VARCHAR(20),          -- customer|technician|coordinator|system
    actor_id        UUID,
    action          VARCHAR(10) NOT NULL, -- POST|PATCH|DELETE
    resource_type   VARCHAR(50) NOT NULL, -- appointments|customers|...
    resource_id     UUID,
    before_json     JSONB,
    after_json      JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_logs (actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs (created_at DESC);
