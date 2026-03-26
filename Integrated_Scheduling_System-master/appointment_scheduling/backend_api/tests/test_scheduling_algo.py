import uuid
from collections import namedtuple
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth.hashers import make_password
from django.test import TestCase

from backend_api.models import (
    Appointments,
    Customers,
    Technicians,
    TechnicianAvailability,
)
from backend_api.scheduling_algo import (
    TIME_BUFFER_SECONDS,
    TRAVEL_BUFFER_SECONDS,
    LUNCH_BREAK_START,
    LUNCH_BREAK_END,
    SEARCH_RANGE_METERS,
    SGT,
    _overlaps_lunch_break,
    find_common_timerange,
    get_available_time_slots,
    get_common_unavailable_time,
    get_nearby_technicians,
    get_technician_to_assign,
    is_slot_available,
    is_technician_available_on_day,
)


class _MockAppt:
    """Lightweight stand-in for an Appointment with start/end."""

    def __init__(self, start, end):
        self.appointmentStartTime = start
        self.appointmentEndTime = end


class SearchRangeConstantTests(TestCase):
    def test_search_range_is_30000(self):
        self.assertEqual(SEARCH_RANGE_METERS, 30000)


@patch("backend_api.scheduling_algo.geo_onemap.is_in_range", return_value=True)
class GetNearbyTechniciansTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="Customer A",
            customerPostalCode="123456",
            customerAddress="1 Test Lane",
            customerPhone="91234567",
            customerEmail="cust@example.com",
            customerPassword=make_password("pass"),
            customerLocation="1.3521,103.8198",
        )

    def _make_tech(
        self,
        name,
        phone,
        location="1.3522,103.8199",
        active=True,
        status="1",
        specializations=None,
    ):
        return Technicians.objects.create(
            technicianName=name,
            technicianPostalCode="123456",
            technicianAddress="addr",
            technicianPhone=phone,
            technicianPassword=make_password("pass"),
            technicianLocation=location,
            isActive=active,
            technicianStatus=status,
            specializations=specializations or [],
        )

    # 1
    def test_empty_when_customer_location_zero(self, mock_range):
        self.customer.customerLocation = "0,0"
        self.customer.save()
        result = get_nearby_technicians(self.customer.id)
        self.assertEqual(result, [])

    # 2 – specialists first, then non-specialists, each sorted by distance
    def test_sorted_specialist_first_then_distance(self, mock_range):
        close_spec = self._make_tech(
            "CloseSpec",
            "11111111",
            location="1.3522,103.8199",
            specializations=["Daikin"],
        )
        far_spec = self._make_tech(
            "FarSpec",
            "22222222",
            location="1.4000,103.9000",
            specializations=["Daikin"],
        )
        close_non = self._make_tech("CloseNon", "33333333", location="1.3523,103.8200")

        result = get_nearby_technicians(self.customer.id, aircon_brand="Daikin")
        self.assertEqual(len(result), 3)
        # Specialists come first
        self.assertIn(result[0], [str(close_spec.id)])
        self.assertIn(result[1], [str(far_spec.id)])
        # Non-specialist last
        self.assertEqual(result[2], str(close_non.id))

    # 3 – excludes inactive technicians
    def test_excludes_inactive(self, mock_range):
        self._make_tech("Active", "11111111", active=True)
        self._make_tech("Inactive", "22222222", active=False)
        result = get_nearby_technicians(self.customer.id)
        self.assertEqual(len(result), 1)

    # 4 – excludes unavailable (status != '1')
    def test_excludes_unavailable_status(self, mock_range):
        self._make_tech("Available", "11111111", status="1")
        self._make_tech("Unavailable", "22222222", status="2")
        result = get_nearby_technicians(self.customer.id)
        self.assertEqual(len(result), 1)

    # 5 – excludes technicians with location '0,0'
    def test_excludes_tech_location_zero(self, mock_range):
        self._make_tech("Good", "11111111", location="1.3522,103.8199")
        self._make_tech("Bad", "22222222", location="0,0")
        result = get_nearby_technicians(self.customer.id)
        self.assertEqual(len(result), 1)


class FindCommonTimerangeTests(TestCase):
    # 6 – overlapping appointments
    def test_overlapping_ranges(self):
        appts = [
            _MockAppt(100, 300),
            _MockAppt(200, 400),
        ]
        result = find_common_timerange(appts)
        self.assertEqual(result, [[200, 300]])

    # 7 – non-overlapping appointments → empty
    def test_non_overlapping_empty(self):
        appts = [
            _MockAppt(100, 200),
            _MockAppt(300, 400),
        ]
        result = find_common_timerange(appts)
        self.assertEqual(result, [])


class GetCommonUnavailableTimeTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="C",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="91234567",
            customerEmail="c@example.com",
            customerPassword=make_password("p"),
            customerLocation="1.3521,103.8198",
        )
        self.tech1 = Technicians.objects.create(
            technicianName="T1",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="81111111",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )
        self.tech2 = Technicians.objects.create(
            technicianName="T2",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="82222222",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )

    # 8 – returns empty if any technician has no appointments
    def test_empty_if_technician_has_no_appointments(self):
        Appointments.objects.create(
            customerId=self.customer,
            technicianId=self.tech1,
            appointmentStartTime=100,
            appointmentEndTime=200,
            airconToService=[],
        )
        result = get_common_unavailable_time([str(self.tech1.id), str(self.tech2.id)])
        self.assertEqual(result, [])


class IsTechnicianAvailableOnDayTests(TestCase):
    def setUp(self):
        self.tech = Technicians.objects.create(
            technicianName="T",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="91234567",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )
        # Find a Monday in a well-known date
        self.monday_10am = datetime(2025, 1, 6, 10, 0, 0)
        self.monday_ts = int(self.monday_10am.timestamp())

        self.tuesday_10am = datetime(2025, 1, 7, 10, 0, 0)
        self.tuesday_ts = int(self.tuesday_10am.timestamp())

    # 9 – True for working day within hours
    def test_available_on_working_day(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        self.assertTrue(is_technician_available_on_day(self.tech.id, self.monday_ts))

    # 10 – False for non-working day
    def test_unavailable_on_non_working_day(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        self.assertFalse(is_technician_available_on_day(self.tech.id, self.tuesday_ts))

    # 11 – specific date override: unavailable
    def test_specific_date_override_unavailable(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            specificDate=self.monday_10am.date(),
            startTime="09:00",
            endTime="17:00",
            isAvailable=False,
        )
        self.assertFalse(is_technician_available_on_day(self.tech.id, self.monday_ts))

    # 12 – False when outside working hours
    def test_outside_working_hours(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="12:00",
            isAvailable=True,
        )
        monday_2pm = datetime(2025, 1, 6, 14, 0, 0)
        self.assertFalse(
            is_technician_available_on_day(self.tech.id, int(monday_2pm.timestamp()))
        )


class IsSlotAvailableTests(TestCase):
    # 13 – True when no conflicting appointments
    def test_no_conflict(self):
        self.assertTrue(is_slot_available(1000, 2000, []))

    # 14 – False when conflicting (with 2.5 hr buffer)
    def test_conflict_with_buffer(self):
        existing = _MockAppt(1000, 2000)
        # New slot starts at 2000 + half of buffer → within buffer
        new_start = 2000 + int(TIME_BUFFER_SECONDS / 2)
        new_end = new_start + 3600
        self.assertFalse(is_slot_available(new_start, new_end, [existing]))

    # 15 – checks availability schedule when technician_id provided
    def test_checks_availability_when_tech_id_given(self):
        tech = Technicians.objects.create(
            technicianName="T",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="91234567",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )
        # No availability set → defaults to available (no schedule configured)
        monday_10am = datetime(2025, 1, 6, 10, 0, 0)
        ts = int(monday_10am.timestamp())
        self.assertTrue(is_slot_available(ts, ts + 3600, [], technician_id=tech.id))


class GetTechnicianToAssignTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="C",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="91234567",
            customerEmail="c@example.com",
            customerPassword=make_password("p"),
            customerLocation="1.3521,103.8198",
        )
        self.tech = Technicians.objects.create(
            technicianName="T",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="81111111",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )

    # 16 – returns None for empty list
    def test_empty_list_returns_none(self):
        self.assertIsNone(get_technician_to_assign([], 1000, 2000))

    # 17 – returns first available technician
    @patch("backend_api.scheduling_algo.is_slot_available", return_value=True)
    def test_returns_first_available(self, mock_avail):
        result = get_technician_to_assign(
            [str(self.tech.id)],
            1000,
            2000,
        )
        self.assertEqual(result, str(self.tech.id))

    # 18 – keeps current technician if still available
    @patch("backend_api.scheduling_algo.is_slot_available", return_value=True)
    def test_keeps_current_technician(self, mock_avail):
        tech2 = Technicians.objects.create(
            technicianName="T2",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="82222222",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )
        result = get_technician_to_assign(
            [str(tech2.id), str(self.tech.id)],
            1000,
            2000,
            current_technician_id=str(self.tech.id),
        )
        self.assertEqual(result, str(self.tech.id))


class GetAvailableTimeSlotsTests(TestCase):
    def setUp(self):
        self.tech = Technicians.objects.create(
            technicianName="T",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="91234567",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )

    # 19 – returns slots for a working day
    def test_slots_for_working_day(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        slots = get_available_time_slots(self.tech.id, "2025-01-06", 1)
        self.assertIsInstance(slots, list)
        # With 8-hr window, 1-hr slots + 30-min buffer → multiple slots
        self.assertGreater(len(slots), 0)
        for start, end in slots:
            self.assertGreater(end, start)

    # 20 – returns empty for non-working day
    def test_empty_for_non_working_day(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        slots = get_available_time_slots(self.tech.id, "2025-01-07", 1)  # Tuesday
        self.assertEqual(slots, [])

    # 21 – excludes slots conflicting with existing appointments
    def test_excludes_conflicting_slots(self):
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        # No appointments → get baseline count
        baseline = get_available_time_slots(self.tech.id, "2025-01-06", 1)

        # Add an appointment in the middle of the day
        target_date = datetime(2025, 1, 6)
        appt_start = int(datetime(2025, 1, 6, 12, 0).timestamp())
        appt_end = int(datetime(2025, 1, 6, 13, 0).timestamp())
        customer = Customers.objects.create(
            customerName="C",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="81234567",
            customerEmail="c@example.com",
            customerPassword=make_password("p"),
            customerLocation="1,1",
        )
        Appointments.objects.create(
            customerId=customer,
            technicianId=self.tech,
            appointmentStartTime=appt_start,
            appointmentEndTime=appt_end,
            airconToService=[],
        )
        with_appt = get_available_time_slots(self.tech.id, "2025-01-06", 1)
        self.assertLess(len(with_appt), len(baseline))


class TimeBufferTests(TestCase):
    """Tests for the travel buffer between appointments."""

    def test_buffer_is_1800_seconds(self):
        self.assertEqual(TIME_BUFFER_SECONDS, 1800)

    def test_slot_available_after_buffer(self):
        """A slot starting exactly at end + buffer should be available."""
        existing = _MockAppt(1000, 2000)
        new_start = 2000 + int(TIME_BUFFER_SECONDS) + 1
        new_end = new_start + 3600
        # This slot starts after the buffer period
        self.assertTrue(is_slot_available(new_start, new_end, [existing]))

    def test_slot_unavailable_within_buffer(self):
        """A slot starting within the buffer period should be unavailable."""
        existing = _MockAppt(1000, 2000)
        new_start = 2000 + 100  # Way within buffer
        new_end = new_start + 3600
        self.assertFalse(is_slot_available(new_start, new_end, [existing]))

    def test_slot_before_existing_respects_new_buffer(self):
        """New appointment's buffer must not overlap with existing start."""
        existing = _MockAppt(5000, 8600)
        # New appointment ends at 3500, buffer would go to 3500+1800=5300
        # This overlaps with the existing start at 5000
        new_start = 0
        new_end = 3500
        self.assertFalse(is_slot_available(new_start, new_end, [existing]))

    def test_multiple_existing_appointments_respected(self):
        """Slot must not conflict with ANY existing appointment."""
        appt1 = _MockAppt(1000, 2000)
        appt2 = _MockAppt(20000, 23600)
        # Slot between them but within buffer of appt1
        new_start = 2000 + 100
        new_end = new_start + 3600
        self.assertFalse(is_slot_available(new_start, new_end, [appt1, appt2]))


class IsTechnicianAvailableEdgeCaseTests(TestCase):
    """Additional edge case tests for technician availability."""

    def setUp(self):
        self.tech = Technicians.objects.create(
            technicianName="Edge Tech",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="91234567",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )

    def test_no_schedule_defaults_to_available(self):
        """Technician with no availability records defaults to available."""
        monday_10am = datetime(2025, 1, 6, 10, 0, 0)
        ts = int(monday_10am.timestamp())
        self.assertTrue(is_technician_available_on_day(self.tech.id, ts))

    def test_specific_date_available_with_custom_hours(self):
        """Specific date override with custom hours allows within-range time."""
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        # Create a specific date override with shorter hours
        target_date = datetime(2025, 1, 6).date()
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            specificDate=target_date,
            startTime="10:00",
            endTime="14:00",
            isAvailable=True,
        )
        # 11am should be available (within 10:00-14:00)
        ts_11am = int(datetime(2025, 1, 6, 11, 0, 0).timestamp())
        self.assertTrue(is_technician_available_on_day(self.tech.id, ts_11am))

        # 15:00 should NOT be available (outside 10:00-14:00 override)
        ts_3pm = int(datetime(2025, 1, 6, 15, 0, 0).timestamp())
        self.assertFalse(is_technician_available_on_day(self.tech.id, ts_3pm))

    def test_exactly_at_end_time_is_unavailable(self):
        """Appointment at exactly the end time boundary should be unavailable."""
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        ts_5pm = int(datetime(2025, 1, 6, 17, 0, 0).timestamp())
        self.assertFalse(is_technician_available_on_day(self.tech.id, ts_5pm))

    def test_exactly_at_start_time_is_available(self):
        """Appointment at exactly the start time should be available."""
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="17:00",
            isAvailable=True,
        )
        ts_9am = int(datetime(2025, 1, 6, 9, 0, 0).timestamp())
        self.assertTrue(is_technician_available_on_day(self.tech.id, ts_9am))


class TravelBufferTests(TestCase):
    """Tests for the renamed TRAVEL_BUFFER_SECONDS constant."""

    def test_travel_buffer_is_30_minutes(self):
        """Buffer should be 30 minutes (1800 seconds), not 2.5 hours."""
        self.assertEqual(TRAVEL_BUFFER_SECONDS, 1800)

    def test_backward_compat_alias(self):
        """TIME_BUFFER_SECONDS should equal TRAVEL_BUFFER_SECONDS."""
        self.assertEqual(TIME_BUFFER_SECONDS, TRAVEL_BUFFER_SECONDS)


class LunchBreakTests(TestCase):
    """Tests for the lunch break constraint (12:00-13:00 SGT)."""

    def setUp(self):
        self.tech = Technicians.objects.create(
            technicianName="LunchTech",
            technicianPostalCode="123456",
            technicianAddress="a",
            technicianPhone="91234567",
            technicianPassword=make_password("p"),
            technicianLocation="1,1",
        )
        TechnicianAvailability.objects.create(
            technicianId=self.tech,
            dayOfWeek="monday",
            startTime="09:00",
            endTime="18:00",
            isAvailable=True,
        )
        # Use a known Monday in SGT
        self._monday = datetime(2025, 1, 6, tzinfo=SGT)

    def _ts(self, hour, minute=0):
        """Return a Unix timestamp for the test Monday at the given SGT hour."""
        dt = self._monday.replace(hour=hour, minute=minute, second=0, microsecond=0)
        return int(dt.timestamp())

    def test_slot_overlapping_lunch_rejected(self):
        """An appointment from 11:30-12:30 should be rejected (overlaps lunch)."""
        start = self._ts(11, 30)
        end = self._ts(12, 30)
        self.assertTrue(_overlaps_lunch_break(start, end))

    def test_slot_before_lunch_accepted(self):
        """An appointment from 10:00-11:00 should be accepted (no overlap)."""
        start = self._ts(10)
        end = self._ts(11)
        self.assertFalse(_overlaps_lunch_break(start, end))

    def test_slot_after_lunch_accepted(self):
        """An appointment from 13:00-14:00 should be accepted."""
        start = self._ts(13)
        end = self._ts(14)
        self.assertFalse(_overlaps_lunch_break(start, end))

    def test_slot_during_lunch_rejected(self):
        """An appointment from 12:00-13:00 should be rejected."""
        start = self._ts(12)
        end = self._ts(13)
        self.assertTrue(_overlaps_lunch_break(start, end))

    def test_slot_ending_at_lunch_start_accepted(self):
        """An appointment from 11:00-12:00 should be accepted (ends exactly at lunch start)."""
        start = self._ts(11)
        end = self._ts(12)
        self.assertFalse(_overlaps_lunch_break(start, end))

    def test_slot_starting_at_lunch_end_accepted(self):
        """An appointment from 13:00-14:00 should be accepted (starts exactly at lunch end)."""
        start = self._ts(13)
        end = self._ts(14)
        self.assertFalse(_overlaps_lunch_break(start, end))

    def test_available_time_slots_excludes_lunch(self):
        """get_available_time_slots should not return slots during lunch."""
        slots = get_available_time_slots(self.tech.id, "2025-01-06", 1)
        self.assertGreater(len(slots), 0)
        for slot_start, slot_end in slots:
            dt_start = datetime.fromtimestamp(slot_start, tz=SGT)
            dt_end = datetime.fromtimestamp(slot_end, tz=SGT)
            # No slot should overlap with 12:00-13:00 SGT
            lunch_start = dt_start.replace(hour=12, minute=0, second=0, microsecond=0)
            lunch_end = dt_start.replace(hour=13, minute=0, second=0, microsecond=0)
            overlaps = dt_start < lunch_end and dt_end > lunch_start
            self.assertFalse(
                overlaps,
                f"Slot {dt_start.strftime('%H:%M')}-{dt_end.strftime('%H:%M')} overlaps lunch break",
            )
