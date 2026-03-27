-- 001_initial_schema.sql
-- Mirrors all 12 Django models exactly (same column names, same constraints).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── aircon_catalogs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aircon_catalogs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "airconBrand" VARCHAR(50)  NOT NULL,
    "airconModel" VARCHAR(50)  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE ("airconBrand", "airconModel")
);
CREATE INDEX IF NOT EXISTS idx_aircon_catalogs_brand ON aircon_catalogs ("airconBrand");
CREATE INDEX IF NOT EXISTS idx_aircon_catalogs_model ON aircon_catalogs ("airconModel");

-- ─── customers ────────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers ("customerPhone");
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers ("customerEmail");

-- ─── technicians ──────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_technicians_status    ON technicians ("technicianStatus");
CREATE INDEX IF NOT EXISTS idx_technicians_phone     ON technicians ("technicianPhone");
CREATE INDEX IF NOT EXISTS idx_technicians_email     ON technicians ("technicianEmail");
CREATE INDEX IF NOT EXISTS idx_technicians_postal    ON technicians ("technicianPostalCode");
CREATE INDEX IF NOT EXISTS idx_technicians_is_active ON technicians ("isActive");

-- ─── coordinators ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coordinators (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "coordinatorName"      VARCHAR(50)  NOT NULL,
    "coordinatorEmail"     VARCHAR(50)  NOT NULL UNIQUE,
    "coordinatorPhone"     VARCHAR(50)  NOT NULL UNIQUE,
    "coordinatorPassword"  VARCHAR(256) NOT NULL,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coordinators_email ON coordinators ("coordinatorEmail");
CREATE INDEX IF NOT EXISTS idx_coordinators_phone ON coordinators ("coordinatorPhone");

-- ─── customer_aircon_devices ──────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_devices_customer ON customer_aircon_devices ("customerId");
CREATE INDEX IF NOT EXISTS idx_devices_type     ON customer_aircon_devices ("airconType");

-- ─── appointments ─────────────────────────────────────────────────────────────
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

-- ─── appointment_ratings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    "ratedBy"        VARCHAR(20) NOT NULL,
    rating          INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (appointment_id, "ratedBy")
);
CREATE INDEX IF NOT EXISTS idx_ratings_appointment ON appointment_ratings (appointment_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_by    ON appointment_ratings ("ratedBy");

-- ─── messages ─────────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages ("senderId", "senderType");
CREATE INDEX IF NOT EXISTS idx_messages_recipient  ON messages ("recipientId", "recipientType");
CREATE INDEX IF NOT EXISTS idx_messages_is_read    ON messages ("isRead");
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);

-- ─── technician_hiring_applications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technician_hiring_applications (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "applicationSource"           VARCHAR(30)    NOT NULL DEFAULT 'coordinator_invited',
    -- Stage 1
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
    -- Stage 2
    "bankName"                    VARCHAR(100),
    "bankAccountNumber"           VARCHAR(50),
    "bankAccountHolderName"       VARCHAR(100),
    "bankInfoConfirmed"           BOOLEAN        NOT NULL DEFAULT FALSE,
    "bankInfoConfirmedAt"         TIMESTAMPTZ,
    -- Stage 3
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
CREATE INDEX IF NOT EXISTS idx_hiring_nric   ON technician_hiring_applications (nric);
CREATE INDEX IF NOT EXISTS idx_hiring_status ON technician_hiring_applications ("applicationStatus");

-- ─── technician_availability ──────────────────────────────────────────────────
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
-- Partial unique indexes mirror Django's conditional uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_avail_weekly
    ON technician_availability ("technicianId", "dayOfWeek")
    WHERE "specificDate" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_avail_specific_date
    ON technician_availability ("technicianId", "specificDate")
    WHERE "specificDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_avail_tech_day  ON technician_availability ("technicianId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS idx_avail_tech_date ON technician_availability ("technicianId", "specificDate");
CREATE INDEX IF NOT EXISTS idx_avail_available ON technician_availability ("isAvailable");

-- ─── technician_password_reset_tokens ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technician_password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id   UUID         NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    token           VARCHAR(100) NOT NULL UNIQUE,
    "expiresAt"      TIMESTAMPTZ  NOT NULL,
    "isUsed"         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON technician_password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_tech  ON technician_password_reset_tokens (technician_id);

-- ─── telegram_link_tokens ─────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_telegram_token   ON telegram_link_tokens (token);
CREATE INDEX IF NOT EXISTS idx_telegram_user    ON telegram_link_tokens ("userId", "userType");
