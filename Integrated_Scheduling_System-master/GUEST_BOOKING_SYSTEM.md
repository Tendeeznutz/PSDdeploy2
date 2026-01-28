# Guest Booking System

## Overview
The guest booking system allows first-time customers to book aircon servicing appointments without creating an account. This streamlines the booking process and reduces friction for customers who need one-time service.

## Features

### 1. Simplified Booking Process
- No account creation required
- Minimal form fields (only essential information)
- Direct email confirmation to customer
- Automatic appointment creation

### 2. Required Information
Customers only need to provide:
- **Name**: Full name
- **Phone Number**: Singapore mobile number (8 digits starting with 6, 8, or 9)
- **Email**: Valid email address for confirmation
- **Address**: Service address
- **Postal Code**: 6-digit Singapore postal code
- **Aircon Brand**: Brand of aircon to be serviced
- **Aircon Model**: (Optional) Model information
- **Appointment Date & Time**: Preferred service date and time
- **Payment Method**: Cash, Card, PayNow, or Bank Transfer

### 3. Customer Handling

#### New Customers
- System creates a temporary guest customer account
- Random password generated (format: `GUEST_ACCOUNT_XXXXXXXX`)
- Customer can later upgrade to full account if desired

#### Existing Customers
- System checks phone number and email against database
- If match found, uses existing customer record
- No duplicate accounts created

## API Endpoint

### Create Guest Booking
```
POST /api/appointments/guest-booking/
```

**Request Body:**
```json
{
  "customerName": "John Doe",
  "customerPhone": "91234567",
  "customerEmail": "john@example.com",
  "customerAddress": "123 Main Street #01-01",
  "customerPostalCode": "123456",
  "airconBrand": "Daikin",
  "airconModel": "Inverter 1.5HP",
  "appointmentStartTime": 1706006400,
  "paymentMethod": "cash"
}
```

**Response (Success - 201):**
```json
{
  "message": "Booking created successfully! A confirmation email has been sent.",
  "appointment": {
    "id": "uuid-here",
    "appointmentStartTime": 1706006400,
    "appointmentEndTime": 1706010000,
    "appointmentStatus": "1",
    "paymentMethod": "cash",
    ...
  },
  "customerId": "customer-uuid",
  "isGuestBooking": true
}
```

**Response (Error - 400/500):**
```json
{
  "error": "Error message describing what went wrong"
}
```

## Frontend Flow

### 1. Access Points
Users can access guest booking from:
- Login page: "Quick Booking (No Account Required)" button
- Direct URL: `/guest-booking`

### 2. Form Validation
The system validates:
- All required fields are filled
- Singapore phone number format (8 digits, starts with 6/8/9)
- Valid email format
- Valid postal code (6 digits)
- Valid date and time selection (no past dates)

### 3. Booking Process
1. User fills in the guest booking form
2. Selects preferred date and time
3. Chooses payment method
4. Reviews cost breakdown ($50 service + $10 travel = $60)
5. Submits booking
6. Receives confirmation message
7. Confirmation email sent to provided email address
8. Redirected to homepage after 3 seconds

## Email Confirmation

Guests receive an email with:
- Booking reference number
- Appointment date and time
- Aircon details
- Service address
- Cost breakdown
- Payment method
- Coordinator approval notice

**Sample Email:**
```
Dear John Doe,

Thank you for booking with AirServe!

Your appointment has been confirmed and is pending coordinator approval.

APPOINTMENT DETAILS
===================
Booking Reference: A1B2C3D4
Date & Time: January 23, 2026 at 02:00 PM
Aircon: Daikin - Inverter 1.5HP
Address: 123 Main Street #01-01, Singapore 123456

COST BREAKDOWN
==============
Service Fee (1 aircon x $50):    $50.00
Travel Fee:                       $10.00
-------------------------------------------
TOTAL AMOUNT:                     $60.00

Payment Method: Cash

A coordinator will review and approve your appointment shortly.

Thank you for choosing AirServe!
```

## Backend Processing

