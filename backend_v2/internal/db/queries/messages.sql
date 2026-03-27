-- name: GetMessage :one
SELECT * FROM messages WHERE id = $1 LIMIT 1;

-- name: ListMessagesByRecipient :many
SELECT * FROM messages
WHERE "recipientId" = $1 AND "recipientType" = $2
ORDER BY created_at DESC;

-- name: ListMessagesBySender :many
SELECT * FROM messages
WHERE "senderId" = $1 AND "senderType" = $2
ORDER BY created_at DESC;

-- name: ListMessagesByUser :many
SELECT * FROM messages
WHERE ("recipientId" = $1 AND "recipientType" = $2)
   OR ("senderId"    = $1 AND "senderType"    = $2)
ORDER BY created_at DESC;

-- name: ListUnreadByRecipient :many
SELECT * FROM messages
WHERE "recipientId" = $1 AND "recipientType" = $2 AND "isRead" = FALSE
ORDER BY created_at DESC;

-- name: CountUnreadByRecipient :one
SELECT COUNT(*) FROM messages
WHERE "recipientId" = $1 AND "recipientType" = $2 AND "isRead" = FALSE;

-- name: CreateMessage :one
INSERT INTO messages (
    "senderType","senderId","senderName",
    "recipientType","recipientId","recipientName",
    subject,body,"relatedAppointment"
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
RETURNING *;

-- name: MarkMessageRead :one
UPDATE messages SET "isRead" = TRUE, "readAt" = NOW(), updated_at = NOW()
WHERE id = $1
RETURNING *;
