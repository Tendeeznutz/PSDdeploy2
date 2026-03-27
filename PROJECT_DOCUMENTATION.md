# AirServe - Integrated Aircon Scheduling System

## Comprehensive Project Documentation

**Project:** AirServe Appointment Scheduling Platform
**Repository:** [github.com/Tendeeznutz/PSDdeploy2](https://github.com/Tendeeznutz/PSDdeploy2) (Branch: `dockerized`)
**Date:** 28 March 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Backend API (Django REST Framework)](#4-backend-api-django-rest-framework)
   - 4.1 [Data Models](#41-data-models)
   - 4.2 [API Endpoints](#42-api-endpoints)
   - 4.3 [Authentication and Authorization](#43-authentication-and-authorization)
   - 4.4 [Scheduling Algorithm](#44-scheduling-algorithm)
   - 4.5 [Penalty System](#45-penalty-system)
   - 4.6 [Notification Services](#46-notification-services)
5. [Customer Frontend (Next.js)](#5-customer-frontend-nextjs)
   - 5.1 [Pages and User Flows](#51-pages-and-user-flows)
   - 5.2 [State Management](#52-state-management)
   - 5.3 [UI/UX Design](#53-uiux-design)
6. [Legacy Frontend (React)](#6-legacy-frontend-react)
7. [Docker Deployment Architecture](#7-docker-deployment-architecture)
   - 7.1 [Service Topology](#71-service-topology)
   - 7.2 [Dockerfiles](#72-dockerfiles)
   - 7.3 [Reverse Proxy](#73-reverse-proxy)
   - 7.4 [Deployment Scripts](#74-deployment-scripts)
8. [Bare-Metal VPS Deployment (Legacy)](#8-bare-metal-vps-deployment-legacy)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Security Measures](#10-security-measures)
11. [Seed Data and Test Accounts](#11-seed-data-and-test-accounts)
12. [Repository and Branch Structure](#12-repository-and-branch-structure)
13. [Key Features Summary](#13-key-features-summary)
14. [Future Considerations](#14-future-considerations)

---

## 1. Executive Summary

AirServe is a full-stack, containerized appointment scheduling platform built for air-conditioning maintenance services in Singapore. The system enables **customers** to book aircon servicing appointments online, **technicians** to manage their schedules and job assignments, and **coordinators** to oversee the entire operation from an administrative dashboard.

The platform features an intelligent scheduling algorithm that assigns technicians based on geographic proximity and brand specialization, a multi-channel notification system (email and Telegram), a penalty framework for cancellation abuse, and a three-stage technician hiring pipeline. The application is deployed as a Docker Compose stack with five services: PostgreSQL, MinIO (S3-compatible storage), a Django REST backend, a Next.js customer frontend, and Caddy as a reverse proxy with automatic HTTPS.

### Core Capabilities

| Capability | Description |
|---|---|
| **Multi-Role Access** | Customers, Technicians, and Coordinators each have dedicated interfaces and permissions |
| **Intelligent Scheduling** | Distance-based technician matching with specialization prioritization and travel buffer logic |
| **5-Step Booking Wizard** | Guided booking flow: Service Selection, Address, Schedule, Contact, Review and Pay |
| **Guest Booking** | Unauthenticated users can book without creating an account (rate-limited) |
| **Penalty System** | Automatic penalty fees for excessive or short-notice cancellations |
| **Telegram Integration** | Account linking, appointment reminders (24h and 1h before), and real-time notifications |
| **Technician Hiring Pipeline** | Three-stage application: Personal Details, Bank Info, Coordinator Review |
| **Containerized Deployment** | Single-command Docker Compose deployment with auto-HTTPS |

---

## 2. System Architecture Overview

The system follows a decoupled client-server architecture with clear separation between the frontend presentation layer and the backend API layer.

```
                        Internet
                           |
                     +-----------+
                     |   Caddy   |  (Ports 80/443, auto-HTTPS)
                     +-----------+
                      /          \
              /api/*,/admin/*     /*
                    /              \
          +------------+    +-------------+
          |   Django   |    |   Next.js   |
          |  Backend   |    |  Frontend   |
          | (Port 8000)|    | (Port 3000) |
          +------------+    +-------------+
            /        \
   +-----------+  +-----------+
   | PostgreSQL|  |   MinIO   |
   |  (5432)   |  |  (9000)   |
   +-----------+  +-----------+
```

**Data Flow:**

1. All HTTP(S) traffic enters through Caddy, which terminates TLS and routes requests.
2. Requests to `/api/*` and `/admin/*` are proxied to the Django backend on port 8000.
3. All other requests are served by the Next.js frontend on port 3000.
4. Django communicates with PostgreSQL for relational data and MinIO for file/media storage.
5. Background services handle Telegram webhooks, email dispatch, and scheduled reminders.

---

## 3. Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Django | 4.2.5 | Web framework and ORM |
| API Layer | Django REST Framework | 3.14.0 | RESTful API construction |
| Authentication | Simple JWT | 5.3.0 | JWT token generation and validation |
| Database | PostgreSQL | 16 (Alpine) | Persistent relational data store |
| Object Storage | MinIO | Latest | S3-compatible media and file storage |
| WSGI Server | Gunicorn | Latest | Production-grade Python WSGI HTTP server |
| Static Files | WhiteNoise | 6.6.0 | Efficient static file serving |
| Geolocation | geopy + OneMap API | 2.3+ | Distance calculation and Singapore postal code lookup |
| Email | Gmail SMTP | - | Transactional email delivery |
| Bot | Telegram Bot API | - | Notification channel |
| Image Processing | Pillow | 10+ | Image handling for uploads |
| S3 Client | boto3 | 1.34+ | MinIO/S3 operations |

### Frontend (Customer Portal)

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js | 14 | React framework with SSR and file-based routing |
| Language | TypeScript | - | Static typing for reliability |
| Styling | Tailwind CSS | 3.x | Utility-first CSS framework |
| State | Zustand | Latest | Lightweight global state management |
| Forms | React Hook Form | Latest | Performant form handling and validation |
| HTTP Client | Axios | Latest | API communication with interceptors |
| Icons | Lucide React | Latest | SVG icon library |
| Dates | date-fns | Latest | Date formatting and manipulation |

### Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Container Runtime | Docker + Docker Compose | Service orchestration |
| Reverse Proxy | Caddy 2 | Auto-HTTPS, request routing, security headers |
| CI/CD | GitHub Actions | Automated container image builds |
| Container Registry | GHCR | Docker image hosting |
| Legacy Proxy | Nginx + Certbot | Bare-metal VPS reverse proxy |
| Process Manager | systemd | Gunicorn service management (bare-metal) |

---

## 4. Backend API (Django REST Framework)

The backend is a single Django application (`backend_api`) within the `appointment_scheduling` project. It exposes a RESTful JSON API consumed by both the customer frontend and legacy coordinator/technician frontend.

### 4.1 Data Models

The database schema comprises 13 interconnected models with UUID primary keys.

#### 4.1.1 Customers

Stores customer accounts with contact details, location, and financial state.

| Field | Type | Description |
|---|---|---|
| `customerId` | UUID (PK) | Unique identifier |
| `customerName` | CharField | Full name |
| `customerPostalCode` | CharField | 6-digit Singapore postal code |
| `customerAddress` | CharField | Full street address |
| `customerPhone` | CharField | 8-digit phone number |
| `customerEmail` | EmailField | Unique email address |
| `customerPassword` | CharField | Hashed password |
| `pendingPenaltyFee` | DecimalField | Outstanding cancellation penalty balance |
| `customerRating` | DecimalField | Average rating received from technicians |
| `ratingCount` | IntegerField | Total ratings received |
| `customerLocation` | CharField | Latitude,longitude string (optional) |
| `telegramChatId` | BigIntegerField | Linked Telegram chat ID (optional) |

**Indexes:** `customerPhone`, `customerEmail`

#### 4.1.2 Technicians

Stores technician profiles including location, travel mode, specializations, and operational status.

| Field | Type | Description |
|---|---|---|
| `technicianId` | UUID (PK) | Unique identifier |
| `technicianName` | CharField | Full name |
| `technicianPostalCode` | CharField | Base postal code |
| `technicianAddress` | CharField | Home/base address |
| `technicianPhone` | CharField | Contact number |
| `technicianEmail` | EmailField | Email address |
| `technicianPassword` | CharField | Hashed password |
| `technicianStatus` | CharField | `1` (Available) or `2` (Unavailable) |
| `isActive` | BooleanField | Account active/deactivated flag |
| `technicianTravelType` | CharField | `own_vehicle`, `rented_vehicle`, or `company_vehicle` |
| `specializations` | JSONField | List of AC brands the technician specializes in |
| `technicianRating` | DecimalField | Average rating from customers |
| `technicianLocation` | CharField | `latitude,longitude` string |
| `technicianRatingCount` | IntegerField | Total ratings received |
| `telegramChatId` | BigIntegerField | Linked Telegram chat ID |
| `deactivatedAt` | DateTimeField | When account was deactivated (optional) |
| `deactivationReason` | TextField | Reason for deactivation (optional) |

**Indexes:** `technicianStatus`, `technicianPhone`, `technicianEmail`, `technicianPostalCode`, `isActive`

#### 4.1.3 Coordinators

Administrative staff who oversee operations, manage technicians, and review hiring applications.

| Field | Type | Description |
|---|---|---|
| `coordinatorId` | UUID (PK) | Unique identifier |
| `coordinatorName` | CharField | Full name |
| `coordinatorEmail` | EmailField | Unique email |
| `coordinatorPhone` | CharField | Contact number |
| `coordinatorPassword` | CharField | Hashed password |

#### 4.1.4 Appointments

The central booking entity linking customers to technicians and aircon devices.

| Field | Type | Description |
|---|---|---|
| `appointmentId` | UUID (PK) | Unique identifier |
| `customerId` | FK (Customers) | Booking customer (PROTECT on delete) |
| `technicianId` | FK (Technicians) | Assigned technician (SET_NULL, optional) |
| `appointmentStartTime` | BigIntegerField | Unix timestamp for start |
| `appointmentEndTime` | BigIntegerField | Unix timestamp for end |
| `airconToService` | JSONField | List of `CustomerAirconDevice` IDs to service |
| `appointmentStatus` | CharField | `1` Pending, `2` Confirmed, `3` Completed, `4` Cancelled |
| `paymentMethod` | CharField | `cash`, `cheque`, `card`, `bank_transfer`, `paynow` (PayNow) |
| `customerFeedback` | TextField | Post-service feedback text |
| `cancellationReason` | TextField | Reason for cancellation |
| `cancelledBy` | CharField | Role of canceller (`customer`, `technician`, `coordinator`) |
| `cancelledAt` | DateTimeField | Timestamp of cancellation |

**Constraints:** `appointmentEndTime > appointmentStartTime`
**Indexes:** `appointmentStatus`, `customerId+status`, `technicianId+status`, `appointmentStartTime`

#### 4.1.5 CustomerAirconDevices

Aircon units registered under a customer's account.

| Field | Type | Description |
|---|---|---|
| `airconDeviceId` | UUID (PK) | Unique identifier |
| `customerId` | FK (Customers) | Owning customer (CASCADE) |
| `airconName` | CharField | User-assigned name (unique per customer) |
| `numberOfUnits` | IntegerField | Number of indoor units (1-100) |
| `airconType` | CharField | Dropdown: Daikin, Mitsubishi, Panasonic, LG, Samsung, etc. |
| `lastServiceMonth` | CharField | Last serviced month (YYYY-MM format) |
| `remarks` | TextField | Additional notes |

#### 4.1.6 AirconCatalogs

Reference catalog of AC brands and models available for servicing.

| Field | Type | Description |
|---|---|---|
| `airconCatalogId` | UUID (PK) | Unique identifier |
| `airconBrand` | CharField | Brand name |
| `airconModel` | CharField | Model identifier |

**Constraint:** Unique `(brand, model)` combination

#### 4.1.7 AppointmentRating

Bidirectional post-appointment ratings between customers and technicians.

| Field | Type | Description |
|---|---|---|
| `ratingId` | UUID (PK) | Unique identifier |
| `appointment` | FK (Appointments) | Rated appointment (CASCADE) |
| `ratedBy` | CharField | `technician` or `customer` |
| `rating` | IntegerField | Score from 1 to 5 stars |

**Constraint:** One rating per appointment per direction

#### 4.1.8 Messages

Internal messaging system for communication between all user roles.

| Field | Type | Description |
|---|---|---|
| `messageId` | UUID (PK) | Unique identifier |
| `senderType` | CharField | Role of sender |
| `senderId` | UUIDField | Sender's user ID |
| `senderName` | CharField | Display name |
| `recipientType` | CharField | Role of recipient |
| `recipientId` | UUIDField | Recipient's user ID |
| `recipientName` | CharField | Display name |
| `subject` | CharField | Message subject line |
| `body` | TextField | Message content (max 2000 characters) |
| `isRead` | BooleanField | Read status |
| `readAt` | DateTimeField | Timestamp when read |
| `relatedAppointment` | FK (Appointments) | Optional linked appointment |

#### 4.1.9 TechnicianHiringApplication

Three-stage application workflow for onboarding new technicians.

**Stage 1 - Personal Details:**
- Name, NRIC, citizenship, address, phone, email
- Years of experience, criminal record declaration
- Document uploads: resume, profile photo, NRIC front/back, driving license
- Medical fitness declaration
- AC brand specializations

**Stage 2 - Bank Information:**
- Bank name, account number, account holder name

**Stage 3 - Coordinator Review:**
- Pay rate, coordinator notes, approval decision
- On approval: automatically creates a Technician account from application data

#### 4.1.10 TechnicianAvailability

Weekly recurring schedules and specific-date overrides for technician availability.

| Field | Type | Description |
|---|---|---|
| `technicianId` | FK (Technicians) | Technician reference (CASCADE) |
| `dayOfWeek` | CharField | monday through sunday |
| `startTime` | CharField | HH:MM format (e.g., `09:00`) |
| `endTime` | CharField | HH:MM format (e.g., `17:00`) |
| `specificDate` | DateField | Override for a specific date |
| `isAvailable` | BooleanField | Available or on leave |

**Constraint:** Minimum 5 working days per technician

#### 4.1.11 PasswordResetToken

Token-based password reset mechanism for all user roles.

| Field | Type | Description |
|---|---|---|
| `token` | CharField | Unique reset token string |
| `userId` | UUIDField | ID of the user requesting reset |
| `userType` | CharField | Role of the user (`customer`, `technician`, `coordinator`) |
| `expiresAt` | DateTimeField | Token expiration timestamp |
| `isUsed` | BooleanField | Whether the token has been consumed |

#### 4.1.12 TelegramLinkToken

Deep-link tokens for binding Telegram accounts to user profiles.

| Field | Type | Description |
|---|---|---|
| `token` | CharField | Unique linking token |
| `userId` | UUIDField | User to link |
| `userType` | CharField | Role (`customer`, `technician`) |
| `expiresAt` | DateTimeField | Token expiration |

#### 4.1.13 AppointmentRequest

Stores appointment creation requests before they are processed.

---

### 4.2 API Endpoints

All endpoints are prefixed with `/api/`. The API uses Django REST Framework's `DefaultRouter` for ViewSet-based routing.

#### Router-Registered Resources

| Prefix | ViewSet | Description |
|---|---|---|
| `/api/appointments/` | AppointmentViewSet | Full CRUD + custom actions |
| `/api/customers/` | CustomerViewSet | Customer management |
| `/api/technicians/` | TechnicianViewSet | Technician management |
| `/api/coordinators/` | CoordinatorViewSet | Coordinator management |
| `/api/customeraircondevices/` | CustomerAirconDeviceViewSet | AC device registration |
| `/api/messages/` | MessageViewSet | Internal messaging |
| `/api/hiring-applications/` | TechnicianHiringApplicationViewSet | Hiring pipeline |
| `/api/technician-availability/` | TechnicianAvailabilityViewSet | Schedule management |
| `/api/aircon-catalogs/` | AirconCatalogViewSet | Brand/model catalog |

#### Global Utility Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health/` | Health check (returns HTTP 200) |
| POST | `/api/token/refresh/` | Refresh JWT from cookies |
| POST | `/api/auth/logout/` | Blacklist refresh token and clear cookies |
| POST | `/api/telegram/webhook/` | Telegram bot incoming webhook |
| POST | `/api/telegram/generate-link/` | Generate one-time Telegram linking token |
| GET | `/api/telegram/status/` | Check if Telegram is linked |
| POST | `/api/telegram/unlink/` | Unlink Telegram account |

#### Custom ViewSet Actions

**Appointments:**
- `POST /api/appointments/guest_booking/` - Guest booking (throttled: 10/min)
- `POST /api/appointments/{id}/send_receipt/` - Generate and send receipt to mailbox

**Customers:**
- `POST /api/customers/login/` - Email + password login
- `POST /api/customers/{id}/forgot_password/` - Request reset email
- `POST /api/customers/{id}/validate_reset_token/` - Validate token
- `POST /api/customers/{id}/reset_password/` - Set new password

**Technicians:**
- `POST /api/technicians/login/` - Phone/email + password login
- `POST /api/technicians/{id}/forgot_password/` - Request reset
- `POST /api/technicians/{id}/reset_password/` - Set new password

**Coordinators:**
- `POST /api/coordinators/login/` - Email + password login

**Hiring Applications:**
- `POST /api/hiring-applications/{id}/confirm-personal-details/` - Advance to Stage 2
- `POST /api/hiring-applications/{id}/submit-bank-info/` - Advance to Stage 3
- `PATCH /api/hiring-applications/{id}/` - Coordinator review and approval

**Technician Availability:**
- `POST /api/technician-availability/bulk-create/` - Batch schedule creation

**Aircon Catalogs:**
- `POST /api/aircon-catalogs/bulkCreate/` - CSV import of brand/model data

---

### 4.3 Authentication and Authorization

The system uses **JWT (JSON Web Tokens)** with **HTTP-only cookie transport** for session management.

#### Authentication Flow

```
1. User submits credentials (email + password)
          |
2. Backend validates against hashed password
          |
3. JWT access + refresh tokens generated
          |
4. Tokens set as HTTP-only cookies
   - access_token: 30 min lifetime
   - refresh_token: 1 day lifetime
          |
5. Subsequent requests include cookies automatically
          |
6. On 401 response, frontend attempts token refresh
          |
7. If refresh fails, user is logged out
```

#### JWT Configuration

| Parameter | Value |
|---|---|
| Access Token Lifetime | 30 minutes |
| Refresh Token Lifetime | 1 day |
| Token Rotation | Enabled (new refresh on each use) |
| Blacklisting | Enabled (old refresh tokens invalidated) |
| Cookie Secure Flag | `True` in production, `False` in debug |
| Cookie SameSite | `Lax` |
| Cookie HttpOnly | `True` (prevents XSS token theft) |

#### Role-Based Access Control

The JWT payload includes a `role` claim (`customer`, `technician`, or `coordinator`). Each ViewSet method checks the role before processing:

| Resource | Customer | Technician | Coordinator |
|---|---|---|---|
| View own appointments | Yes | Yes | Yes (all) |
| Create appointment | Yes | No | Yes |
| Cancel appointment | Yes (own) | No | Yes |
| View technician list | No | Self only | Yes |
| Review hiring apps | No | No | Yes |
| Manage catalogs | No | No | Yes |
| Send messages | Yes | Yes | Yes |

#### Rate Limiting

| Scope | Limit |
|---|---|
| Anonymous requests | 30/minute |
| Authenticated requests | 120/minute |
| Login endpoints | 5/minute |
| Guest booking | 10/minute |

---

### 4.4 Scheduling Algorithm

The scheduling algorithm is the core business logic, responsible for matching customers with the most suitable available technician.

**File:** `backend_api/scheduling_algo.py`

#### Algorithm: `get_nearby_technicians()`

```
Input: customer_id, aircon_brand (optional), appointment_start_time
                         |
Step 1: Resolve customer location from postal code
                         |
Step 2: Query all active, available technicians
         - isActive = True
         - technicianStatus = "1" (Available)
         - Valid location (not "0,0")
                         |
Step 3: For each technician, determine effective location
         - If technician has a prior appointment same day:
             Use that customer's location (where they'll already be)
         - Otherwise: Use technician's home/base location
                         |
Step 4: Calculate distance to customer
         - geopy for straight-line distance
         - Filter by 30 km search range (SEARCH_RANGE_METERS = 30000)
                         |
Step 5: Check for scheduling conflicts
         - Blocking statuses: Pending (1), Confirmed (2), Completed (3)
         - Apply 30-minute travel buffer (TRAVEL_BUFFER_SECONDS = 1800)
         - Enforce 12:00-13:00 lunch break (SGT)
                         |
Step 6: Sort results
         - Specialists first (technicians with matching brand specialization)
         - Within each group: sorted by ascending distance
                         |
Output: Ordered list of available technicians
```

#### Key Parameters

| Parameter | Value | Purpose |
|---|---|---|
| `SEARCH_RANGE_METERS` | 30,000 | Maximum assignment radius |
| `TRAVEL_BUFFER_SECONDS` | 1,800 | 30-minute gap between appointments |
| `LUNCH_BREAK_START` | 12:00 SGT | Lunch period start |
| `LUNCH_BREAK_END` | 13:00 SGT | Lunch period end |
| `APPOINTMENT_STATUSES_BLOCKING` | 1, 2, 3 | Statuses that block a timeslot |

#### Pricing Model

| Component | Amount |
|---|---|
| Service cost per AC unit | $50.00 |
| Travel fee (flat) | $10.00 |
| Filter Replacement (add-on) | $30.00 |
| Extended Warranty (add-on) | $50.00 |
| Priority Service (add-on) | $20.00 |
| Penalty fee (if applicable) | Added to total |
| **Total** | **(units x $50) + $10 + selected add-ons + penalties** |

---

### 4.5 Penalty System

The penalty framework discourages excessive cancellations and short-notice disruptions.

**File:** `backend_api/penalty_utils.py`

#### Rules

| Rule | Threshold | Penalty |
|---|---|---|
| Monthly cancellation limit | 5 free cancellations/month | $20 per additional cancellation |
| Short-notice cancellation | Less than 30 minutes before start | $20 flat fee |

#### Process

```
Customer requests cancellation
          |
check_and_apply_penalty(customer_id, appointment_start_time)
          |
     +----+----+
     |         |
Monthly count  Short-notice check
> 5 this month?  < 30 min to start?
     |              |
     +------+-------+
            |
   Apply applicable fees
   Add to customer.pendingPenaltyFee
            |
   Penalty added to next booking invoice
            |
   clear_penalty_fee() on payment
```

**Return structure:**
- `penalty_applied`: boolean
- `cancellation_count`: number of cancellations this month
- `penalty_amount`: fee charged for this cancellation
- `total_pending_penalty`: cumulative unpaid penalty balance
- `short_notice_penalty`: boolean indicating short-notice charge
- `monthly_limit_penalty`: boolean indicating threshold exceeded

---

### 4.6 Notification Services

The platform uses a dual-channel notification approach: email and Telegram.

#### Email Notifications

- **Provider:** Gmail SMTP (`smtp.gmail.com:465`)
- **Events:**
  - Appointment confirmation
  - Appointment cancellation
  - Password reset link
  - Receipt delivery
- **Format:** Styled HTML emails with human-readable timestamps

#### Telegram Bot Integration

- **Architecture:** Webhook-based (not polling)
- **Features:**
  - Account linking via deep-link token
  - Appointment reminders at 24 hours and 1 hour before
  - Real-time appointment status notifications
  - Penalty charge notifications
- **Reminder Scheduler:** Runs via cron every 15 minutes, tracks sent reminders in `.telegram_reminders_sent.json`

#### Message Routing for Customer Messages

When a customer sends a message through the platform:
1. A copy is sent to the assigned technician's inbox
2. A copy is sent to the coordinator's inbox
3. If either recipient has Telegram linked, a Telegram notification is also dispatched

---

## 5. Customer Frontend (Next.js)

The customer-facing frontend is a Next.js 14 application with TypeScript, Tailwind CSS, and Zustand for state management.

### 5.1 Pages and User Flows

#### Page Directory

| Route | Page Component | Description |
|---|---|---|
| `/` | `HomePage.tsx` | Marketing landing page with hero, services, reviews, FAQ |
| `/login` | `LoginPage.tsx` | Customer email/password authentication |
| `/register` | `RegisterPage.tsx` | New customer registration form |
| `/book` | `BookPage.tsx` | 5-step booking wizard (core feature) |
| `/booking-success` | `BookingSuccessPage.tsx` | Confirmation with invoice and PDF download |
| `/estimate` | `EstimatePage.tsx` | Interactive price calculator |
| `/dashboard` | `DashboardPage.tsx` | Appointment listing (upcoming/completed/cancelled) |
| `/profile` | `ProfilePage.tsx` | Account settings, devices, messages, Telegram |
| `/services` | `ServicesPage.tsx` | Service catalog with cards |
| `/services/[slug]` | `ServiceDetailPage.tsx` | Individual service detail |
| `/support` | `SupportPage.tsx` | Help center with FAQ and contact form |
| `/forgot-password` | `ForgotPasswordPage.tsx` | Password recovery request |
| `/reset-password` | `ResetPasswordPage.tsx` | Token-based password reset |
| `/bookings/[id]` | `BookingDetailsPage.tsx` | Individual booking detail |
| `/bookings/[id]/edit` | `ReschedulePage.tsx` | Reschedule an existing appointment |

#### 5-Step Booking Wizard (Core Flow)

The booking process is the central user experience, implemented as a multi-step form with real-time validation.

```
Step 1: Service Selection
  - Choose service type (General, Chemical, Troubleshooting, Installation, Gas Top-up)
  - Select number of units (1-20) or pick saved aircon devices
  - Optional add-ons: Filter Replacement ($30), Extended Warranty ($50), Priority ($20)
          |
Step 2: Address
  - Enter full address and postal code (6-digit validation)
  - Optional notes (gate code, parking instructions)
          |
Step 3: Schedule
  - Pick date from next 14 days (Sundays excluded)
  - Select time slot (9 AM - 5 PM, 9 slots available)
  - Backend checks technician availability in real-time
  - Unavailable slots are disabled automatically
          |
Step 4: Contact
  - Name, email, phone (pre-filled if logged in)
          |
Step 5: Review and Pay
  - Full cost breakdown:
      Service: units x $50
      Add-ons: itemized
      Travel:  $10
      Penalty: (if applicable)
      ──────────────
      Total:   calculated
  - Select payment method (Cash, Card, PayNow, Bank Transfer, Cheque)
  - Submit booking
          |
Booking Success Page
  - Confirmation with booking reference
  - Downloadable PDF invoice
  - Email notification sent
```

**Guest Booking:** If the user is not logged in, a temporary customer account is created automatically with a random password. The user can later claim the account through password reset.

#### Dashboard

The dashboard organizes appointments into three tabs:
- **Upcoming:** Active appointments (Pending + Confirmed)
- **Completed:** Past serviced appointments with feedback and rating prompts
- **Cancelled:** Cancelled bookings with reasons

Each appointment card displays: Booking ID, status badge, date/time, address, number of units, and assigned technician name.

#### Profile Page

A comprehensive account management page with sections:
- **Overview:** Stats cards (total appointments, completed, upcoming, cancelled, registered devices)
- **Edit Profile:** Modify name, phone, address, and postal code
- **Change Password:** Current password verification, new password with confirmation
- **Aircon Devices:** CRUD management with type, unit count, and remarks
- **Messages:** Inbox and Sent folders with compose functionality
- **Telegram:** Link/unlink Telegram account for notification preferences

---

### 5.2 State Management

#### Zustand Auth Store (`lib/store.ts`)

```typescript
interface AuthState {
  customer: Customer | null      // Current user data
  isAuthenticated: boolean       // Login state
  login(customer: Customer): void
  logout(): Promise<void>
}
```

- **Persistence:** LocalStorage (key: `customer-storage`)
- **Security:** Only stores `id`, `customerName`, and `isAuthenticated` (no tokens or passwords)
- **Logout:** Calls server endpoint to blacklist refresh token, then clears local state

#### API Client (`lib/api.ts`)

The Axios-based API client provides typed methods organized by domain:

| Module | Key Methods |
|---|---|
| `customerApi` | `login`, `register`, `getProfile`, `updateProfile`, `forgotPassword`, `resetPassword` |
| `airconDeviceApi` | `getDevices`, `createDevice`, `updateDevice`, `deleteDevice` |
| `messageApi` | `getInbox`, `getSent`, `getUnreadCount`, `markAsRead`, `sendMessage` |
| `appointmentApi` | `getAppointments`, `createAppointment`, `cancelAppointment`, `getUnavailableSlots`, `rateTechnician`, `getPenaltyStatus` |
| `telegramApi` | `generateLink`, `checkStatus`, `unlink` |

**Interceptors:**
- 401 responses trigger automatic token refresh via `/api/token/refresh/`
- On refresh failure, the user is logged out and redirected

---

### 5.3 UI/UX Design

#### Design System

| Element | Value |
|---|---|
| Display Font | Space Grotesk |
| Body Font | Work Sans |
| Primary Color | Blue (#0ea5e9) |
| Accent Color | Purple (#d946ef) |
| Background | Sand (#F7F3EE) / White (#FFFFFF) |
| Text | Ink (#111318) |

#### Animations

- **Scroll-triggered:** Elements fade in as they enter the viewport using Intersection Observer
- **Staggered children:** Sequential delay on list items for visual rhythm
- **Directional fades:** Left, right, and scale variants for varied entry effects
- **Hero animations:** Title, subtitle, stats, and CTA animate independently on page load
- **Reduced motion:** All animations respect `prefers-reduced-motion` media query

#### Reusable Components

| Component | Purpose |
|---|---|
| `Button` | Multi-variant button (primary, secondary, outline, ghost) with loading state |
| `Modal` | Overlay dialog with backdrop blur, close handling, and size variants |
| `ServiceCard` | Service display with image, rating, price, and selection state |
| `StatusBadge` | Color-coded status indicator (Pending=yellow, Confirmed=blue, Completed=green, Cancelled=red) |
| `Stepper` | Multi-step progress indicator with numbered circles and connectors |
| `RatingPopup` | Post-service star rating carousel for unrated appointments |
| `InactivityTimer` | 5-minute timeout with 2-minute warning modal and countdown |
| `EmptyState` | Placeholder for empty data with optional action button |
| `BookingDetailsModal` | Expanded booking view with timeline, details grid, and action buttons |

#### Security UX

- **Inactivity Timer:** After 5 minutes of no interaction (mouse, keyboard, scroll, touch), a warning modal appears with a 2-minute countdown. If the user does not click "Stay Logged In," they are automatically logged out.
- **Session Storage:** Sensitive booking data is stored in `sessionStorage` (cleared on tab close), not `localStorage`.

---

## 6. Legacy Frontend (React)

The system maintains a dual-frontend architecture: the modern Next.js application (Section 5) serves customers exclusively, while the original React frontend continues to provide coordinator and technician interfaces that have not yet been migrated. Both frontends communicate with the same Django REST backend. The legacy frontend was built with Create React App, Ant Design, and Material UI and resides under `Integrated_Scheduling_System-master/appointment_scheduling/frontend/`.

### Coordinator Pages

| Page | Functionality |
|---|---|
| `CoordinatorHome.js` | Dashboard overview with appointment statistics |
| `CoordinatorAppointmentView.js` | View and filter all appointments |
| `CoordinatorAppointmentUpdate.js` | Update appointment status and technician assignment |

### Technician Pages

| Page | Functionality |
|---|---|
| `TechnicianHome.js` | Technician-specific dashboard |
| `TechnicianProfile.js` | Profile management and availability |

### Shared Pages

| Page | Functionality |
|---|---|
| `Login.js` | Multi-role login (customer, technician, coordinator) |
| `Profile.js` | User profile management |

Migrating these interfaces to the modern Next.js stack is a planned future improvement (see Section 14).

---

## 7. Docker Deployment Architecture

The `dockerized` branch introduces a fully containerized deployment using Docker Compose.

### 7.1 Service Topology

```
docker-compose.yml
├── db          (PostgreSQL 16-alpine)
│   ├── Port: 5432 (internal)
│   ├── Volume: pg_data
│   └── Health: pg_isready
│
├── minio       (MinIO S3-compatible)
│   ├── Ports: 9000 (internal only), 9001 (Console, localhost:9001)
│   ├── Volume: minio_data
│   └── Health: /minio/health/live
│
├── backend     (Django + Gunicorn)
│   ├── Port: 8000 (internal)
│   ├── Depends: db, minio
│   └── Health: /api/health/
│
├── frontend    (Next.js 14 Standalone)
│   ├── Port: 3000 (localhost:3000)
│   └── Health: HTTP 200 on /
│
└── caddy       (Reverse Proxy + Auto-HTTPS)
    ├── Ports: 80, 443 (external)
    ├── Volumes: caddy_data, caddy_config
    └── Routes: /api/* → backend, /* → frontend
```

**Network:** All services run on the `airserve-net` Docker bridge network. Only Caddy exposes ports externally (80 and 443).

### 7.2 Dockerfiles

#### Backend (`infra/backend/Dockerfile`)

Two-stage build optimized for minimal image size:

- **Builder stage:** `python:3.11-slim` with build dependencies (`gcc`, `libc6-dev`) compiles C-extension wheels for `psycopg2` and `Pillow`
- **Runtime stage:** Slim image with only runtime libraries (`libpq5`, `libjpeg62-turbo`), non-root `airserve` user, collected static files
- **Entrypoint (`infra/backend/entrypoint.sh`):**
  1. Waits for PostgreSQL to accept connections (30-second timeout)
  2. Runs Django database migrations
  3. Creates MinIO storage bucket if configured
  4. Optionally seeds test data (`RUN_SEED=true`)
  5. Starts Gunicorn (2 workers, 2 threads, 120s timeout)

#### Frontend (`infra/frontend/Dockerfile`)

Three-stage build for minimal production image (~30 MB):

- **Dependencies stage:** `node:20-alpine`, installs npm packages
- **Builder stage:** Builds Next.js with `NEXT_PUBLIC_API_URL=/api` for relative API paths
- **Runtime stage:** Standalone Next.js output, non-root `airserve` user, port 3000

### 7.3 Reverse Proxy

#### Caddy Configuration (`infra/caddy/Caddyfile`)

```
{$DOMAIN} {
    # Backend API and admin
    handle /api/* {
        reverse_proxy backend:8000
    }
    handle /admin/* {
        reverse_proxy backend:8000
    }

    # Frontend (everything else)
    handle {
        reverse_proxy frontend:3000
    }

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

**Key features:**
- Automatic HTTPS via Let's Encrypt (domain from `$DOMAIN` environment variable)
- Path-based routing: `/api/*` and `/admin/*` go to Django, everything else to Next.js
- Security headers applied to all responses

### 7.4 Deployment Scripts

#### Docker Deployment (`deploy-docker.sh`)

Automated single-command deployment:

1. **Cleanup:** Kills any existing bare-metal processes (next-server, node, gunicorn)
2. **Environment:** Auto-generates `.env` with cryptographic secrets if file doesn't exist
3. **Build:** Runs `docker compose build` for all services
4. **Start:** Runs `docker compose up -d` to launch the stack
5. **Health check:** Polls backend `/api/health/` endpoint for up to 30 attempts (3-second intervals)
6. **Status:** Displays container status and service URLs

---

## 8. Bare-Metal VPS Deployment (Legacy)

The legacy deployment path uses a traditional VPS setup for environments without Docker.

### Deployment Script (`deploy.sh`)

Supports multiple operation modes:

| Command | Action |
|---|---|
| `./deploy.sh pull` | Git pull only |
| `./deploy.sh backend` | Pull + venv + migrate + restart Gunicorn |
| `./deploy.sh frontend` | Pull + npm install + build + restart Next.js |
| `./deploy.sh both` | Full stack deployment (default) |
| `./deploy.sh status` | Show running processes and health |
| `./deploy.sh stop` | Kill both services |

### Server Architecture (Bare-Metal)

```
Nginx (80/443)
  ├── / → Next.js static build (port 3000)
  ├── /api/ → Gunicorn (port 8000)
  ├── /admin/ → Gunicorn (port 8000)
  ├── /static/ → Django static files (30-day cache)
  └── /media/ → Upload files (7-day cache)
```

### First-Time VPS Setup (`deployment/deploy.sh --first-run`)

Eight-step provisioning:
1. Install system dependencies (python3, nginx, certbot, nodejs, npm)
2. Clone repository from GitHub
3. Create Python virtual environment and install requirements
4. Generate `.env` from template
5. Run Django migrations and collectstatic
6. Build frontend
7. Configure Nginx (copy config, create symlink)
8. Set up Gunicorn as a systemd service

### Systemd Service (`deployment/airserve.service`)

```ini
[Service]
User=ay2526-tp-j
Group=www-data
WorkingDirectory=/home/ay2526-tp-j/app/appointment_scheduling
ExecStart=.venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 \
  --timeout 120 appointment_scheduling.wsgi:application
Restart=always
RestartSec=5
```

---

## 9. CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/build-backend.yml`)

**Trigger conditions:**
- Push to `server-push` branch
- Changes in `Integrated_Scheduling_System-master/appointment_scheduling/**`
- Changes in `infra/backend/**`
- Changes to the workflow file itself

**Pipeline:**
1. Checkout repository code
2. Authenticate to GitHub Container Registry (GHCR)
3. Extract Docker metadata (SHA-based tags + `latest`)
4. Set up Docker Buildx for multi-platform builds
5. Build backend Docker image
6. Push to `ghcr.io/<repository>/airserve-backend`
7. Use GitHub Actions build cache for layer reuse

**Note:** The current CI/CD pipeline covers backend image builds triggered from the `server-push` branch. Frontend images are built locally during Docker Compose deployment. Extending the pipeline to cover the `dockerized` branch and frontend builds is a planned improvement.

---

## 10. Security Measures

The platform implements security at multiple layers.

### Application Security

| Measure | Implementation |
|---|---|
| **JWT Cookie Authentication** | HTTP-only, Secure, SameSite=Lax cookies prevent XSS token theft |
| **Token Rotation** | Refresh tokens are rotated on each use; old tokens are blacklisted |
| **Password Hashing** | Django's built-in PBKDF2 hasher (industry standard) |
| **Rate Limiting** | 5/min on login, 10/min on guest booking, 30/min anonymous, 120/min authenticated |
| **CORS Whitelisting** | Explicit origin allowlist with credentials support |
| **CSP Headers** | Content Security Policy via custom middleware |
| **Inactivity Timeout** | 5-minute frontend session timeout with warning |
| **Audit Logging** | Sensitive operations logged to `audit.log` |

### Infrastructure Security

| Measure | Implementation |
|---|---|
| **Non-Root Containers** | All Docker containers run as `airserve` user |
| **Auto-HTTPS** | Caddy provides automatic Let's Encrypt certificates |
| **Security Headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |
| **Environment Secrets** | All secrets (DB passwords, API keys, JWT secret) stored in `.env` files, never in code |
| **Upload Limits** | 10 MB maximum file upload size |
| **Internal Network** | Only Caddy is exposed externally; backend, frontend, database, and MinIO are internal |

---

## 11. Seed Data and Test Accounts

### Seed Script (`create_test_users.py`)

The seed script populates the database with test data for development and demonstration. Automated test suites (unit, integration, end-to-end) are planned for future development.

**Test Accounts (all use password: `password123`):**

| Role | Name | Identifier |
|---|---|---|
| Coordinator | Admin Coordinator | admin@airserve.com |
| Coordinator | John Admin | john.admin@airserve.com |
| Technician | Benjamin Loh | Phone: 92222221 |
| Technician | Wang Richie | Phone: 92222222 |
| Technician | Timothy Neam | Phone: 92222223 |
| Customer | Alice Tan | alice.tan@example.com |
| Customer | Bob Lee | bob.lee@example.com |
| Customer | Charlie Wong | charlie.wong@example.com |
| Customer | Diana Lim | diana.lim@example.com |

**Catalog Entries:**
- Daikin (multiple models)
- Mitsubishi Electric (multiple models)
- Panasonic (multiple models)

**Activation:** Set `RUN_SEED=true` in `.env` before first container start.

---

## 12. Repository and Branch Structure

### Remote Repositories

| Name | URL | Purpose |
|---|---|---|
| `origin` | github.com/Tendeeznutz/PSDdeploy2 | Primary deployment fork |
| `upstream` | github.com/drpeteryau/ay2526-tp-j | Original course repository |
| `cloudnative` | github.com/Tendeeznutz/PSDCloudNative | Cloud-native exploration |

### Key Branches

| Branch | Description |
|---|---|
| `dockerized` | **Current.** Full Docker Compose deployment with Caddy, MinIO, PostgreSQL |
| `server-push` | Bare-metal VPS deployment (Nginx + systemd) |
| `main` | Stable baseline |
| `dan-frontend-included` | Next.js customer frontend integration |
| `cloud-native-deploy` | Kubernetes/cloud-native deployment exploration |
| `feat/fixes` | Feature fixes and patches |

### Directory Structure

```
PSDdeploy2/
├── .github/workflows/          # CI/CD pipeline definitions
├── .env.example                # Environment variable template
├── docker-compose.yml          # Docker orchestration
├── deploy-docker.sh            # Docker deployment script
│
├── infra/
│   ├── backend/
│   │   ├── Dockerfile          # Django container build
│   │   └── entrypoint.sh       # Container initialization
│   ├── frontend/
│   │   └── Dockerfile          # Next.js container build
│   ├── caddy/
│   │   └── Caddyfile           # Reverse proxy configuration
│   └── db/
│       └── init.sql            # PostgreSQL initialization
│
├── customer-frontend2/         # Next.js 14 customer frontend
│   ├── app/                    # Pages and routes
│   ├── components/             # Reusable React components
│   ├── lib/                    # API client, store, types, constants
│   ├── package.json
│   └── README.md
│
├── Integrated_Scheduling_System-master/
│   ├── appointment_scheduling/
│   │   ├── backend_api/        # Django app (models, views, serializers)
│   │   │   ├── models.py
│   │   │   ├── urls.py
│   │   │   ├── views/          # ViewSet implementations
│   │   │   ├── utils/          # Email, notifications, Telegram, JWT
│   │   │   └── scheduling_algo.py
│   │   ├── appointment_scheduling/  # Django project settings
│   │   │   ├── settings.py
│   │   │   └── urls.py
│   │   ├── frontend/           # Legacy React frontend
│   │   ├── create_test_users.py
│   │   ├── deploy.sh           # Bare-metal deployment
│   │   ├── requirements.txt
│   │   └── manage.py
│   ├── deployment/             # VPS setup scripts and configs
│   │   ├── deploy.sh           # First-time VPS provisioning
│   │   ├── nginx-airserve.conf
│   │   └── airserve.service
│   └── README.md
│
├── CO8 report.docx             # Project report
└── g24_slides.pptx             # Presentation slides
```

---

## 13. Key Features Summary

### Customer-Facing Features

- Online aircon servicing appointment booking with 5-step wizard
- Guest booking without requiring an account
- Real-time availability checking with technician schedule awareness
- Interactive price estimator with service and add-on calculator
- Downloadable PDF invoices on booking confirmation
- Appointment management dashboard (view, reschedule, cancel)
- Aircon device registration and management
- Post-service technician rating system (1-5 stars)
- Internal messaging system with coordinator and technician
- Telegram account linking for real-time notifications
- Password recovery via email token
- Session security with inactivity timeout

### Technician-Facing Features

- Dedicated login and dashboard (via legacy frontend)
- Availability schedule management (weekly recurring + specific dates)
- Appointment assignment based on proximity and specialization
- Profile management with travel type and specialization settings
- Customer rating visibility
- Telegram notification integration

### Coordinator/Admin Features

- Administrative dashboard (via legacy frontend)
- Full appointment oversight across all customers and technicians
- Technician management (create, activate, deactivate)
- Three-stage technician hiring application review
- Aircon catalog management with CSV bulk import
- Customer management and penalty oversight
- Message system access across all roles
- Audit log for sensitive operations

### System/Platform Features

- Containerized deployment with Docker Compose
- Automatic HTTPS via Caddy + Let's Encrypt
- S3-compatible media storage via MinIO
- Dual deployment paths (Docker and bare-metal VPS)
- CI/CD pipeline via GitHub Actions
- Health check endpoints on all services
- Environment-based configuration (no hardcoded secrets)
- Seed data script for rapid environment setup

---

## 14. Future Considerations

Based on the current state of the repository, potential areas for future development include:

1. **Frontend Consolidation:** Migrating coordinator and technician interfaces from the legacy React frontend to the modern Next.js application, creating a unified single frontend.
2. **Cloud-Native Deployment:** The `cloud-native-deploy` branch suggests exploration of Kubernetes for scalable, production-grade deployments.
3. **Push Notifications:** Extending the Telegram integration to support web push notifications via service workers.
4. **Automated Testing:** Adding unit tests, integration tests, and end-to-end tests to the CI/CD pipeline.
5. **Real-Time Features:** Implementing WebSocket-based real-time updates for appointment status changes and messaging.
6. **Payment Integration:** Connecting with payment gateways (Stripe, PayNow API) for actual payment processing beyond manual methods.
7. **Analytics Dashboard:** Building coordinator analytics for service demand trends, technician performance metrics, and revenue tracking.

---

*This document provides a comprehensive overview of the AirServe Integrated Aircon Scheduling System as implemented in the PSDdeploy2 repository on the `dockerized` branch.*
