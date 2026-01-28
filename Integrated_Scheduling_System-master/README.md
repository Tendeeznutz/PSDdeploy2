# AirServe - Integrated Appointment Scheduling System
### Air Conditioning Servicing Industry

## About This Project

AirServe is a social enterprise platform designed to empower low-income earners by providing them opportunities to become skilled technicians in the air conditioning servicing industry. The system connects customers who need aircon services with nearby technicians, while coordinators manage the overall operations.

**Tech Stack**

![React](https://img.shields.io/badge/React-%233399ff?logo=react&labelColor=%23000000)
![Django](https://img.shields.io/badge/Django-%233399ff?logo=django&labelColor=%23000000)
![tailwindcss](https://img.shields.io/badge/Tailwindcss-%2300cc44?logo=tailwindcss&labelColor=%23000000)
![antdesign](https://img.shields.io/badge/AntDesign-%23ff6666?logo=antdesign&labelColor=%23000000)
![materialdesign](https://img.shields.io/badge/MaterialDesign-%23009999?logo=materialdesign&labelColor=%23000000)
![Sqlite](https://img.shields.io/badge/Sqlite-%23009933?logo=sqlite&labelColor=%23000000)
![Vercel](https://img.shields.io/badge/Vercel-%23000000?logo=vercel&labelColor=%23000000)
![Azure](https://img.shields.io/badge/Azure-%23b3ffff?logo=azuredevops&labelColor=%23000000)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
2. [Test Accounts](#2-test-accounts)
   - [Coordinator Accounts](#coordinator-accounts)
   - [Customer Accounts](#customer-accounts)
   - [Technician Accounts](#technician-accounts)
3. [Application URLs](#3-application-urls)
4. [How to Use the System](#4-how-to-use-the-system)
5. [Deployment Guide](#5-deployment-guide)
   - [Server Requirements](#server-requirements)
   - [Services Used](#services-used)
   - [Step-by-Step Deployment](#step-by-step-deployment)
6. [API Reference](#6-api-reference)
7. [Project Information](#7-project-information)
   - [Pain Points](#pain-points-during-development)
   - [Limitations](#limitations)
   - [Future Works](#future-works)
8. [Contributors](#8-contributors)
9. [Troubleshooting](#9-troubleshooting)
10. [Version History](#10-version-history)

---

# 1. Getting Started

## Prerequisites

Before you begin, ensure you have the following installed on your computer:

| Software | Version | Download Link |
|----------|---------|---------------|
| Python | 3.9 or higher | https://www.python.org/downloads/ |
| Node.js | 16 or higher | https://nodejs.org/ |
| Git | Latest | https://git-scm.com/downloads |

---

## Installation

Follow these steps to run the application on your local machine.

### Step 1: Clone the Repository

Open a terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
git clone https://github.com/soyabean777/psd_airserve.git
```

---

### Step 2: Set Up the Backend (Django)

The backend handles all data processing, API requests, and database operations.

**For Windows Users:**
```bash
cd psd_airserve\Integrated_Scheduling_System-master\appointment_scheduling
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**For Mac/Linux Users:**
```bash
cd psd_airserve/Integrated_Scheduling_System-master/appointment_scheduling
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

You should see:
```
Starting development server at http://127.0.0.1:8000/
```

**Keep this terminal open!** The backend server must stay running.

---

### Step 3: Set Up the Frontend (React)

Open a **NEW terminal window** (do not close the backend terminal) and run:

**For Windows Users:**
```bash
cd psd_airserve\Integrated_Scheduling_System-master\appointment_scheduling\frontend
npm install
npm start
```

**For Mac/Linux Users:**
```bash
cd psd_airserve/Integrated_Scheduling_System-master/appointment_scheduling/frontend
npm install
npm start
```

You should see:
```
Compiled successfully!
You can now view frontend in the browser.
  Local: http://localhost:3000
```

Your browser should automatically open to http://localhost:3000

---

### Quick Reference: Starting the Application

Once installed, use these commands to start the application:

| Terminal | Purpose | Commands |
|----------|---------|----------|
| Terminal 1 | Backend | `cd appointment_scheduling` → `.venv\Scripts\activate` → `python manage.py runserver` |
| Terminal 2 | Frontend | `cd appointment_scheduling\frontend` → `npm start` |

---

# 2. Test Accounts

All test accounts use the password: **`password123`**

## Coordinator Accounts

Coordinators manage the system, approve appointments, and oversee technicians.

| Name | Email | Phone | Password |
|------|-------|-------|----------|
| Admin Coordinator | admin@airserve.com | 91111111 | password123 |
| John Admin | john.admin@airserve.com | 91111112 | password123 |

**Login URL:** http://localhost:3000/coordinatorlogin

---

## Customer Accounts

Customers book aircon servicing appointments.

| Name | Email | Phone | Address | Postal Code |
|------|-------|-------|---------|-------------|
| Alice Tan | alice.tan@email.com | 93333331 | Block 123 Ang Mo Kio Avenue 3 | 560123 |
| Bob Lee | bob.lee@email.com | 93333332 | Block 456 Bedok North Street 1 | 460456 |
| Charlie Wong | charlie.wong@email.com | 93333333 | Block 789 Jurong West Street 65 | 640789 |
| Diana Lim | diana.lim@email.com | 93333334 | Block 101 Tampines Street 11 | 521101 |

**Login URL:** http://localhost:3000/ or http://localhost:3000/login

**Note:** Customers login with their **EMAIL address**.

---

## Technician Accounts

Technicians perform the aircon servicing. **IMPORTANT: Technicians login with their PHONE NUMBER, not email.**

| Name | Phone (Login) | Postal Code | Travel Type | Address |
|------|---------------|-------------|-------------|---------|
| Benjamin Loh | 92222221 | 520123 | Car (drive) | Block 500 Bishan Street 11 |
| Wang Richie | 92222222 | 560123 | Bicycle (cycle) | Block 560 Ang Mo Kio Avenue 10 |
| Timothy Neam | 92222223 | 640123 | Walk | Block 640 Jurong West Street 61 |

**Login URL:** http://localhost:3000/technicianlogin

---

## Aircon Catalog

Available air conditioner models in the system:

| Brand | Model |
|-------|-------|
| Daikin | System 1 |
| Mitsubishi | MSY-GE10VA |
| Panasonic | CS-PU9WKH |

---

## Creating Test Accounts

To create all test accounts automatically, run:
```bash
python create_test_users.py
```

---

# 3. Application URLs

## Local Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| Customer Portal | http://localhost:3000/ | Main landing page and customer login |
| Customer Login | http://localhost:3000/login | Customer login page |
| Technician Login | http://localhost:3000/technicianlogin | Technician login page |
| Coordinator Login | http://localhost:3000/coordinatorlogin | Coordinator/Admin login page |
| Backend API | http://127.0.0.1:8000/api/ | REST API root |
| Django Admin | http://127.0.0.1:8000/admin/ | Django administration panel |

---

# 4. How to Use the System

## As a Customer

1. **Login** at http://localhost:3000/ using your email and password
2. **Add your aircon** devices in your profile (if not already added)
3. **Schedule an appointment** by selecting date, time, and aircon unit
4. **View your appointments** and track their status
5. The system automatically assigns a nearby technician

## As a Technician

1. **Login** at http://localhost:3000/technicianlogin using your **phone number** and password
2. **View assigned appointments** on your dashboard
3. **Update appointment status** (in progress, completed, etc.)
4. **Complete servicing** and mark as done

## As a Coordinator

1. **Login** at http://localhost:3000/coordinatorlogin using your email and password
2. **View all appointments** across the system
3. **Reassign technicians** if needed
4. **Monitor system activity** and manage users
5. **Approve new technician applications**

---

# 5. Deployment Guide

This section covers deploying the application to a production server.

## Server Requirements

| Requirement | Specification |
|-------------|---------------|
| Operating System | Ubuntu 20.04 LTS or higher |
| RAM | Minimum 2GB |
| Storage | Minimum 20GB |
| Domain Name | Required for HTTPS |

## Services Used

| Service | Purpose | Notes |
|---------|---------|-------|
| **Gunicorn** | WSGI HTTP Server | Serves the Django application |
| **Nginx** | Reverse Proxy | Handles incoming requests, SSL termination |
| **Certbot** | SSL Certificates | Free HTTPS via Let's Encrypt |
| **SQLite** | Database (Dev) | Default for development |
| **PostgreSQL** | Database (Prod) | Recommended for production |
| **OneMap API** | Geolocation | Singapore address/postal code lookup |

## Step-by-Step Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git -y
```

### 2. Clone and Configure Project

```bash
# Clone repository
git clone https://github.com/soyabean777/psd_airserve.git
cd psd_airserve/Integrated_Scheduling_System-master/appointment_scheduling

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install gunicorn
```

### 3. Configure Django Settings

Edit `appointment_scheduling/settings.py`:

```python
# Add your domain to allowed hosts
ALLOWED_HOSTS = ['your-domain.com', 'www.your-domain.com', 'localhost']

# Update CORS settings
CORS_ORIGIN_WHITELIST = [
    'https://your-domain.com',
    'https://www.your-domain.com',
]

# For production, use PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'airserve_db',
        'USER': 'your_db_user',
        'PASSWORD': 'your_db_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### 4. Run Database Migrations

```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

### 5. Configure Nginx

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/airserve
```

Add the following:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /static/ {
        alias /path/to/your/project/staticfiles/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/airserve /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Enable HTTPS with Certbot

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts to complete SSL setup.

### 7. Run Gunicorn

```bash
# Start a screen session (keeps running after SSH disconnect)
screen -S airserve

# Navigate to project
cd /path/to/psd_airserve/Integrated_Scheduling_System-master/appointment_scheduling

# Activate virtual environment
source .venv/bin/activate

# Run Gunicorn
gunicorn --bind 127.0.0.1:8000 appointment_scheduling.wsgi:application

# Detach from screen: Press Ctrl+A, then D
# Reattach later: screen -r airserve
```

### 8. Environment Variables

Create a `.env` file for sensitive configuration:
```bash
# .env file
SECRET_KEY=your-secret-key-here
DEBUG=False
ONEMAP_API_KEY=your-onemap-api-key
EMAIL_HOST_PASSWORD=your-email-password
```

---

# 6. API Reference

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/customers/` | GET, POST | List/Create customers |
| `/api/customers/{id}/` | GET, PUT, DELETE | Retrieve/Update/Delete customer |
| `/api/technicians/` | GET, POST | List/Create technicians |
| `/api/technicians/{id}/` | GET, PUT, DELETE | Retrieve/Update/Delete technician |
| `/api/coordinators/` | GET, POST | List/Create coordinators |
| `/api/appointments/` | GET, POST | List/Create appointments |
| `/api/appointments/{id}/` | GET, PUT, DELETE | Retrieve/Update/Delete appointment |
| `/api/airconcatalogs/` | GET, POST | List/Create aircon models |

---

# 7. Project Information

## Pain Points During Development

- **Benjamin Loh Choon How:** Debugging issues on the frontend was tricky as I needed to look at both frontend and backend logs. Learning Django and ReactJS was a steep learning curve, and designing UI/UX was challenging with no prior experience.

- **Loo Siong Yu:** Learning Django while doing the project was challenging. Finding how the backend code worked before debugging took many hours. UI/UX was the biggest challenge - making the application responsive according to screen sizes. Overall, it was a good learning experience.

- **Neam Heng Chong Timothy:** First time using Django REST Framework and ReactJS was a huge challenge. Understanding how backend functions communicate with each other and how frontend connects to backend took a long time to figure out. Great learning experience despite the challenges.

## Limitations

| Feature | Status | Description |
|---------|--------|-------------|
| **Notifications** | Not Implemented | Email/SMS reminders for appointments |
| **Security** | Basic | Passwords stored in plain text; no JWT/CSRF tokens |
| **Payment** | Not Implemented | Invoice and payment processing |
| **DateTime Filtering** | Partial | Issues with UNIX timestamp filtering in tables |
| **Service Selection** | Not Implemented | Customers cannot select specific service types |

## Future Works

- **Notifications:** Implement email/SMS notifications using Amazon SNS and cronjobs
- **Security:** Add JWT authentication and CSRF protection
- **Payment:** Integrate Stripe APIs for secure payment processing
- **DateTime Filtering:** Explore alternative storage formats for better filtering
- **Service Selection:** Allow customers to specify service type and aircon brand

---

# 8. Contributors

| Name | Email |
|------|-------|
| Benjamin Loh Choon How | 2201590@sit.singaporetech.edu.sg |
| Wang Rongqi Richie | 2201942@sit.singaporetech.edu.sg |
| Neam Heng Chong Timothy | 2201291@sit.singaporetech.edu.sg |
| Loo Siong Yu | 2201255@sit.singaporetech.edu.sg |
| Lee Zheng Han | 2201085@sit.singaporetech.edu.sg |
| Efilio Yodia Garcia | 2200516@sit.singaporetech.edu.sg |

## Libraries Used

- Tailwind CSS
- Ant Design
- Material-Tailwind
- Django REST Framework

---

# 9. Troubleshooting

## Common Issues

| Issue | Solution |
|-------|----------|
| `pip install` fails | Ensure Python 3.9+ is installed. Try `pip install --upgrade pip` first |
| `npm install` fails | Ensure Node.js 16+ is installed. Delete `node_modules` folder and try again |
| Backend won't start | Check if port 8000 is in use. Run `python manage.py migrate` first |
| Frontend won't start | Check if port 3000 is in use. Ensure backend is running |
| Login fails | Verify you're using correct credentials. Technicians use phone number, customers use email |
| API errors | Check both backend and frontend console logs for detailed error messages |

## Important Notes

1. **Passwords are stored in PLAIN TEXT** in the database (known security issue)
2. **Phone numbers** must be 8 digits (Singapore format)
3. **Postal codes** must be 6 digits (Singapore format)
4. **Technicians login with PHONE NUMBER**, not email
5. **Customers login with EMAIL**, not phone
6. **Geolocation features** require OneMap API credentials in `.env` file

---

# 10. Version History

## Version 1.0.0

- Initial release
- Customer, Technician, and Coordinator portals
- Appointment scheduling system
- Automatic technician assignment based on location
- Basic aircon catalog management

---

**Last Updated:** January 2025
