#!/usr/bin/env python
"""
Test script for Technician Availability API
Run this script to test the new availability features
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000/api"
HEADERS = {"Content-Type": "application/json"}

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60 + "\n")

def print_response(response):
    """Print formatted response"""
    print(f"Status Code: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)
    print()

def test_1_get_technicians():
    """Test 1: Get list of technicians"""
    print_section("TEST 1: Get Technicians List")

    response = requests.get(f"{BASE_URL}/technicians/")
    print_response(response)

    if response.status_code == 200 and response.json():
        return response.json()[0]['id']  # Return first technician ID
    return None

def test_2_create_weekly_schedule(technician_id):
    """Test 2: Create weekly schedule for technician"""
    print_section("TEST 2: Create Weekly Schedule (Bulk Create)")

    data = {
        "technicianId": technician_id,
        "schedules": [
            {"dayOfWeek": "monday", "startTime": "09:00", "endTime": "18:00"},
            {"dayOfWeek": "tuesday", "startTime": "09:00", "endTime": "18:00"},
            {"dayOfWeek": "wednesday", "startTime": "09:00", "endTime": "18:00"},
            {"dayOfWeek": "thursday", "startTime": "09:00", "endTime": "18:00"},
            {"dayOfWeek": "friday", "startTime": "09:00", "endTime": "18:00"}
        ]
    }

    response = requests.post(
        f"{BASE_URL}/technician-availability/bulk-create/",
        headers=HEADERS,
        data=json.dumps(data)
    )
    print_response(response)

def test_3_get_working_days(technician_id):
    """Test 3: Get technician working days"""
    print_section("TEST 3: Get Working Days Summary")

    start_date = datetime.now().strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    response = requests.get(
        f"{BASE_URL}/technician-availability/working-days/",
        params={
            "technicianId": technician_id,
            "startDate": start_date,
            "endDate": end_date
        }
    )
    print_response(response)

def test_4_get_available_slots(technician_id):
    """Test 4: Get available time slots"""
    print_section("TEST 4: Get Available Time Slots")

    # Get next Monday
    today = datetime.now()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    next_monday = today + timedelta(days=days_until_monday)
    date_str = next_monday.strftime("%Y-%m-%d")

    response = requests.get(
        f"{BASE_URL}/technician-availability/available-slots/",
        params={
            "technicianId": technician_id,
            "date": date_str,
            "durationHours": 1
        }
    )
    print_response(response)

def test_5_list_availability(technician_id):
    """Test 5: List all availability records"""
    print_section("TEST 5: List Availability Records")

    response = requests.get(
        f"{BASE_URL}/technician-availability/",
        params={"technicianId": technician_id}
    )
    print_response(response)

    if response.status_code == 200 and response.json():
        return response.json()[0]['id']  # Return first record ID
    return None

def test_6_create_specific_date_override(technician_id):
    """Test 6: Create specific date override (leave day)"""
    print_section("TEST 6: Create Specific Date Override (Leave)")

    # Mark next Friday as unavailable
    today = datetime.now()
    days_until_friday = (4 - today.weekday()) % 7
    if days_until_friday <= 0:
        days_until_friday += 7
    next_friday = today + timedelta(days=days_until_friday)
    date_str = next_friday.strftime("%Y-%m-%d")

    data = {
        "technicianId": technician_id,
        "specificDate": date_str,
        "dayOfWeek": "friday",
        "startTime": "09:00",
        "endTime": "18:00",
        "isAvailable": False
    }

    response = requests.post(
        f"{BASE_URL}/technician-availability/",
        headers=HEADERS,
        data=json.dumps(data)
    )
    print_response(response)

def test_7_update_availability(record_id):
    """Test 7: Update availability record"""
    if not record_id:
        print_section("TEST 7: Update Availability (SKIPPED - No record ID)")
        return

    print_section("TEST 7: Update Availability Record")

    data = {
        "startTime": "08:00",
        "endTime": "17:00"
    }

    response = requests.patch(
        f"{BASE_URL}/technician-availability/{record_id}/",
        headers=HEADERS,
        data=json.dumps(data)
    )
    print_response(response)

def test_8_invalid_schedule():
    """Test 8: Try to create schedule with less than 5 days (should fail)"""
    print_section("TEST 8: Invalid Schedule (Less than 5 days)")

    # Get a technician first
    response = requests.get(f"{BASE_URL}/technicians/")
    if response.status_code != 200 or not response.json():
        print("No technicians available for testing")
        return

    technician_id = response.json()[0]['id']

    data = {
        "technicianId": technician_id,
        "schedules": [
            {"dayOfWeek": "monday", "startTime": "09:00", "endTime": "18:00"},
            {"dayOfWeek": "tuesday", "startTime": "09:00", "endTime": "18:00"},
            {"dayOfWeek": "wednesday", "startTime": "09:00", "endTime": "18:00"}
        ]
    }

    response = requests.post(
        f"{BASE_URL}/technician-availability/bulk-create/",
        headers=HEADERS,
        data=json.dumps(data)
    )
    print("Expected to fail with validation error:")
    print_response(response)

def test_9_invalid_time_format():
    """Test 9: Try to create record with invalid time format (should fail)"""
    print_section("TEST 9: Invalid Time Format")

    # Get a technician first
    response = requests.get(f"{BASE_URL}/technicians/")
    if response.status_code != 200 or not response.json():
        print("No technicians available for testing")
        return

    technician_id = response.json()[0]['id']

    data = {
        "technicianId": technician_id,
        "dayOfWeek": "saturday",
        "startTime": "9:00",  # Invalid format (missing leading zero)
        "endTime": "18:00",
        "isAvailable": True
    }

    response = requests.post(
        f"{BASE_URL}/technician-availability/",
        headers=HEADERS,
        data=json.dumps(data)
    )
    print("Expected to fail with validation error:")
    print_response(response)

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("  TECHNICIAN AVAILABILITY API TEST SUITE")
    print("="*60)
    print("\nMake sure the Django server is running on http://localhost:8000")
    print("Press Enter to continue...")
    input()

    try:
        # Test 1: Get technicians
        technician_id = test_1_get_technicians()

        if not technician_id:
            print("\n❌ No technicians found. Please create at least one technician first.")
            return

        print(f"\n✓ Using Technician ID: {technician_id}")

        # Test 2: Create weekly schedule
        test_2_create_weekly_schedule(technician_id)

        # Test 3: Get working days
        test_3_get_working_days(technician_id)

        # Test 4: Get available slots
        test_4_get_available_slots(technician_id)

        # Test 5: List availability records
        record_id = test_5_list_availability(technician_id)

        # Test 6: Create specific date override
        test_6_create_specific_date_override(technician_id)

        # Test 7: Update availability
        test_7_update_availability(record_id)

        # Test 8: Invalid schedule (less than 5 days)
        test_8_invalid_schedule()

        # Test 9: Invalid time format
        test_9_invalid_time_format()

        print_section("TEST SUITE COMPLETED")
        print("✓ All tests executed successfully!")
        print("\nNote: Check the responses above for any errors.")
        print("Validation errors in tests 8 and 9 are expected and demonstrate proper validation.\n")

    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to server at http://localhost:8000")
        print("Please make sure the Django server is running:")
        print("  cd appointment_scheduling")
        print("  python manage.py runserver\n")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}\n")

if __name__ == "__main__":
    main()
