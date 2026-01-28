# Technician Availability System - User Guide

## Overview

The Technician Availability System allows technicians to define their working schedules and ensures that appointments are only booked during available time slots. The system includes:

- **Weekly Schedule Management**: Define which days technicians work each week
- **Time Range Configuration**: Set working hours for each day
- **Specific Date Overrides**: Mark specific dates as available/unavailable (e.g., for leaves)
- **2.5 Hour Time Blocking**: Each appointment blocks 2.5 hours (service + travel time)
- **Minimum Working Days**: Technicians must work at least 5 days per week

---

## Key Features

### 1. 2.5 Hour Time Buffer
- Each appointment automatically blocks **2.5 hours** total time
- This includes:
  - Service time (varies by number of aircon units)
  - Travel time to and from the location
  - Buffer for unexpected delays
- Example: If appointment is from 9:00 AM to 10:00 AM (1 hour), the system blocks time until 12:30 PM (10:00 AM + 2.5 hours)

### 2. Minimum Working Days Requirement
- Each technician must have **at least 5 working days** configured per week
- This ensures adequate service coverage
- The system prevents deletion or modification that would violate this requirement

### 3. Day-Based Availability
- Customers can only book appointments on days when technicians are scheduled to work
- The system automatically filters available dates based on technician schedules

---

## API Endpoints

### Base URL
```
/api/technician-availability/
```

### 1. Create Weekly Schedule (Bulk Create)

**Endpoint**: `POST /api/technician-availability/bulk-create/`

**Description**: Set up a technician's weekly working schedule at once.

**Request Body**:
```json
{
  "technicianId": "uuid-of-technician",
  "schedules": [
    {
      "dayOfWeek": "monday",
      "startTime": "09:00",
      "endTime": "18:00"
    },
    {
      "dayOfWeek": "tuesday",
      "startTime": "09:00",
      "endTime": "18:00"
    },
    {
      "dayOfWeek": "wednesday",
      "startTime": "09:00",
      "endTime": "18:00"
    },
    {
      "dayOfWeek": "thursday",
      "startTime": "09:00",
      "endTime": "18:00"
    },
    {
      "dayOfWeek": "friday",
      "startTime": "09:00",
      "endTime": "18:00"
    }
  ]
}
```

**Response** (Success):
```json
[
  {
    "id": "uuid",
    "technicianId": "uuid-of-technician",
    "dayOfWeek": "monday",
    "startTime": "09:00",
    "endTime": "18:00",
    "specificDate": null,
    "isAvailable": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  ...
]
```

**Response** (Error - Less than 5 days):
```json
{
  "error": "At least 5 working days are required"
}
```

---

### 2. Get Available Time Slots

**Endpoint**: `GET /api/technician-availability/available-slots/`

**Description**: Get all available time slots for a technician on a specific date, considering existing appointments and the 2.5-hour buffer.

**Query Parameters**:
- `technicianId` (required): UUID of the technician
- `date` (required): Date in YYYY-MM-DD format
- `durationHours` (optional): Expected appointment duration in hours (default: 1)

**Example Request**:
```
GET /api/technician-availability/available-slots/?technicianId=123e4567-e89b-12d3-a456-426614174000&date=2024-01-20&durationHours=1
```

**Response**:
```json
{
  "technicianId": "123e4567-e89b-12d3-a456-426614174000",
  "technicianName": "John Tan",
  "date": "2024-01-20",
  "durationHours": 1,
  "availableSlots": [
    {
      "startTime": 1705734000,
      "endTime": 1705737600,
      "startTimeFormatted": "2024-01-20 09:00",
      "endTimeFormatted": "2024-01-20 10:00"
    },
    {
      "startTime": 1705735800,
      "endTime": 1705739400,
      "startTimeFormatted": "2024-01-20 09:30",
      "endTimeFormatted": "2024-01-20 10:30"
    },
    {
      "startTime": 1705750800,
      "endTime": 1705754400,
      "startTimeFormatted": "2024-01-20 13:30",
      "endTimeFormatted": "2024-01-20 14:30"
    }
  ],
  "totalSlots": 3
}
```

**Notes**:
- Time slots are generated in 30-minute intervals
- Each slot accounts for the 2.5-hour buffer after the appointment
- Slots are only returned during the technician's working hours
- Slots avoid conflicts with existing appointments

---

### 3. Get Technician Working Days

**Endpoint**: `GET /api/technician-availability/working-days/`

**Description**: Get the weekly working schedule for a technician, including specific date overrides.

**Query Parameters**:
- `technicianId` (required): UUID of the technician
- `startDate` (optional): Start date for specific date overrides (YYYY-MM-DD)
- `endDate` (optional): End date for specific date overrides (YYYY-MM-DD)