### 1. Customer Creation/Lookup
```python
# Check for existing customer
existing_customer = Customers.objects.filter(
    models.Q(customerPhone=phone) | models.Q(customerEmail=email)
).first()

if existing_customer:
    customer = existing_customer  # Use existing
else:
    # Create new guest customer
    customer = Customers.objects.create(
        customerName=name,
        customerPhone=phone,
        customerEmail=email,
        customerAddress=address,
        customerPostalCode=postal_code,
        customerPassword='GUEST_ACCOUNT_' + str(uuid.uuid4())[:8]
    )
```

### 2. Aircon Device Creation
```python
# Create temporary aircon device
aircon_device = CustomerAirconDevices.objects.create(
    customerId=customer,
    airconName=f"{aircon_brand} - {aircon_model}",
    airconBrand=aircon_brand,
    airconModel=aircon_model,
    isActive=True
)
```

### 3. Technician Assignment
- Gets nearby technicians based on customer location
- Checks for scheduling conflicts
- Assigns first available technician
- Falls back to closest technician if all are busy

### 4. Appointment Creation
- Status: '1' (Pending coordinator approval)
- Duration: 1 hour (1 aircon)
- Includes travel distance calculation
- Links aircon device to appointment

## Cost Structure

**Standard Guest Booking:**
- Service Fee: $50 per aircon
- Travel Fee: $10
- **Total: $60** (for 1 aircon unit)

**Note:** Guest bookings are limited to 1 aircon unit. For multiple units, customers should create an account for better management.

## User Experience Benefits

1. **No Registration Friction**: Customers can book immediately without creating an account
2. **Fast Process**: Minimal form fields reduce completion time
3. **Email Confirmation**: Direct notification to customer's email
4. **Transparency**: Clear cost breakdown shown upfront
5. **Flexibility**: Option to create account later if needed

## Coordinator Workflow

After guest booking:
1. Appointment appears in coordinator dashboard
2. Status: "Pending Admin Action" (status '1')
3. Coordinator reviews and approves
4. Technician is notified
5. Customer receives updates via email

## Future Enhancements

Potential improvements:
- SMS confirmation in addition to email
- Guest booking tracking page (via booking reference)
- Multi-aircon support for guest bookings
- Customer upgrade prompt (guest to full account)
- Booking modification/cancellation without login
- Real-time availability checking

## Testing

### Test Cases:
1. **New Guest Booking**: Create booking with new phone/email - should create new customer
2. **Existing Customer**: Use existing phone/email - should reuse customer record
3. **Validation**: Submit invalid phone/email - should show error
4. **Past Date**: Try to book past date - should be disabled
5. **Email Delivery**: Confirm email reaches customer inbox
6. **Coordinator View**: Check appointment appears in coordinator dashboard

### Test Data:
```javascript
{
  "customerName": "Test Guest",
  "customerPhone": "91234567",
  "customerEmail": "test@example.com",
  "customerAddress": "123 Test Street #01-01",
  "customerPostalCode": "123456",
  "airconBrand": "Daikin",
  "airconModel": "Test Model",
  "appointmentStartTime": 1706006400,
  "paymentMethod": "cash"
}
```

## Files Modified/Created

### Backend:
- `backend_api/views/appointment_views.py`: Added `guest_booking()` action

### Frontend:
- `frontend/src/pages/GuestBooking.js`: New page component
- `frontend/src/pages/Login.js`: Added guest booking link
- `frontend/src/index.js`: Added route for `/guest-booking`

### Documentation:
- `GUEST_BOOKING_SYSTEM.md`: This file

## Security Considerations

1. **Guest Passwords**: Random, non-guessable passwords prevent unauthorized access
2. **Email Verification**: Confirmation sent to provided email validates ownership
3. **Phone Validation**: Singapore number format ensures valid contact
4. **Duplicate Prevention**: Checks existing customers to avoid account duplication
5. **Data Privacy**: Guest accounts have same security as regular accounts

## Support

For issues or questions:
- Backend API errors: Check Django server logs
- Frontend issues: Check browser console
- Email not received: Verify email configuration in `utils/sendMail.py`
