# Test Accounts for PSD AirServe

All test accounts use the password: **`password123`**

## Coordinator Accounts

| Name | Email | Phone | Password |
|------|-------|-------|----------|
| Admin Coordinator | admin@airserve.com | 91111111 | password123 |
| John Admin | john.admin@airserve.com | 91111112 | password123 |

## Technician Accounts

| Name | Email | Phone | Postal Code | Travel Type | Password |
|------|-------|-------|-------------|-------------|----------|
| Benjamin Loh | benjamin.tech@airserve.com | 92222221 | 520123 | drive | password123 |
| Wang Richie | richie.tech@airserve.com | 92222222 | 560123 | cycle | password123 |
| Timothy Neam | timothy.tech@airserve.com | 92222223 | 640123 | walk | password123 |

## Customer Accounts

| Name | Email | Phone | Postal Code | Address | Password |
|------|-------|-------|-------------|---------|----------|
| Alice Tan | alice.tan@email.com | 93333331 | 560123 | Block 123 Ang Mo Kio Avenue 3 | password123 |
| Bob Lee | bob.lee@email.com | 93333332 | 460456 | Block 456 Bedok North Street 1 | password123 |
| Charlie Wong | charlie.wong@email.com | 93333333 | 640789 | Block 789 Jurong West Street 65 | password123 |
| Diana Lim | diana.lim@email.com | 93333334 | 521101 | Block 101 Tampines Street 11 | password123 |

---

## Additional Test Data (from API test file)

Based on the `API_test.http` file, the following accounts may also exist:

- **Customer Email**: `janesmith@email.com` - Password: `password`
- **Customer Email**: `test@test.com` - Password: `testpassword`
- **Customer Email**: `richie@gmail.com`, `richie1@gmail.com` - Password: `password`

---

## How to Create All Test Accounts

Run the following command:
```bash
python create_test_users.py
```

This will create all the accounts listed above if they don't already exist.

---

## Access URLs

- **Frontend (Login)**: http://localhost:3000/
- **Backend API**: http://127.0.0.1:8000/api/
- **Django Admin**: http://127.0.0.1:8000/admin/

---

## Login Flow

### Customer Login
1. Go to http://localhost:3000/
2. Click "Customer Login" or navigate to login page
3. Enter email and password (password123)

### Technician Login
1. Go to http://localhost:3000/technicianlogin
2. Enter email and password (password123)

### Coordinator Login
1. Access the coordinator login page
2. Enter email: admin@airserve.com
3. Password: password123

---

## Notes

- Passwords are stored in **plain text** in the database (security issue noted in review)
- All phone numbers follow Singapore format (8 digits)
- All postal codes are Singapore postal codes (6 digits)
- Geolocation features require OneMap API credentials in `.env` file
