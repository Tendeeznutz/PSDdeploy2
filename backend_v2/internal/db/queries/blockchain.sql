-- name: GetBlockchainRecord :one
SELECT * FROM blockchain_service_records WHERE id = $1 LIMIT 1;

-- name: ListBlockchainByAppointment :many
SELECT * FROM blockchain_service_records
WHERE appointment_id = $1
ORDER BY block_index ASC;

-- name: GetLatestBlockForAppointment :one
SELECT * FROM blockchain_service_records
WHERE appointment_id = $1
ORDER BY block_index DESC
LIMIT 1;

-- name: CountBlocksForAppointment :one
SELECT COUNT(*) FROM blockchain_service_records WHERE appointment_id = $1;

-- name: CreateBlock :one
INSERT INTO blockchain_service_records
    (appointment_id, block_index, previous_hash, data_json, event_type, "timestamp", current_hash)
VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING *;
