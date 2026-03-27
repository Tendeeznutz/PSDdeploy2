//go:build integration

package integration

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"backend_v2/internal/config"
	"backend_v2/internal/handlers"
	"backend_v2/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	testApp    *fiber.App
	testPool   *pgxpool.Pool
	testValkey *redis.Client
)

func TestMain(m *testing.M) {
	ctx := context.Background()

	// ── Start Postgres container ────────────────────────────────────────────
	pgContainer, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("airserve_test"),
		tcpostgres.WithUsername("airserve"),
		tcpostgres.WithPassword("testpassword"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		log.Fatalf("setup: start postgres container: %v", err)
	}
	defer func() { _ = pgContainer.Terminate(ctx) }()

	pgDSN, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("setup: postgres DSN: %v", err)
	}

	// ── Start Valkey (Redis-compatible) container ───────────────────────────
	valkeyContainer, err := tcredis.Run(ctx, "valkey/valkey:8-alpine")
	if err != nil {
		log.Fatalf("setup: start valkey container: %v", err)
	}
	defer func() { _ = valkeyContainer.Terminate(ctx) }()

	valkeyAddr, err := valkeyContainer.Endpoint(ctx, "")
	if err != nil {
		log.Fatalf("setup: valkey endpoint: %v", err)
	}

	// ── Connect to Postgres ─────────────────────────────────────────────────
	pool, err := pgxpool.New(ctx, pgDSN)
	if err != nil {
		log.Fatalf("setup: connect postgres: %v", err)
	}
	defer pool.Close()
	testPool = pool

	// ── Run migrations ──────────────────────────────────────────────────────
	if err := runTestMigrations(ctx, pool); err != nil {
		log.Fatalf("setup: migrations: %v", err)
	}

	// ── Connect to Valkey ───────────────────────────────────────────────────
	rdb := redis.NewClient(&redis.Options{Addr: valkeyAddr})
	defer rdb.Close()
	testValkey = rdb

	// ── Build Fiber app with test config ───────────────────────────────────
	cfg := &config.Config{
		JWTSecret:             "test-jwt-secret-for-integration",
		TelegramWebhookSecret: "test-webhook-secret",
		FrontendURL:           "http://localhost:3000",
	}

	// Geo stub: always returns Singapore centre for any postal code in tests
	geo := &geoStub{}
	notif := services.NewNotificationService("", 587, "", "", "", "http://localhost:3000")

	testApp = handlers.NewFiberApp(&handlers.App{
		DB:     pool,
		Valkey: rdb,
		Cfg:    cfg,
		Geo:    geo,
		Notif:  notif,
	})

	code := m.Run()
	os.Exit(code)
}

// runTestMigrations applies the three migration SQL files to the test DB.
func runTestMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrations := []string{
		migration001SQL,
		migration002SQL,
		migration003SQL,
	}
	for i, sql := range migrations {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
	}
	return nil
}

// cleanDB truncates all tables and flushes the Valkey rate-limit counters.
// Must be called at the start of every test so rate limits don't bleed between tests.
func cleanDB(t *testing.T) {
	t.Helper()
	ctx := context.Background()

	// Flush all Valkey keys — clears rate-limit sliding-window counters.
	// All tests share a single IP (0.0.0.0) inside Fiber's test transport,
	// so without this flush the login tier fills up after ~5 requests and
	// every subsequent test sees 429.
	if err := testValkey.FlushDB(ctx).Err(); err != nil {
		t.Fatalf("cleanDB: flush valkey: %v", err)
	}

	_, err := testPool.Exec(ctx, `
		TRUNCATE
			blockchain_service_records,
			audit_logs,
			appointment_ratings,
			messages,
			appointments,
			technician_availability,
			technician_hiring_applications,
			technician_password_reset_tokens,
			telegram_link_tokens,
			customer_aircon_devices,
			customers,
			technicians,
			coordinators,
			aircon_catalogs
		RESTART IDENTITY CASCADE
	`)
	if err != nil {
		t.Fatalf("cleanDB: truncate: %v", err)
	}
}

// geoStub returns Singapore centre coordinates for every postal code lookup.
// This makes all scheduling tests work without any OneMap API calls.
type geoStub struct{}

func (g *geoStub) LookupPostal(_ string) string {
	return "1.3521,103.8198"
}

// ─── Embedded migration SQL ───────────────────────────────────────────────────

const migration001SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS aircon_catalogs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "airconBrand" VARCHAR(50)  NOT NULL,
    "airconModel" VARCHAR(50)  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE ("airconBrand", "airconModel")
);

