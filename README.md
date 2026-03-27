# AirServe

**Book premium aircon servicing with trusted technicians in Singapore.**

AirServe is a booking platform that connects customers who need air conditioning services with nearby qualified technicians. Coordinators manage the day-to-day operations, technician assignments, and hiring.

![React](https://img.shields.io/badge/Next.js-%23000000?logo=nextdotjs&labelColor=%23000000)
![Django](https://img.shields.io/badge/Django-%23092E20?logo=django&labelColor=%23000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%234169E1?logo=postgresql&labelColor=%23000000&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-%232496ED?logo=docker&labelColor=%23000000&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-%2306B6D4?logo=tailwindcss&labelColor=%23000000&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-%233178C6?logo=typescript&labelColor=%23000000&logoColor=white)

---

## What Can It Do?

| Feature | Description |
|---------|-------------|
| **5-Step Booking** | Customers pick a service, enter their address, choose a date and time, confirm contact details, and pay |
| **Smart Technician Matching** | The system finds the nearest available technician who specialises in the customer's aircon brand |
| **Guest Booking** | No account needed to book; the system creates a temporary account automatically |
| **Rescheduling** | Free changes up to 24 hours before the appointment |
| **Cancellation Penalties** | 5 free cancellations per month; $20 fee for each one after that |
| **Telegram Notifications** | Link a Telegram account to receive reminders 24 hours and 1 hour before each appointment |
| **Email Receipts** | Booking confirmations, cancellation notices, and downloadable PDF invoices |
| **Technician Hiring** | Three-stage application: personal details, bank information, and coordinator approval |
| **Coordinator Dashboard** | Full oversight of all appointments, technician management, and system activity |

---

## Quick Start (Docker)

> **You need:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone the repository
git clone https://github.com/Tendeeznutz/PSDdeploy2.git
cd PSDdeploy2
git checkout dockerized

# 2. Copy the example environment file and edit as needed
cp .env.example .env

# 3. Build and start all services
docker compose build
docker compose up -d
```

The application will be available at **http://localhost** (or the port set in your `.env` file).

To stop everything:

```bash
docker compose down
```

### What Gets Started

| Service | What It Does |
|---------|-------------|
| **Caddy** | Handles incoming web traffic and routes it to the right place |
| **Frontend** | The customer-facing website |
| **Backend** | Processes bookings, manages data, sends emails |
| **Database** | Stores all accounts, appointments, and records |
| **MinIO** | Stores uploaded files (profile photos, documents) |

---

## Quick Start (Local Development)

For running without Docker (useful for development and debugging):

### Backend

```bash
cd Integrated_Scheduling_System-master/appointment_scheduling

# Create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (OneMap credentials, email password, etc.)

# Set up the database (SQLite is used automatically for local development)
python manage.py migrate

# (Optional) Create test accounts
python create_test_users.py

# Start the backend
python manage.py runserver
```

Backend runs at **http://127.0.0.1:8000**

> **Note:** Local development uses SQLite by default (no database installation needed). PostgreSQL is only required for Docker/production deployments.

### Frontend

Open a second terminal:

```bash
cd customer-frontend2
npm install

# (Optional) Point the frontend to your local backend
# Create a .env.local file with:
#   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api

npm run dev
```

Frontend runs at **http://localhost:3000**

> The frontend works without the backend using a built-in demo account. Log in with `test@hotmail.com` / `123` to explore the UI with mock data. See [Demo Credentials](#demo-credentials) below.

---

## Test Accounts

All test accounts use the password: **`password123`**

### Customers

Log in with **email** at the customer portal.

| Name | Email | Phone | Address |
|------|-------|-------|---------|
| Alice Tan | alice.tan@email.com | 93333331 | Block 123 Ang Mo Kio Avenue 3 |
| Bob Lee | bob.lee@email.com | 93333332 | Block 456 Bedok North Street 1 |
| Charlie Wong | charlie.wong@email.com | 93333333 | Block 789 Jurong West Street 65 |
| Diana Lim | diana.lim@email.com | 93333334 | Block 101 Tampines Street 11 |

### Technicians

Log in with **phone number** at `/technicianlogin`.

| Name | Phone (Login) | Address |
|------|---------------|---------|
| Benjamin Loh | 92222221 | Block 500 Bishan Street 11 |

### Coordinators

Log in with **email** at `/coordinatorlogin`.

| Name | Email |
|------|-------|
| Admin Coordinator | admin@airserve.com |
| John Admin | john.admin@airserve.com |

### Demo Credentials (No Backend Required)

The frontend includes a built-in demo mode:

| Field | Value |
|-------|-------|
| Email | `test@hotmail.com` |
| Password | `123` |

This uses local mock data so you can explore the UI without running any servers.

---

## How to Use the System

### As a Customer

1. Go to the home page and click **Book a Visit** (or create an account first)
2. Follow the 5-step booking wizard: pick a service, enter your address, choose a date and time, confirm your details, and select a payment method
3. Receive a confirmation email with an invoice you can download as PDF
4. View, reschedule, or cancel your appointments from the **Dashboard**
5. Manage your profile, aircon devices, and messages from the **Profile** page

### As a Technician

1. Log in at `/technicianlogin` using your **phone number**
2. View your assigned appointments on the dashboard
3. Update appointment status as you work through each job
4. Set your weekly availability schedule

### As a Coordinator

1. Log in at `/coordinatorlogin` using your email
2. View and manage all appointments across the system
3. Reassign technicians to appointments as needed
4. Review and approve new technician applications
5. Monitor system activity and manage user accounts

---

## Services Offered

| Service | Starting Price | Description |
|---------|---------------|-------------|
| General Servicing | $50/unit | Routine cleaning and maintenance |
| Chemical Wash | $80/unit | Deep chemical cleaning for heavily soiled units |
| Troubleshooting | $60/visit | Diagnosis and repair of aircon issues |
| Installation | $150 flat | New aircon unit installation |
| Gas Top-Up | $80 flat | Refrigerant recharge |

**Additional fees:** $10 travel fee per visit. Optional add-ons include filter replacement ($30), extended warranty ($50), and priority service ($20).

---

## Project Structure

```
PSDdeploy2/
├── customer-frontend2/        Customer website (Next.js)
├── Integrated_Scheduling_System-master/
│   └── appointment_scheduling/ Backend API (Django)
├── infra/                     Docker and server configuration
│   ├── backend/               Backend Dockerfile and startup script
│   ├── frontend/              Frontend Dockerfile
│   ├── caddy/                 Web server configuration
│   └── db/                    Database initialisation
├── docker-compose.yml         Runs all services together
├── .env.example               Environment variable template
└── PROJECT_DOCUMENTATION.md   Full technical documentation
```

---

## Documentation

| Document | Location | Audience |
|----------|----------|----------|
| **This README** | `README.md` | Everyone |
| **Full Technical Docs** | [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) | Developers |
| **Backend Reference** | [`Integrated_Scheduling_System-master/BACKEND_REFERENCE.md`](Integrated_Scheduling_System-master/BACKEND_REFERENCE.md) | Backend developers |
| **Frontend Reference** | [`customer-frontend2/FRONTEND_REFERENCE.md`](customer-frontend2/FRONTEND_REFERENCE.md) | Frontend developers |
| **Technician Availability** | [`Integrated_Scheduling_System-master/TECHNICIAN_AVAILABILITY_GUIDE.md`](Integrated_Scheduling_System-master/TECHNICIAN_AVAILABILITY_GUIDE.md) | Backend developers |
| **Penalty System** | [`Integrated_Scheduling_System-master/PENALTY_SYSTEM.md`](Integrated_Scheduling_System-master/PENALTY_SYSTEM.md) | Backend developers |
| **Guest Booking** | [`Integrated_Scheduling_System-master/GUEST_BOOKING_SYSTEM.md`](Integrated_Scheduling_System-master/GUEST_BOOKING_SYSTEM.md) | Backend developers |
| **Quick Reference** | [`Integrated_Scheduling_System-master/QUICK_REFERENCE.md`](Integrated_Scheduling_System-master/QUICK_REFERENCE.md) | Backend developers |

---

## Branches

| Branch | Purpose |
|--------|---------|
| `dockerized` | Production-ready Docker Compose deployment |
| `server-push` | CI/CD with GitHub Actions and server deployment |
| `main` | Stable release |
| `dan-frontend-included` | Frontend source development |

---

## Contributors

| Name | Student ID |
|------|-----------|
| Benjamin Loh Choon How | 2201590 |
| Wang Rongqi Richie | 2201942 |
| Neam Heng Chong Timothy | 2201291 |
| Loo Siong Yu | 2201255 |
| Lee Zheng Han | 2201085 |
| Efilio Yodia Garcia | 2200516 |

Singapore Institute of Technology

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Docker containers won't start | Make sure Docker Desktop is running. Try `docker compose down` then `docker compose up -d` |
| Port already in use | Another application is using the same port. Stop it or change the port in `.env` |
| Frontend shows blank page | Clear your browser cache or try incognito mode |
| Login fails | Customers use **email**, technicians use **phone number**. Password is `password123` for test accounts |
| Backend errors | Check logs with `docker compose logs backend` |
| Database issues | Reset with `docker compose down -v` (this deletes all data) then `docker compose up -d` |

---

**Last Updated:** March 2026