**Example Request**:
```
GET /api/technician-availability/working-days/?technicianId=123e4567-e89b-12d3-a456-426614174000&startDate=2024-01-15&endDate=2024-01-31
```

**Response**:
```json
{
  "technicianId": "123e4567-e89b-12d3-a456-426614174000",
  "technicianName": "John Tan",
  "weeklyWorkingDays": [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday"
  ],
  "totalWeeklyDays": 5,
  "specificDateOverrides": {
    "2024-01-18": {
      "isAvailable": false,
      "startTime": "09:00",
      "endTime": "18:00"
    },
    "2024-01-27": {
      "isAvailable": false,
      "startTime": "09:00",
      "endTime": "18:00"
    }
  },
  "meetsMinimumRequirement": true
}
```

---

### 4. Create Single Availability Record

**Endpoint**: `POST /api/technician-availability/`

**Description**: Create a single availability record (for regular schedule or specific date override).

**Request Body** (Regular Day):
```json
{
  "technicianId": "uuid-of-technician",
  "dayOfWeek": "saturday",
  "startTime": "10:00",
  "endTime": "15:00",
  "isAvailable": true
}
```

**Request Body** (Specific Date Override - Leave):
```json
{
  "technicianId": "uuid-of-technician",
  "specificDate": "2024-01-20",
  "dayOfWeek": "saturday",
  "startTime": "09:00",
  "endTime": "18:00",
  "isAvailable": false
}
```

**Response**:
```json
{
  "id": "uuid",
  "technicianId": "uuid-of-technician",
  "dayOfWeek": "saturday",
  "startTime": "10:00",
  "endTime": "15:00",
  "specificDate": null,
  "isAvailable": true,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

---

### 5. List Availability Records

**Endpoint**: `GET /api/technician-availability/`

**Description**: List all availability records with optional filters.

**Query Parameters**:
- `technicianId` (optional): Filter by technician UUID
- `dayOfWeek` (optional): Filter by day (monday, tuesday, etc.)
- `specificDate` (optional): Filter by specific date (YYYY-MM-DD)

**Example Request**:
```
GET /api/technician-availability/?technicianId=123e4567-e89b-12d3-a456-426614174000
```

**Response**:
```json
[
  {
    "id": "uuid-1",
    "technicianId": "123e4567-e89b-12d3-a456-426614174000",
    "dayOfWeek": "monday",
    "startTime": "09:00",
    "endTime": "18:00",
    "specificDate": null,
    "isAvailable": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": "uuid-2",
    "technicianId": "123e4567-e89b-12d3-a456-426614174000",
    "dayOfWeek": "monday",
    "startTime": "09:00",
    "endTime": "18:00",
    "specificDate": "2024-01-22",
    "isAvailable": false,
    "created_at": "2024-01-15T11:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
]
```

---

### 6. Update Availability Record

**Endpoint**: `PATCH /api/technician-availability/{id}/`

**Description**: Update an existing availability record.

**Request Body** (Partial Update):
```json
{
  "startTime": "08:00",
  "endTime": "17:00"
}
```

**Response**:
```json
{
  "id": "uuid",
  "technicianId": "uuid-of-technician",
  "dayOfWeek": "monday",
  "startTime": "08:00",
  "endTime": "17:00",
  "specificDate": null,
  "isAvailable": true,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T14:00:00Z"
}
```

---

### 7. Delete Availability Record

**Endpoint**: `DELETE /api/technician-availability/{id}/`

**Description**: Delete an availability record. Cannot delete if it would result in less than 5 working days.

**Response** (Success):
```
HTTP 204 No Content
```

**Response** (Error - Would violate minimum days):
```json
{
  "error": "Cannot delete. Technician must have at least 5 working days. Would have 4 days remaining."
}
```

---

## Usage Scenarios

### Scenario 1: Setting Up a New Technician's Schedule

1. **Create weekly schedule using bulk-create**:
```bash
curl -X POST http://localhost:8000/api/technician-availability/bulk-create/ \
  -H "Content-Type: application/json" \
  -d '{
    "technicianId": "tech-uuid-123",
    "schedules": [
      {"dayOfWeek": "monday", "startTime": "09:00", "endTime": "18:00"},
      {"dayOfWeek": "tuesday", "startTime": "09:00", "endTime": "18:00"},
      {"dayOfWeek": "wednesday", "startTime": "09:00", "endTime": "18:00"},
      {"dayOfWeek": "thursday", "startTime": "09:00", "endTime": "18:00"},
      {"dayOfWeek": "friday", "startTime": "09:00", "endTime": "18:00"}
    ]
  }'
