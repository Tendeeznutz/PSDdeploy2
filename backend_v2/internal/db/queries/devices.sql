-- name: GetDevice :one
SELECT * FROM customer_aircon_devices WHERE id = $1 LIMIT 1;

-- name: ListDevicesByCustomer :many
SELECT * FROM customer_aircon_devices WHERE "customerId" = $1 ORDER BY created_at DESC;

-- name: ListAllDevices :many
SELECT * FROM customer_aircon_devices ORDER BY created_at DESC;

-- name: CreateDevice :one
INSERT INTO customer_aircon_devices (
    "customerId","airconName","numberOfUnits","airconType","lastServiceMonth","remarks"
) VALUES ($1,$2,$3,$4,$5,$6)
RETURNING *;

-- name: UpdateDevice :one
UPDATE customer_aircon_devices SET
    "airconName"       = COALESCE(sqlc.narg('airconName'),       "airconName"),
    "numberOfUnits"    = COALESCE(sqlc.narg('numberOfUnits'),    "numberOfUnits"),
    "airconType"       = COALESCE(sqlc.narg('airconType'),       "airconType"),
    "lastServiceMonth" = COALESCE(sqlc.narg('lastServiceMonth'), "lastServiceMonth"),
    remarks            = COALESCE(sqlc.narg('remarks'),          remarks),
    updated_at         = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteDevice :exec
DELETE FROM customer_aircon_devices WHERE id = $1;