CREATE TABLE IF NOT EXISTS customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerName"       VARCHAR(50)     NOT NULL,
    "customerPostalCode" VARCHAR(6)      NOT NULL,
    "customerLocation"   VARCHAR(32),
    "customerAddress"    VARCHAR(50)     NOT NULL,
    "customerPhone"      VARCHAR(50)     NOT NULL UNIQUE,
    "customerPassword"   VARCHAR(256)    NOT NULL,
    "customerEmail"      VARCHAR(50)     NOT NULL UNIQUE,
    "pendingPenaltyFee"  NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
    "customerRating"     NUMERIC(3,2)    NOT NULL DEFAULT 5.00,
    "ratingCount"        INTEGER         NOT NULL DEFAULT 0,
    "telegramChatId"     BIGINT,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technicians (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "technicianName"          VARCHAR(50)  NOT NULL,
    "technicianPostalCode"    VARCHAR(6)   NOT NULL,
    "technicianAddress"       VARCHAR(50)  NOT NULL,
    "technicianLocation"      VARCHAR(32),
    "technicianPhone"         VARCHAR(50)  NOT NULL UNIQUE,
    "technicianEmail"         VARCHAR(50)  UNIQUE,
    "technicianPassword"      VARCHAR(256) NOT NULL,
    "technicianStatus"        VARCHAR(1)   NOT NULL DEFAULT '1',
    specializations           JSONB        NOT NULL DEFAULT '[]',
    "technicianTravelType"    VARCHAR(20),
    "technicianRating"        NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    "technicianRatingCount"   INTEGER      NOT NULL DEFAULT 0,
    "isActive"                BOOLEAN      NOT NULL DEFAULT TRUE,
    "telegramChatId"          BIGINT,
    "deactivatedAt"           TIMESTAMPTZ,
    "deactivationReason"      TEXT,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coordinators (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "coordinatorName"      VARCHAR(50)  NOT NULL,
    "coordinatorEmail"     VARCHAR(50)  NOT NULL UNIQUE,
    "coordinatorPhone"     VARCHAR(50)  NOT NULL UNIQUE,
    "coordinatorPassword"  VARCHAR(256) NOT NULL,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_aircon_devices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "airconName"       VARCHAR(50),
    "customerId"       UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "numberOfUnits"    INTEGER      NOT NULL DEFAULT 1,
    "airconType"       VARCHAR(20)  NOT NULL DEFAULT 'other',
    "lastServiceMonth" VARCHAR(7),
    remarks            TEXT,
    "airconCatalogId"  UUID         REFERENCES aircon_catalogs(id) ON DELETE SET NULL,
    "lastServiceDate"  BIGINT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE ("customerId", "airconName")
);

CREATE TABLE IF NOT EXISTS appointments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerId"           UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "technicianId"         UUID         REFERENCES technicians(id) ON DELETE CASCADE,
    "appointmentStartTime" BIGINT       NOT NULL,
    "appointmentEndTime"   BIGINT       NOT NULL,
    "airconToService"      JSONB        NOT NULL DEFAULT '[]',
    "customerFeedback"     TEXT,
    "appointmentStatus"    VARCHAR(1)   NOT NULL DEFAULT '1',
    "paymentMethod"        VARCHAR(20)  NOT NULL DEFAULT 'cash',
    "cancellationReason"   TEXT,
    "cancelledBy"          VARCHAR(50),
    "cancelledAt"          TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_appointment_times CHECK ("appointmentEndTime" > "appointmentStartTime")
);

CREATE TABLE IF NOT EXISTS appointment_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    "ratedBy"        VARCHAR(20) NOT NULL,
    rating          INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (appointment_id, "ratedBy")
);

