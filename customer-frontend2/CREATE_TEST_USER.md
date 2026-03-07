# Creating Test User

To create the test user for login, run this command in your terminal:

## Option 1: Using Python directly

```bash
cd appointment_scheduling
python create_test_users.py
```

## Option 2: Using Django manage.py shell

If the script doesn't work, you can create the user manually:

```bash
cd appointment_scheduling
python manage.py shell
```

Then in the shell:

```python
from backend_api.models import Customers
from django.contrib.auth.hashers import make_password

# Create or update test user
test_user, created = Customers.objects.get_or_create(
    customerEmail="test@hotmail.com",
    defaults={
        "customerName": "Test User",
        "customerPhone": "91234567",
        "customerPassword": make_password("123"),
        "customerAddress": "123 Test Street",
        "customerPostalCode": "123456",
        "customerLocation": "1.3000,103.8000"
    }
)

if not created:
    test_user.customerPassword = make_password("123")
    test_user.save()
    print("Updated existing user")
else:
    print("Created new user")

print(f"User: {test_user.customerEmail}, Password: 123")
```

## Login Credentials

- **Email:** test@hotmail.com
- **Password:** 123

## Troubleshooting

If you can't login:
1. Make sure the Django backend is running on `http://127.0.0.1:8000`
2. Check that the user was created successfully
3. Try logging in with the credentials above
4. Check browser console for any API errors
