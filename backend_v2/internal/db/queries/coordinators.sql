-- name: GetCoordinator :one
SELECT * FROM coordinators WHERE id = $1 LIMIT 1;

-- name: GetCoordinatorByEmail :one
SELECT * FROM coordinators WHERE "coordinatorEmail" = $1 LIMIT 1;

-- name: GetFirstCoordinator :one
SELECT * FROM coordinators ORDER BY created_at LIMIT 1;

-- name: ListCoordinators :many
SELECT * FROM coordinators ORDER BY created_at DESC;

-- name: CreateCoordinator :one
INSERT INTO coordinators ("coordinatorName","coordinatorEmail","coordinatorPhone","coordinatorPassword")
VALUES ($1,$2,$3,$4)
RETURNING *;

-- name: UpdateCoordinator :one
UPDATE coordinators SET
    "coordinatorName"     = COALESCE(sqlc.narg('coordinatorName'),     "coordinatorName"),
    "coordinatorEmail"    = COALESCE(sqlc.narg('coordinatorEmail'),    "coordinatorEmail"),
    "coordinatorPhone"    = COALESCE(sqlc.narg('coordinatorPhone'),    "coordinatorPhone"),
    "coordinatorPassword" = COALESCE(sqlc.narg('coordinatorPassword'), "coordinatorPassword"),
    updated_at            = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteCoordinator :exec
DELETE FROM coordinators WHERE id = $1;
