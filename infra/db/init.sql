-- init.sql
-- Run once when the PostgreSQL container is first created.
-- The Go backend applies schema migrations at startup via runMigrations(),
-- so this file only needs to ensure the pgcrypto extension is available.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