```

### Scenario 2: Marking a Technician as Unavailable on a Specific Date

```bash
curl -X POST http://localhost:8000/api/technician-availability/ \
  -H "Content-Type: application/json" \
  -d '{
    "technicianId": "tech-uuid-123",
    "specificDate": "2024-01-25",
    "dayOfWeek": "thursday",
    "startTime": "09:00",
    "endTime": "18:00",
    "isAvailable": false
  }'
```

### Scenario 3: Customer Booking - Finding Available Slots

```bash
# Get available slots for a technician on a specific date
curl -X GET "http://localhost:8000/api/technician-availability/available-slots/?technicianId=tech-uuid-123&date=2024-01-20&durationHours=2"
```

### Scenario 4: Checking Technician Working Days

```bash
curl -X GET "http://localhost:8000/api/technician-availability/working-days/?technicianId=tech-uuid-123&startDate=2024-01-15&endDate=2024-01-31"
```

---

## Validation Rules

### 1. Time Format Validation
- **Start Time** and **End Time** must be in `HH:MM` format (24-hour)
- Valid examples: `09:00`, `13:30`, `18:00`
- Invalid examples: `9:00`, `25:00`, `13:60`

### 2. Time Range Validation
- End time must be **after** start time
- Example: Start `09:00`, End `18:00` ✓
- Example: Start `18:00`, End `09:00` ✗

### 3. Minimum Working Days
- Technicians must have **at least 5 working days** per week
- The system counts unique days in the weekly schedule (excluding specific date overrides)
- Attempts to create/update/delete records that violate this will be rejected

### 4. Day of Week Values
- Valid values: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- Case-sensitive, must be lowercase

### 5. Specific Date Format
- Must be in `YYYY-MM-DD` format
- Example: `2024-01-20` ✓
- Example: `20-01-2024` ✗

---

## Database Schema

### TechnicianAvailability Table

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| technicianId | UUID (FK) | Reference to Technicians table |
| dayOfWeek | VARCHAR(10) | Day name (monday-sunday) |
| startTime | VARCHAR(5) | Start time in HH:MM format |
| endTime | VARCHAR(5) | End time in HH:MM format |
| specificDate | DATE | Specific date override (nullable) |
| isAvailable | BOOLEAN | Availability status |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### Indexes
- `(technicianId, dayOfWeek)` - For quick weekly schedule lookups
- `(technicianId, specificDate)` - For specific date override lookups
- `(isAvailable)` - For filtering available/unavailable records

### Constraints
- **unique_tech_day_schedule**: Unique (technicianId, dayOfWeek) when specificDate is NULL
- **unique_tech_specific_date**: Unique (technicianId, specificDate) when specificDate is NOT NULL

---

## Integration with Appointment Booking

### How It Works

1. **Customer Initiates Booking**:
   - Customer selects desired appointment date and time
   - System identifies nearby technicians

2. **Availability Check**:
   - For each nearby technician, system checks:
     - Is the technician scheduled to work on that day of the week?
     - Is there a specific date override for that date?
     - Does the requested time fall within working hours?
     - Is there a conflict with existing appointments (including 2.5-hour buffer)?

3. **Technician Assignment**:
   - Only technicians passing all checks are considered "available"
   - System assigns the available technician with the least workload
   - If multiple technicians have equal workload, one is randomly selected

4. **Time Blocking**:
   - Once appointment is confirmed, that time slot is blocked
   - Additional 2.5 hours after appointment end time is also blocked
   - Example: Appointment 10:00-11:00 blocks time until 13:30 (11:00 + 2.5 hours)

### Modified Scheduling Algorithm Functions

#### `is_technician_available_on_day()`
Checks if technician works on the requested day and time:
- Looks for specific date override first
- Falls back to weekly schedule if no override
- Validates time falls within working hours

#### `is_slot_available()`
Checks if time slot is free:
- Applies 2.5-hour buffer to existing appointments
- Checks for conflicts with new appointment (including its own buffer)
- Returns True only if no conflicts found

#### `get_available_time_slots()`
Generates list of available slots:
- Considers working hours for the day
- Excludes time slots with existing appointments
- Accounts for 2.5-hour buffer after each appointment
- Returns slots in 30-minute intervals

---

## Admin Panel

The TechnicianAvailability model is registered in the Django admin panel with the following features:

**List Display**:
- Technician ID
- Day of Week
- Start Time
- End Time
- Specific Date
- Is Available

**Filters**:
- Day of Week
- Availability Status
- Technician

**Search**:
- Technician Name

**Access**: `/admin/backend_api/technicianavailability/`

---

## Error Handling

### Common Errors

1. **Insufficient Working Days**:
```json
{
  "dayOfWeek": ["Technician must have at least 5 working days per week. Currently has 3 days."]
}
```

2. **Invalid Time Format**:
```json
{
  "startTime": ["Start time must be in HH:MM format (e.g., 09:00)"]
}
```

3. **End Time Before Start Time**:
```json
{
  "endTime": ["End time must be after start time"]
}
```

4. **Technician Not Found**:
```json
{
  "error": "Technician not found"
}
```

5. **Invalid Date Format**:
```json
{
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```

6. **Cannot Delete - Minimum Days Violation**:
```json
{
  "error": "Cannot delete. Technician must have at least 5 working days. Would have 4 days remaining."
}
```

---

## Best Practices

### For Coordinators

1. **Initial Setup**:
   - Use bulk-create endpoint to set up weekly schedules efficiently
   - Verify minimum 5 working days before finalizing
   - Document any special working hour arrangements

2. **Managing Leaves**:
   - Create specific date overrides with `isAvailable: false`
   - Plan ahead for holidays and expected leaves
   - Ensure adequate coverage during leave periods

3. **Schedule Updates**:
   - Use PATCH for minor adjustments to avoid recreating records
   - Notify technicians of schedule changes
   - Update schedules at least 1 week in advance

### For Frontend Developers

1. **Date Picker Implementation**:
   - Call `working-days` endpoint to get available days
   - Disable dates where technician is unavailable
   - Show working hours for each selectable date

2. **Time Slot Selection**:
   - Call `available-slots` endpoint for selected date
   - Display slots in user-friendly format
   - Consider timezone conversions if necessary

3. **Real-time Availability**:
   - Refresh available slots after each successful booking
   - Show remaining slots to create urgency
   - Handle cases where no slots are available

### For Technicians

1. **Schedule Management**:
   - Keep weekly schedule up-to-date
   - Request leave at least 1 week in advance
   - Confirm schedule changes with coordinator

2. **Working Hours**:
   - Maintain consistent working hours when possible
   - Coordinate with coordinator for special hour requests
   - Account for travel time in schedule

---

## Testing Guide

### Test Cases

#### 1. Create Weekly Schedule
```bash
# Test: Create schedule with 5 days (minimum)
# Expected: Success

# Test: Create schedule with 4 days
# Expected: Error - "At least 5 working days are required"

# Test: Create schedule with invalid time format
# Expected: Error - "Time must be in HH:MM format"
```

#### 2. Check Available Slots
```bash
# Test: Check slots on working day with no appointments
# Expected: Multiple slots throughout the day

# Test: Check slots on non-working day
# Expected: Empty slots array

# Test: Check slots on day with existing appointment
# Expected: Slots excluding appointment + 2.5 hour buffer
```

#### 3. Specific Date Overrides
```bash
# Test: Mark working day as leave
# Expected: Success, that date becomes unavailable

# Test: Try to book on override leave date
# Expected: No available technicians
```

#### 4. Delete Availability
```bash
# Test: Delete one working day (leaving 5 total)
# Expected: Success

# Test: Delete one working day (leaving 4 total)
# Expected: Error - "Cannot delete, would have 4 days remaining"
```

---

## Migration Notes

The system includes a database migration file:
- **File**: `backend_api/migrations/0011_technicianavailability_and_more.py`
- **Changes**:
  - Creates TechnicianAvailability table
  - Adds indexes for performance
  - Adds uniqueness constraints

To apply the migration:
```bash
python manage.py migrate backend_api
```

---

## Support and Troubleshooting

### Common Issues

**Issue**: Appointments not respecting availability
- **Solution**: Ensure `is_slot_available()` is called with `technician_id` parameter

**Issue**: Slots still showing after booking
- **Solution**: Verify 2.5-hour buffer is being applied correctly

**Issue**: Cannot delete working day
- **Solution**: This is by design. Add another working day first, then delete

**Issue**: Specific date override not working
- **Solution**: Check that `specificDate` field is properly set and `isAvailable` is false

---

## Future Enhancements

Potential improvements for consideration:
1. **Variable Time Buffers**: Allow different buffer times based on service type
2. **Break Times**: Support for lunch breaks and rest periods
3. **Recurring Overrides**: Monthly leave patterns (e.g., first Monday of each month)
4. **Availability Templates**: Pre-defined schedule templates for quick setup
5. **Notification System**: Alert technicians of schedule changes
6. **Conflict Resolution**: Suggest alternative times when conflicts occur

---

## Version History

- **v1.0.0** (2024-01-15): Initial implementation
  - Weekly schedule management
  - 2.5-hour time buffer
  - Minimum 5 working days requirement
  - Specific date overrides
  - Available slots calculation

---

For questions or issues, please contact the system administrator or submit a ticket through the support portal.
