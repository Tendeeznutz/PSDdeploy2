# AirServe Backend — Technical Reference

> Django REST Framework API powering the AirServe aircon scheduling platform.
>
> **Main README:** [`../README.md`](../README.md)

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Getting Started](#2-getting-started)
3. [Environment Variables](#3-environment-variables)
4. [API Endpoints](#4-api-endpoints)
5. [Authentication](#5-authentication)
6. [Data Models](#6-data-models)
7. [Scheduling Algorithm](#7-scheduling-algorithm)
8. [Notification Services](#8-notification-services)
9. [Deployment](#9-deployment)
10. [Test Accounts](#10-test-accounts)
11. [Related Documentation](#11-related-documentation)

---

## 1. Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Django | 4.2.5 |
| API Layer | Django REST Framework | 3.14.0 |
| Authentication | Simple JWT | 5.3.0 |
| Database (dev) | SQLite 3 | Built-in |
| Database (prod) | PostgreSQL | 16 |
| Object Storage | MinIO (S3-compatible) | RELEASE.2024-11-07 |
| WSGI Server | Gunicorn | 21.2.0 |
| CORS | django-cors-headers | 4.3.0 |
| Storage Backend | django-storages[s3] | 1.14+ |
| Static Files | WhiteNoise | 6.6.0 |
| Geolocation | geopy + OneMap API | 2.3+ |
| Email | Gmail SMTP | - |
| Notifications | Telegram Bot API | - |
| Image Processing | Pillow | 10+ |
| S3 Client | boto3 | 1.34+ |

---

## 2. Getting Started

### Local Development (SQLite)

```bash
cd Integrated_Scheduling_System-master/appointment_scheduling

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your API keys (OneMap, email, Telegram)

# Run migrations and seed data
python manage.py migrate
python create_test_users.py

# Start development server
python manage.py runserver
```

Server runs at **http://127.0.0.1:8000**

### Docker (PostgreSQL)

From the repository root:

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

The backend entrypoint (`infra/backend/entrypoint.sh`) automatically:
1. Waits for PostgreSQL readiness (30s timeout)
2. Runs `manage.py migrate`
3. Creates MinIO bucket if configured
4. Seeds test data when `RUN_SEED=true`
5. Starts Gunicorn (2 workers, 2 threads, 120s timeout)

---

## 3. Environment Variables

### Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `SECRET_KEY` | Django secret key | Auto-generated in Docker |
| `ONEMAP_EMAIL` | OneMap API login | `your@email.com` |
| `ONEMAP_PASSWORD` | OneMap API password | `yourpassword` |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEBUG` | Django debug mode | `True` |
| `ALLOWED_HOSTS` | Comma-separated host list | `localhost,127.0.0.1` |
| `DB_ENGINE` | Database backend | SQLite (when unset) |
| `DB_NAME` / `DB_HOST` / `DB_PORT` | PostgreSQL connection | - |
| `DB_USER` / `DB_PASSWORD` | PostgreSQL credentials | - |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO credentials (Docker only) | - |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL init (Docker only) | - |
| `EMAIL_HOST_USER` | Gmail address for notifications | - |
| `EMAIL_HOST_PASSWORD` | Gmail app password | - |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification secret | - |
| `FRONTEND_BASE_URL` | Frontend URL for emails | `http://localhost:3000` |
| `RUN_SEED` | Seed test data on startup | `false` |

Database selection is automatic in `settings.py`: if `DB_ENGINE` is set, PostgreSQL is used; otherwise SQLite.

---

## 4. API Endpoints

All endpoints are prefixed with `/api/`. The API uses DRF's `DefaultRouter`.

### Router-Registered Resources

| Prefix | ViewSet | Description |
|--------|---------|-------------|
| `/api/appointments/` | AppointmentViewSet | Full CRUD + custom actions |
| `/api/customers/` | CustomerViewSet | Customer management |
| `/api/technicians/` | TechnicianViewSet | Technician management |
| `/api/coordinators/` | CoordinatorViewSet | Coordinator management |
| `/api/customeraircondevices/` | CustomerAirconDeviceViewSet | Aircon device registration |
| `/api/messages/` | MessageViewSet | Internal messaging |
| `/api/hiring-applications/` | TechnicianHiringApplicationViewSet | Hiring pipeline |
| `/api/technician-availability/` | TechnicianAvailabilityViewSet | Schedule management |
| `/api/aircon-catalogs/` | AirconCatalogViewSet | Brand/model catalog |

### Utility Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health/` | Health check (HTTP 200) |
| POST | `/api/token/refresh/` | Refresh JWT from cookies |
| POST | `/api/auth/logout/` | Blacklist refresh token and clear cookies |
| POST | `/api/telegram/webhook/` | Telegram bot webhook |
| POST | `/api/telegram/generate-link/` | Generate Telegram linking token |
| GET | `/api/telegram/status/` | Check Telegram link status |
| POST | `/api/telegram/unlink/` | Unlink Telegram account |

### Custom Actions

**Appointments:**
- `POST /api/appointments/guest_booking/` — Guest booking (throttled: 10/min)
- `POST /api/appointments/{id}/send_receipt/` — Email receipt
- `GET /api/appointments/penalty-status/?customerId=<uuid>` — Penalty status

**Customers:**
- `POST /api/customers/login/` — Email + password login
- `POST /api/customers/{id}/forgot_password/` — Request reset email
- `POST /api/customers/{id}/validate_reset_token/` — Validate token
- `POST /api/customers/{id}/reset_password/` — Set new password

**Technicians:**
- `POST /api/technicians/login/` — Phone/email + password login
- `POST /api/technicians/{id}/forgot_password/` — Request reset
- `POST /api/technicians/{id}/reset_password/` — Set new password

**Coordinators:**
- `POST /api/coordinators/login/` — Email + password login

**Hiring Applications:**
- `POST /api/hiring-applications/{id}/confirm-personal-details/` — Advance to Stage 2
- `POST /api/hiring-applications/{id}/submit-bank-info/` — Advance to Stage 3
- `PATCH /api/hiring-applications/{id}/` — Coordinator review and approval

**Technician Availability:**
- `POST /api/technician-availability/bulk-create/` — Batch schedule creation
- `GET /api/technician-availability/available-slots/?technicianId=<uuid>&date=<YYYY-MM-DD>` — Available slots
- `GET /api/technician-availability/working-days/?technicianId=<uuid>&startDate=<date>&endDate=<date>` — Working days

**Aircon Catalogs:**
- `POST /api/aircon-catalogs/bulkCreate/` — CSV import of brand/model data

---

## 5. Authentication

JWT tokens with HTTP-only cookie transport.

### Flow

1. User submits credentials (email/phone + password)
2. Backend validates against hashed password (PBKDF2)
3. Access + refresh tokens generated and set as HTTP-only cookies
4. Subsequent requests include cookies automatically
5. On 401, frontend attempts token refresh
6. If refresh fails, user is logged out

### JWT Configuration

| Parameter | Value |
|-----------|-------|
| Access token lifetime | 30 minutes |
| Refresh token lifetime | 1 day |
| Token rotation | Enabled |
| Blacklisting | Enabled |
| Cookie Secure flag | `True` in production |
| Cookie SameSite | `Lax` |
| Cookie HttpOnly | `True` |

### Role-Based Access

JWT payload includes a `role` claim: `customer`, `technician`, or `coordinator`.

| Resource | Customer | Technician | Coordinator |
|----------|----------|------------|-------------|
| View own appointments | Yes | Yes | Yes (all) |
| Create appointment | Yes | No | Yes |
| Cancel appointment | Own only | No | Yes |
| View technician list | No | Self only | Yes |
| Review hiring apps | No | No | Yes |
| Manage catalogs | No | No | Yes |

### Rate Limiting

| Scope | Limit |
|-------|-------|
| Anonymous | 30/min |
| Authenticated | 120/min |
| Login | 5/min |
| Guest booking | 10/min |

---

## 6. Data Models

13 models with UUID primary keys. See [`PROJECT_DOCUMENTATION.md`](../PROJECT_DOCUMENTATION.md) Section 4.1 for full field-level schema.

| Model | Purpose |
|-------|---------|
| `Customers` | Customer accounts with contact, location, ratings, penalty balance |
| `Technicians` | Technician profiles with specializations, travel type, location |
| `Coordinators` | Admin staff accounts |
| `Appointments` | Bookings linking customer to technician with status lifecycle |
| `AppointmentRequest` | Appointment creation requests before processing |
| `CustomerAirconDevices` | Aircon units registered under customer accounts |
| `AirconCatalogs` | Reference catalog of AC brands and models |
| `AppointmentRating` | Bidirectional post-service ratings (1-5 stars) |
| `Messages` | Internal messaging between all user roles |
| `TechnicianHiringApplication` | 3-stage hiring pipeline with document uploads |
| `TechnicianAvailability` | Weekly schedules and specific-date overrides |
| `PasswordResetToken` | Time-limited tokens for password recovery |
| `TelegramLinkToken` | Deep-link tokens for Telegram account binding |

---

## 7. Scheduling Algorithm

**File:** `backend_api/scheduling_algo.py`

### `get_nearby_technicians(customer_id, aircon_brand, appointment_start_time)`

1. Resolve customer location from postal code (OneMap API)
2. Query all active, available technicians with valid locations
3. Determine each technician's effective location:
   - If they have a same-day appointment: use that customer's location
   - Otherwise: use their home/base location
4. Calculate distance; filter by 30 km radius
5. Check scheduling conflicts (30-min travel buffer, 12:00-13:00 lunch break)
6. Sort: brand specialists first, then by ascending distance

### Key Parameters

| Parameter | Value |
|-----------|-------|
| `SEARCH_RANGE_METERS` | 30,000 (30 km) |
| `TRAVEL_BUFFER_SECONDS` | 1,800 (30 min) |
| Lunch break | 12:00-13:00 SGT |
| Blocking statuses | Pending, Confirmed, Completed |

### Pricing

| Component | Amount |
|-----------|--------|
| Service per AC unit | $50.00 |
| Travel fee (flat) | $10.00 |
| Penalty fee (if applicable) | Variable |

> **Note:** Add-ons (filter replacement, extended warranty, priority service) are handled in the frontend pricing display but are not yet enforced in the backend billing logic.

---

## 8. Notification Services

### Email (Gmail SMTP)

- Provider: `smtp.gmail.com:465`
- Events: appointment confirmation, cancellation, password reset, receipt delivery
- Format: styled HTML with human-readable timestamps

### Telegram Bot

- Architecture: webhook-based
- Account linking via deep-link token
- Reminders at 24 hours and 1 hour before appointment
- Real-time status notifications and penalty alerts
- Reminder scheduler: cron job every 15 minutes

See [`appointment_scheduling/TELEGRAM_GUIDE.md`](appointment_scheduling/TELEGRAM_GUIDE.md) for setup instructions.

---

## 9. Deployment

### Docker Compose (Recommended)

See the [root README](../README.md) for quick start. The stack includes:

| Service | Image | Port |
|---------|-------|------|
| db | `postgres:16-alpine` | 5432 (internal) |
| minio | `minio/minio` | 9000/9001 (internal) |
| backend | Custom (Gunicorn) | 8000 (internal) |
| frontend | Custom (Next.js standalone) | 3000 (internal) |
| caddy | `caddy:2-alpine` | 80/443 (external) |

Caddy routes `/api/*` and `/admin/*` to the backend; everything else to the frontend.

### CI/CD

GitHub Actions workflow (`.github/workflows/build-backend.yml`) builds and pushes the backend Docker image to GHCR on pushes to the `server-push` branch.

### Bare-Metal (Legacy)

The `deployment/` directory contains scripts for traditional VPS deployment with Nginx + Gunicorn + Certbot. See [`PROJECT_DOCUMENTATION.md`](../PROJECT_DOCUMENTATION.md) Section 8 for details.

---

## 10. Test Accounts

All passwords: `password123`

| Role | Login Field | Credentials | Login URL |
|------|------------|-------------|-----------|
| Customer | Email | alice.tan@email.com | `/login` |
| Technician | Phone | 92222221 | `/technicianlogin` |
| Coordinator | Email | admin@airserve.com | `/coordinatorlogin` |

Run `python create_test_users.py` to seed all test data.

---

## 11. Related Documentation

| Document | Description |
|----------|-------------|
| [`TECHNICIAN_AVAILABILITY_GUIDE.md`](TECHNICIAN_AVAILABILITY_GUIDE.md) | Full guide for the technician scheduling system |
| [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md) | API quick reference for technician availability |
| [`PENALTY_SYSTEM.md`](PENALTY_SYSTEM.md) | Customer cancellation penalty framework |
| [`GUEST_BOOKING_SYSTEM.md`](GUEST_BOOKING_SYSTEM.md) | Guest booking flow (no account required) |
| [`IMPLEMENTATION_SUMMARY.md`](IMPLEMENTATION_SUMMARY.md) | Technician availability implementation details |
| [`../PROJECT_DOCUMENTATION.md`](../PROJECT_DOCUMENTATION.md) | Comprehensive system-wide technical documentation |
| [`../customer-frontend2/README.md`](../customer-frontend2/README.md) | Customer frontend (Next.js) documentation |

---

**Last Updated:** March 2026