CREATE TABLE IF NOT EXISTS messages (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderType"           VARCHAR(20)  NOT NULL,
    "senderId"             UUID         NOT NULL,
    "senderName"           VARCHAR(50)  NOT NULL,
    "recipientType"        VARCHAR(20)  NOT NULL,
    "recipientId"          UUID         NOT NULL,
    "recipientName"        VARCHAR(50)  NOT NULL,
    subject                VARCHAR(200) NOT NULL,
    body                   TEXT         NOT NULL,
    "isRead"               BOOLEAN      NOT NULL DEFAULT FALSE,
    "readAt"               TIMESTAMPTZ,
    "relatedAppointment"   UUID         REFERENCES appointments(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technician_hiring_applications (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "applicationSource"           VARCHAR(30)    NOT NULL DEFAULT 'coordinator_invited',
    "applicantName"               VARCHAR(100)   NOT NULL DEFAULT '',
    nric                         VARCHAR(9)     UNIQUE,
    citizenship                  VARCHAR(50)    NOT NULL DEFAULT '',
    "applicantAddress"            VARCHAR(200)   NOT NULL DEFAULT '',
    "applicantPostalCode"         VARCHAR(6)     NOT NULL DEFAULT '',
    "applicantPhone"              VARCHAR(8)     NOT NULL DEFAULT '',
    "applicantEmail"              VARCHAR(100)   NOT NULL DEFAULT '',
    "workExperience"              TEXT           NOT NULL DEFAULT '',
    "resumeFile"                  TEXT,
    "resumeFileName"              VARCHAR(255),
    "hasCriminalRecord"           BOOLEAN        NOT NULL DEFAULT FALSE,
    "criminalRecordDetails"       TEXT,
    race                         VARCHAR(50)    NOT NULL DEFAULT '',
    "languagesSpoken"             VARCHAR(200)   NOT NULL DEFAULT '',
    "previousEmployer"            VARCHAR(200),
    "lastEmployedYear"            INTEGER,
    "lastDrawnSalary"             NUMERIC(10,2),
    "nextOfKinName"               VARCHAR(100)   NOT NULL DEFAULT '',
    "nextOfKinContact"            VARCHAR(8)     NOT NULL DEFAULT '',
    "nextOfKinRelationship"       VARCHAR(50)    NOT NULL DEFAULT '',
    "isMedicallyFit"              BOOLEAN        NOT NULL DEFAULT FALSE,
    "medicalFitnessConfirmedAt"   TIMESTAMPTZ,
    "profilePhoto"                TEXT,
    "profilePhotoFileName"        VARCHAR(255),
    "nricPhotoFront"              TEXT,
    "nricPhotoBack"               TEXT,
    "drivingLicense"              TEXT,
    "drivingLicenseFileName"      VARCHAR(255),
    specializations               JSONB          NOT NULL DEFAULT '[]',
    "personalDetailsConfirmed"    BOOLEAN        NOT NULL DEFAULT FALSE,
    "personalDetailsConfirmedAt"  TIMESTAMPTZ,
    "bankName"                    VARCHAR(100),
    "bankAccountNumber"           VARCHAR(50),
    "bankAccountHolderName"       VARCHAR(100),
    "bankInfoConfirmed"           BOOLEAN        NOT NULL DEFAULT FALSE,
    "bankInfoConfirmedAt"         TIMESTAMPTZ,
    "payRate"                     NUMERIC(10,2),
    "coordinatorId"               UUID           REFERENCES coordinators(id) ON DELETE SET NULL,
    "coordinatorNotes"            TEXT,
    "coordinatorApproved"         BOOLEAN        NOT NULL DEFAULT FALSE,
    "coordinatorApprovedAt"       TIMESTAMPTZ,
    "applicationStatus"           VARCHAR(30)    NOT NULL DEFAULT 'personal_details',
    "createdTechnician"           UUID           REFERENCES technicians(id) ON DELETE SET NULL,
    created_at                   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technician_availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "technicianId"   UUID        NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    "dayOfWeek"      VARCHAR(10) NOT NULL,
    "startTime"      VARCHAR(5)  NOT NULL,
    "endTime"        VARCHAR(5)  NOT NULL,
    "specificDate"   DATE,
    "isAvailable"    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technician_password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id   UUID         NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    token           VARCHAR(100) NOT NULL UNIQUE,
    "expiresAt"      TIMESTAMPTZ  NOT NULL,
    "isUsed"         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       VARCHAR(64)  NOT NULL UNIQUE,
    "userType"   VARCHAR(20)  NOT NULL,
    "userId"     UUID         NOT NULL,
    "expiresAt"  TIMESTAMPTZ  NOT NULL,
    "isUsed"     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
`

const migration002SQL = `
CREATE TABLE IF NOT EXISTS blockchain_service_records (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID         NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    block_index     BIGINT       NOT NULL,
    previous_hash   CHAR(64)     NOT NULL,
    data_json       JSONB        NOT NULL,
    event_type      VARCHAR(20)  NOT NULL,
    "timestamp"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    current_hash    CHAR(64)     NOT NULL,
    UNIQUE (appointment_id, block_index)
);
`

const migration003SQL = `
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type      VARCHAR(20),
    actor_id        UUID,
    action          VARCHAR(10) NOT NULL,
    resource_type   VARCHAR(50) NOT NULL,
    resource_id     UUID,
    before_json     JSONB,
    after_json      JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`
