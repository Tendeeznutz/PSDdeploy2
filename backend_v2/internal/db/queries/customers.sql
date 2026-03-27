-- name: GetCustomer :one
SELECT * FROM customers WHERE id = $1 LIMIT 1;

-- name: GetCustomerByEmail :one
SELECT * FROM customers WHERE "customerEmail" = $1 LIMIT 1;

-- name: GetCustomerByPhone :one
SELECT * FROM customers WHERE "customerPhone" = $1 LIMIT 1;

-- name: ListCustomers :many
SELECT * FROM customers ORDER BY created_at DESC;

-- name: ListCustomersByEmail :many
SELECT * FROM customers WHERE "customerEmail" ILIKE $1 ORDER BY created_at DESC;

-- name: ListCustomersByName :many
SELECT * FROM customers WHERE "customerName" ILIKE $1 ORDER BY created_at DESC;

-- name: ListCustomersByPhone :many
SELECT * FROM customers WHERE "customerPhone" = $1 ORDER BY created_at DESC;

-- name: ListCustomersByPostalCode :many
SELECT * FROM customers WHERE "customerPostalCode" = $1 ORDER BY created_at DESC;

-- name: CreateCustomer :one
INSERT INTO customers (
    "customerName", "customerPostalCode", "customerLocation",
    "customerAddress", "customerPhone", "customerPassword", "customerEmail"
) VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING *;

-- name: UpdateCustomer :one
UPDATE customers SET
    "customerName"       = COALESCE(sqlc.narg('customerName'),       "customerName"),
    "customerPhone"      = COALESCE(sqlc.narg('customerPhone'),      "customerPhone"),
    "customerEmail"      = COALESCE(sqlc.narg('customerEmail'),      "customerEmail"),
    "customerPassword"   = COALESCE(sqlc.narg('customerPassword'),   "customerPassword"),
    "customerAddress"    = COALESCE(sqlc.narg('customerAddress'),    "customerAddress"),
    "customerPostalCode" = COALESCE(sqlc.narg('customerPostalCode'), "customerPostalCode"),
    "customerLocation"   = COALESCE(sqlc.narg('customerLocation'),   "customerLocation"),
    "telegramChatId"     = COALESCE(sqlc.narg('telegramChatId'),     "telegramChatId"),
    updated_at           = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateCustomerRating :one
UPDATE customers SET
    "customerRating" = $2,
    "ratingCount"    = $3,
    updated_at       = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateCustomerPenalty :one
UPDATE customers SET
    "pendingPenaltyFee" = $2,
    updated_at          = NOW()
WHERE id = $1
RETURNING *;

-- name: UnlinkCustomerTelegram :exec
UPDATE customers SET "telegramChatId" = NULL, updated_at = NOW() WHERE id = $1;

-- name: GetCustomerByTelegramChatId :one
SELECT * FROM customers WHERE "telegramChatId" = $1 LIMIT 1;
