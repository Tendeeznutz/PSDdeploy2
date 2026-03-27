-- name: GetCatalogEntry :one
SELECT * FROM aircon_catalogs WHERE id = $1 LIMIT 1;

-- name: GetCatalogEntryByBrandModel :one
SELECT * FROM aircon_catalogs WHERE "airconBrand" = $1 AND "airconModel" = $2 LIMIT 1;

-- name: ListCatalog :many
SELECT * FROM aircon_catalogs ORDER BY "airconBrand","airconModel";

-- name: ListCatalogByBrand :many
SELECT * FROM aircon_catalogs WHERE "airconBrand" ILIKE $1 ORDER BY "airconModel";

-- name: ListCatalogByModel :many
SELECT * FROM aircon_catalogs WHERE "airconModel" ILIKE $1 ORDER BY "airconBrand";

-- name: CreateCatalogEntry :one
INSERT INTO aircon_catalogs ("airconBrand","airconModel") VALUES ($1,$2)
RETURNING *;

-- name: UpsertCatalogEntry :one
INSERT INTO aircon_catalogs ("airconBrand","airconModel") VALUES ($1,$2)
ON CONFLICT ("airconBrand","airconModel") DO UPDATE SET updated_at = NOW()
RETURNING *;
