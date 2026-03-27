-- name: CreatePasswordResetToken :one
INSERT INTO technician_password_reset_tokens (technician_id, token, "expiresAt")
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetPasswordResetToken :one
SELECT * FROM technician_password_reset_tokens WHERE token = $1 LIMIT 1;

-- name: MarkPasswordResetTokenUsed :exec
UPDATE technician_password_reset_tokens SET "isUsed" = TRUE, updated_at = NOW()
WHERE token = $1;

-- name: InvalidateExistingPasswordResetTokens :exec
UPDATE technician_password_reset_tokens SET "isUsed" = TRUE, updated_at = NOW()
WHERE technician_id = $1 AND "isUsed" = FALSE;
