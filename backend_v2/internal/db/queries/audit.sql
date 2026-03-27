-- name: CreateAuditLog :one
INSERT INTO audit_logs
    (actor_type, actor_id, action, resource_type, resource_id, before_json, after_json, ip_address)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
RETURNING *;

-- name: ListAuditLogsByActor :many
SELECT * FROM audit_logs
WHERE actor_id = $1 AND actor_type = $2
ORDER BY created_at DESC;

-- name: ListAuditLogsByResource :many
SELECT * FROM audit_logs
WHERE resource_type = $1 AND resource_id = $2
ORDER BY created_at DESC;
