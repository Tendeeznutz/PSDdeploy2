# Customer Cancellation Penalty System

## Overview
The system automatically tracks customer cancellations and applies penalty fees when customers exceed their monthly cancellation limit.

## Penalty Rules

- **Free Cancellations**: 5 per month
- **Penalty Amount**: $20 per cancellation over the limit
- **Reset Period**: Monthly (resets on the 1st of each month)

## How It Works

### 1. Cancellation Tracking
- Every time a customer cancels an appointment, the system checks their cancellation count for the current month
- If they have cancelled more than 5 appointments, a $20 penalty is automatically added to their `pendingPenaltyFee`

### 2. Penalty Application
When a customer cancels their 6th appointment or more in a month:
- $20 is added to their `pendingPenaltyFee` field
- They receive an automatic notification in their mailbox
- The penalty notification includes:
  - Current month's cancellation count
  - Penalty fee amount
  - Total pending penalty

### 3. Payment Integration
The penalty fee is automatically included in the customer's next appointment receipt:
- Receipt shows: Service Fee + Travel Fee + Penalty Fee (if any)
- Total amount includes all pending penalties
- After payment, penalties should be cleared using the `clear_penalty_fee()` function

## API Endpoints

### Check Penalty Status
```bash
GET /api/appointments/penalty-status/?customerId=<uuid>
```

**Response:**
```json
{
  "current_month_cancellations": 6,
  "remaining_free_cancellations": 0,
  "pending_penalty_fee": "20.00",
  "warning_message": "You have exceeded your monthly cancellation limit by 1 cancellation(s)...",
  "penalty_threshold": 5,
  "penalty_amount": "20.00"
}
```

## Database Schema

### Customers Table
New field added:
- `pendingPenaltyFee` (DecimalField): Accumulated penalty fees

### Appointments Table
Existing fields used:
- `appointmentStatus` = '4' indicates cancellation
- `cancelledAt` (DateTimeField): Timestamp of cancellation
- `cancelledBy` (CharField): Who cancelled (customer/technician/coordinator)
- `cancellationReason` (TextField): Reason for cancellation

## Backend Functions

Located in `backend_api/penalty_utils.py`:

### `get_monthly_cancellation_count(customer_id, month=None, year=None)`
Returns the count of cancelled appointments for a customer in a specific month.

### `check_and_apply_penalty(customer_id)`
Checks if penalty should be applied and adds it to the customer's pending fees.

Returns:
```python
{
    'penalty_applied': bool,
    'cancellation_count': int,
    'penalty_amount': Decimal,
    'total_pending_penalty': Decimal
}
```

### `get_penalty_summary(customer_id)`
Gets a comprehensive summary of penalty information for display to customers.

### `clear_penalty_fee(customer_id, amount=None)`
Clears penalty fees after payment (call this when processing payments).

## User Flow

### For Customers:
1. **Before Cancellation**: Customer can check their penalty status via API
2. **During Cancellation**: System automatically checks and applies penalty if needed
3. **After Cancellation**:
   - Customer receives notification if penalty was applied
   - Warning messages shown when approaching limit
4. **At Booking**: Receipt includes any pending penalties
5. **After Payment**: Penalties are cleared from their account

### For Administrators:
- Can view customer's `pendingPenaltyFee` in admin panel
- Can manually adjust penalties if needed
- Can generate reports on cancellation patterns

## Warning Messages

The system provides progressive warnings:
- **2 or fewer free cancellations left**: "Warning: You have X free cancellation(s) remaining this month."
- **At limit**: "You have reached your cancellation limit for this month. Further cancellations will incur a $20 fee each."
- **Over limit**: "You have exceeded your monthly cancellation limit by X cancellation(s). A $20 penalty per extra cancellation has been added to your next payment."

## Testing

### Test Scenarios:
1. Cancel 5 appointments in a month - no penalty
2. Cancel 6th appointment - $20 penalty applied
3. Cancel 7th appointment - additional $20 penalty (total $40)
4. New month starts - count resets, no penalty for first 5 cancellations
5. Check penalty status at any time via API
6. Book new appointment - receipt includes pending penalties

### Example Test:
```python
# Cancel multiple appointments
for i in range(7):
    # Cancel appointment
    result = check_and_apply_penalty(customer_id)
    print(f"Cancellation {i+1}: Penalty Applied: {result['penalty_applied']}, Total: ${result['total_pending_penalty']}")
```

Expected output:
- Cancellations 1-5: `penalty_applied: False`
- Cancellation 6+: `penalty_applied: True`, penalty increases by $20 each time

## Migration

Migration file created: `backend_api/migrations/0012_customers_pendingpenaltyfee.py`

Run migration:
```bash
python manage.py migrate
```

## Configuration

To change penalty settings, edit `backend_api/penalty_utils.py`:
```python
CANCELLATION_THRESHOLD = 5  # Free cancellations per month
PENALTY_AMOUNT = Decimal('20.00')  # Penalty per excess cancellation
```

## Notes

- Only **customer** cancellations count toward the penalty
- Technician and coordinator cancellations do NOT incur penalties
- Penalties accumulate until cleared (they don't reset automatically)
- The system uses the `cancelledAt` timestamp to determine which month the cancellation occurred in
- All monetary values use Decimal for precision
