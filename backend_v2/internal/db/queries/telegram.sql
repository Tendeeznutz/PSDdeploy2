-- name: CreateTelegramLinkToken :one
INSERT INTO telegram_link_tokens (token, "userType", "userId", "expiresAt")
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetTelegramLinkToken :one
SELECT * FROM telegram_link_tokens WHERE token = $1 LIMIT 1;

-- name: MarkTelegramLinkTokenUsed :exec
UPDATE telegram_link_tokens SET "isUsed" = TRUE, updated_at = NOW()
WHERE token = $1;
