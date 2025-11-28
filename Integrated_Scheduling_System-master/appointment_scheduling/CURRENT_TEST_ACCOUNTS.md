# 🔐 Current Test Accounts in Database

## 📝 Summary
All accounts use the password: **`password123`**

---

## 👔 COORDINATOR ACCOUNTS

| Name | Email | Phone | Password |
|------|-------|-------|----------|
| Admin Coordinator | admin@airserve.com | 91111111 | password123 |

### Login URL
- Coordinator login: http://localhost:3000/coordinatorlogin (or check frontend routing)

---

## 👤 CUSTOMER ACCOUNTS

| Name | Email | Phone | Password |
|------|-------|-------|----------|
| Alice Tan | alice.tan@email.com | 93333331 | password123 |
| Bob Lee | bob.lee@email.com | 93333332 | password123 |

### Login URL
- Customer login: http://localhost:3000/ or http://localhost:3000/login

### Customer Addresses
- **Alice Tan**: Block 123 Ang Mo Kio Avenue 3, Postal Code: 560123
- **Bob Lee**: Block 456 Bedok North Street 1, Postal Code: 460456

---

## 🔧 TECHNICIAN ACCOUNTS

**IMPORTANT**: Technicians do NOT have email addresses in the database model. They login using phone numbers.

| Name | Phone (Login) | Postal Code | Travel Type | Password |
|------|---------------|-------------|-------------|----------|
| Benjamin Loh | 92222221 | 520123 | drive | password123 |
| Wang Richie | 92222222 | 560123 | cycle | password123 |

### Login URL
- Technician login: http://localhost:3000/technicianlogin

### Technician Details
- **Benjamin Loh**: Block 500 Bishan Street 11, Travels by: Car (drive)
- **Wang Richie**: Block 560 Ang Mo Kio Avenue 10, Travels by: Bicycle (cycle)

---

## 🌬️ AIRCON CATALOG

Current available air conditioner models:

| Brand | Model |
|-------|-------|
| Daikin | System 1 |
| Mitsubishi | MSY-GE10VA |
| Panasonic | CS-PU9WKH |

---

## 🔑 Login Instructions

### Customer Login
1. Go to http://localhost:3000/
2. Enter email: `alice.tan@email.com` or `bob.lee@email.com`
3. Enter password: `password123`

### Technician Login
1. Go to http://localhost:3000/technicianlogin
2. Enter phone: `92222221` or `92222222`
3. Enter password: `password123`

### Coordinator Login
1. Find the coordinator login page (check navigation)
2. Enter email: `admin@airserve.com`
3. Enter password: `password123`

---

## 📊 Database Statistics

- **Coordinators**: 1
- **Customers**: 2
- **Technicians**: 2
- **Aircon Models**: 3
- **Appointments**: 0 (none created yet)

---

## ⚠️ Important Notes

1. **Passwords are stored in PLAIN TEXT** in the database (security issue)
2. **Phone numbers** must be 8 digits (Singapore format)
3. **Postal codes** must be 6 digits (Singapore format)
4. **Technicians login with PHONE NUMBER**, not email
5. **Customers login with EMAIL**, not phone
6. **Geolocation features** require OneMap API credentials in `.env` file

---

## 🛠️ Testing Workflow

### Create an Appointment
1. Login as **Customer** (alice.tan@email.com / password123)
2. Navigate to "Schedule Appointment"
3. Select an aircon device (or add one first from profile)
4. Choose date/time
5. System will auto-assign technician based on location

### View as Technician
1. Login as **Technician** (92222221 / password123)
2. View assigned appointments
3. Update appointment status
4. Complete servicing

### Manage as Coordinator
1. Login as **Coordinator** (admin@airserve.com / password123)
2. View all appointments
3. Reassign technicians
4. Monitor system activity

---

## 🔧 Add More Test Data

To add more users, you can use the Django shell or the registration pages:

```bash
cd "c:\UniPain\Year 2 Tri 1\githublocalrepothrowinhere\PSDpullagain\psd_airserve\Integrated_Scheduling_System-master\appointment_scheduling"
python manage.py shell
```

Then:
```python
from backend_api.models import Customers, Technicians, Coordinators

# Create a customer
customer = Customers.objects.create(
    customerName="Charlie Wong",
    customerEmail="charlie@email.com",
    customerPhone="93333333",
    customerPassword="password123",
    customerAddress="Block 789 Jurong West",
    customerPostalCode="640789",
    customerLocation="1.34,103.70"
)

# Create a technician (NO EMAIL!)
technician = Technicians.objects.create(
    technicianName="Timothy Neam",
    technicianAddress="Block 640 Jurong West St 61",
    technicianPhone="92222223",
    technicianPassword="password123",
    technicianPostalCode="640123",
    technicianLocation="1.34,103.84",
    technicianStatus="1",  # "1" = Available
    technicianTravelType="walk"  # walk, cycle, or drive
)
```

---

## 🌐 Quick Links

- **Frontend**: http://localhost:3000/
- **Backend API**: http://127.0.0.1:8000/api/
- **Django Admin** (if superuser created): http://127.0.0.1:8000/admin/
- **API Endpoints**:
  - Customers: http://127.0.0.1:8000/api/customers/
  - Technicians: http://127.0.0.1:8000/api/technicians/
  - Coordinators: http://127.0.0.1:8000/api/coordinators/
  - Appointments: http://127.0.0.1:8000/api/appointments/
  - Aircon Catalog: http://127.0.0.1:8000/api/airconcatalogs/

---

**Last Updated**: 2025-11-28
