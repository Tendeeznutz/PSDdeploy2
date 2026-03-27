-- name: GetTechnician :one
SELECT * FROM technicians WHERE id = $1 LIMIT 1;

-- name: GetTechnicianByPhone :one
SELECT * FROM technicians WHERE "technicianPhone" = $1 LIMIT 1;

-- name: GetTechnicianByEmail :one
SELECT * FROM technicians WHERE "technicianEmail" = $1 LIMIT 1;

-- name: ListTechnicians :many
SELECT * FROM technicians ORDER BY created_at DESC;

-- name: ListActiveTechnicians :many
SELECT * FROM technicians WHERE "isActive" = TRUE ORDER BY created_at DESC;

-- name: ListTechniciansByStatus :many
SELECT * FROM technicians WHERE "technicianStatus" = $1 ORDER BY created_at DESC;

-- name: ListTechniciansByPostalCode :many
SELECT * FROM technicians WHERE "technicianPostalCode" = $1 ORDER BY created_at DESC;

-- name: ListTechniciansByName :many
SELECT * FROM technicians WHERE "technicianName" ILIKE $1 ORDER BY created_at DESC;

-- name: CreateTechnician :one
INSERT INTO technicians (
    "technicianName", "technicianPostalCode", "technicianAddress",
    "technicianLocation", "technicianPhone", "technicianEmail",
    "technicianPassword", "technicianStatus", specializations, "technicianTravelType"
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
RETURNING *;

-- name: UpdateTechnician :one
UPDATE technicians SET
    "technicianName"       = COALESCE(sqlc.narg('technicianName'),       "technicianName"),
    "technicianPhone"      = COALESCE(sqlc.narg('technicianPhone'),      "technicianPhone"),
    "technicianEmail"      = COALESCE(sqlc.narg('technicianEmail'),      "technicianEmail"),
    "technicianPassword"   = COALESCE(sqlc.narg('technicianPassword'),   "technicianPassword"),
    "technicianAddress"    = COALESCE(sqlc.narg('technicianAddress'),    "technicianAddress"),
    "technicianPostalCode" = COALESCE(sqlc.narg('technicianPostalCode'), "technicianPostalCode"),
    "technicianLocation"   = COALESCE(sqlc.narg('technicianLocation'),   "technicianLocation"),
    "technicianStatus"     = COALESCE(sqlc.narg('technicianStatus'),     "technicianStatus"),
    "technicianTravelType" = COALESCE(sqlc.narg('technicianTravelType'), "technicianTravelType"),
    specializations        = COALESCE(sqlc.narg('specializations'),      specializations),
    "telegramChatId"       = COALESCE(sqlc.narg('telegramChatId'),       "telegramChatId"),
    updated_at             = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateTechnicianRating :one
UPDATE technicians SET
    "technicianRating"      = $2,
    "technicianRatingCount" = $3,
    updated_at              = NOW()
WHERE id = $1
RETURNING *;

-- name: ToggleTechnicianActiveStatus :one
UPDATE technicians SET
    "isActive"           = $2,
    "deactivatedAt"      = $3,
    "deactivationReason" = $4,
    updated_at           = NOW()
WHERE id = $1
RETURNING *;

-- name: ToggleTechnicianStatus :one
UPDATE technicians SET
    "technicianStatus" = $2,
    updated_at         = NOW()
WHERE id = $1
RETURNING *;

-- name: UnlinkTechnicianTelegram :exec
UPDATE technicians SET "telegramChatId" = NULL, updated_at = NOW() WHERE id = $1;

-- name: GetTechnicianByTelegramChatId :one
SELECT * FROM technicians WHERE "telegramChatId" = $1 LIMIT 1;
