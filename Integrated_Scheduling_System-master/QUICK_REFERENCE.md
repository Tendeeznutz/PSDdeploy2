# Technician Availability - Quick Reference Card

## Key Concepts

### 🕐 Time Buffer
- **2.5 hours** blocked per appointment (service + travel time)
- Example: 10:00-11:00 appointment blocks until 13:30

### 📅 Minimum Working Days
- Technicians must work **at least 5 days per week**
- System enforces this requirement

### 🎯 Schedule Priority
1. Specific date overrides (if set)
2. Weekly recurring schedule (fallback)

---

## Common API Calls

### Set Up Technician Schedule
```bash
POST /api/technician-availability/bulk-create/
{
  "technicianId": "uuid",
  "schedules": [
    {"dayOfWeek": "monday", "startTime": "09:00", "endTime": "18:00"},
    {"dayOfWeek": "tuesday", "startTime": "09:00", "endTime": "18:00"},
    {"dayOfWeek": "wednesday", "startTime": "09:00", "endTime": "18:00"},
    {"dayOfWeek": "thursday", "startTime": "09:00", "endTime": "18:00"},
    {"dayOfWeek": "friday", "startTime": "09:00", "endTime": "18:00"}
  ]
}
```

### Get Available Time Slots
```bash
GET /api/technician-availability/available-slots/
  ?technicianId=uuid
  &date=2024-01-20
  &durationHours=1
```

### Mark Date as Unavailable (Leave)
```bash
POST /api/technician-availability/
{
  "technicianId": "uuid",
  "specificDate": "2024-01-25",
  "dayOfWeek": "thursday",
  "startTime": "09:00",
  "endTime": "18:00",
  "isAvailable": false
}
```

### Get Working Days
```bash
GET /api/technician-availability/working-days/
  ?technicianId=uuid
  &startDate=2024-01-15
  &endDate=2024-01-31
```

---

## Time Format Rules

✅ **Valid**: `09:00`, `13:30`, `18:00`
❌ **Invalid**: `9:00`, `25:00`, `13:60`

- Must be **HH:MM** format (24-hour)
- End time must be **after** start time

---

## Day Values

Valid: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`

⚠️ Must be **lowercase**

---

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (No Content) |
| 400 | Validation Error |
| 404 | Not Found |
| 207 | Multi-Status (Partial Success) |

---

## Common Errors

### "At least 5 working days are required"
- Tried to create schedule with <5 days
- **Fix**: Add more working days

### "Cannot delete. Would have X days remaining"
- Deleting would violate minimum days
- **Fix**: Add another working day first

### "Time must be in HH:MM format"
- Invalid time format
- **Fix**: Use 24-hour format with leading zeros

### "End time must be after start time"
- End time is before or equal to start time
- **Fix**: Ensure endTime > startTime

---

## Testing Commands

### Check Django Setup
```bash
cd appointment_scheduling
python manage.py check
```

### Run Migrations
```bash
python manage.py migrate
```

### Run Server
```bash
python manage.py runserver
```

### Run Test Suite
```bash
python test_availability_api.py
```

---

## Database Query Examples

### Get All Working Days for Technician
```python
TechnicianAvailability.objects.filter(
    technicianId=technician_id,
    specificDate__isnull=True,
    isAvailable=True
)
```

### Get Specific Date Overrides
```python
TechnicianAvailability.objects.filter(
    technicianId=technician_id,
    specificDate__gte=start_date,
    specificDate__lte=end_date
)
```

### Check if Day is Working Day
```python
TechnicianAvailability.objects.filter(
    technicianId=technician_id,
    dayOfWeek='monday',
    specificDate__isnull=True,
    isAvailable=True
).exists()
```

---

## Integration Checklist

### Backend ✅
- [x] TechnicianAvailability model created
- [x] Migrations applied
- [x] API endpoints configured
- [x] Scheduling algorithm updated
- [x] Admin panel registered

### Frontend (TODO)
- [ ] Technician schedule setup UI
- [ ] Date picker integration (disable non-working days)
- [ ] Time slot selection UI
- [ ] Leave request form
- [ ] Schedule management dashboard

---

## Files Reference

| File | Purpose |
|------|---------|
| `TECHNICIAN_AVAILABILITY_GUIDE.md` | Full documentation |
| `IMPLEMENTATION_SUMMARY.md` | Technical implementation details |
| `QUICK_REFERENCE.md` | This file |
| `test_availability_api.py` | Test script |
| `backend_api/models.py` | TechnicianAvailability model |
| `backend_api/serializers.py` | Validation logic |
| `backend_api/scheduling_algo.py` | Availability checking |
| `backend_api/views/availability_views.py` | API endpoints |

---

## Support Contacts

**Documentation**: See [TECHNICIAN_AVAILABILITY_GUIDE.md](TECHNICIAN_AVAILABILITY_GUIDE.md)
**Issues**: Contact development team
**Testing**: Run `python test_availability_api.py`

---

**Version**: 1.0.0
**Last Updated**: 2024-01-22
**Status**: ✅ Ready for Testing
