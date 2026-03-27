-- name: GetAvailability :one
SELECT * FROM technician_availability WHERE id = $1 LIMIT 1;

-- name: ListAvailabilityByTechnician :many
SELECT * FROM technician_availability
WHERE "technicianId" = $1
ORDER BY "dayOfWeek", "specificDate";

-- name: ListWeeklyAvailabilityByTechnician :many
SELECT * FROM technician_availability
WHERE "technicianId" = $1 AND "specificDate" IS NULL AND "isAvailable" = TRUE
ORDER BY "dayOfWeek";

-- name: GetAvailabilityByTechnicianAndDay :one
SELECT * FROM technician_availability
WHERE "technicianId" = $1 AND "dayOfWeek" = $2 AND "specificDate" IS NULL
LIMIT 1;

-- name: GetAvailabilityByTechnicianAndDate :one
SELECT * FROM technician_availability
WHERE "technicianId" = $1 AND "specificDate" = $2
LIMIT 1;

-- name: CountWorkingDaysByTechnician :one
SELECT COUNT(*) FROM technician_availability
WHERE "technicianId" = $1 AND "specificDate" IS NULL AND "isAvailable" = TRUE;

-- name: CreateAvailability :one
INSERT INTO technician_availability ("technicianId","dayOfWeek","startTime","endTime","specificDate","isAvailable")
VALUES ($1,$2,$3,$4,$5,$6)
RETURNING *;

-- name: UpdateAvailability :one
UPDATE technician_availability SET
    "startTime"   = COALESCE(sqlc.narg('startTime'),   "startTime"),
    "endTime"     = COALESCE(sqlc.narg('endTime'),     "endTime"),
    "isAvailable" = COALESCE(sqlc.narg('isAvailable'), "isAvailable"),
    updated_at    = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteAvailability :exec
DELETE FROM technician_availability WHERE id = $1;
