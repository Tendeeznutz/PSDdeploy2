import uuid

from django.contrib.auth.hashers import make_password
from django.test import TestCase

from backend_api.models import (
    Appointments,
    AppointmentRating,
    Customers,
    CustomerAirconDevices,
    Technicians,
)
from backend_api.views.format_response import include_all_info


class IncludeAllInfoTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="Alice Tan",
            customerPostalCode="123456",
            customerAddress="1 Test Street",
            customerPhone="91234567",
            customerEmail="alice@example.com",
            customerPassword=make_password("pass"),
            customerLocation="1.3521,103.8198",
        )
        self.technician = Technicians.objects.create(
            technicianName="Bob Tech",
            technicianPostalCode="654321",
            technicianAddress="2 Tech Road",
            technicianPhone="81234567",
            technicianPassword=make_password("pass"),
            technicianLocation="1.3521,103.8198",
        )
        self.device = CustomerAirconDevices.objects.create(
            customerId=self.customer,
            airconName="Living Room AC",
            numberOfUnits=1,
            airconType="split",
        )
        self.appointment = Appointments.objects.create(
            customerId=self.customer,
            technicianId=self.technician,
            appointmentStartTime=1700000000,
            appointmentEndTime=1700003600,
            appointmentStatus="1",
            airconToService=[str(self.device.id)],
        )

    # ── 1. appointmentStatus display text ────────────────────────────
    def test_appointment_status_display(self):
        data = {
            "id": str(self.appointment.id),
            "appointmentStatus": "1",
            "customerId": str(self.customer.id),
        }
        result = include_all_info(dict(data))
        self.assertEqual(result["display"]["appointmentStatus"], "Pending")

    # ── 2. customerName & customerPhone from related customer ────────
    def test_customer_display_fields(self):
        data = {
            "id": str(self.appointment.id),
            "appointmentStatus": "1",
            "customerId": str(self.customer.id),
        }
        result = include_all_info(dict(data))
        self.assertEqual(result["display"]["customerName"], "Alice Tan")
        self.assertEqual(result["display"]["customerPhone"], "91234567")

    # ── 3. technicianName from related technician ────────────────────
    def test_technician_display_fields(self):
        data = {
            "id": str(self.appointment.id),
            "appointmentStatus": "1",
            "customerId": str(self.customer.id),
            "technicianId": str(self.technician.id),
        }
        result = include_all_info(dict(data))
        self.assertEqual(result["display"]["technicianName"], "Bob Tech")

    # ── 4. airconToService names from device IDs ─────────────────────
    def test_aircon_to_service_names(self):
        data = {
            "id": str(self.appointment.id),
            "appointmentStatus": "1",
            "customerId": str(self.customer.id),
            "airconToService": [str(self.device.id)],
        }
        result = include_all_info(dict(data))
        self.assertIn("Living Room AC", result["display"]["airconToService"])

    # ── 5. customerAirconDevices populated for customer data ─────────
    def test_customer_data_gets_devices(self):
        data = {
            "id": str(self.customer.id),
            "customerName": "Alice Tan",
        }
        result = include_all_info(dict(data))
        self.assertIn("customerAirconDevices", result)
        self.assertIn(self.device.id, result["customerAirconDevices"])
        self.assertIn("Living Room AC", result["display"]["customerAirconDevices"])

    # ── 6. Handles missing/deleted aircon devices → '[Removed]' ──────
    def test_missing_aircon_device_shows_removed(self):
        fake_id = str(uuid.uuid4())
        data = {
            "id": str(self.appointment.id),
            "appointmentStatus": "1",
            "customerId": str(self.customer.id),
            "airconToService": [fake_id],
        }
        result = include_all_info(dict(data))
        self.assertIn("[Removed]", result["display"]["airconToService"])

    # ── 7. Handles appointment with no technician assigned ───────────
    def test_no_technician_assigned(self):
        appt = Appointments.objects.create(
            customerId=self.customer,
            technicianId=None,
            appointmentStartTime=1700010000,
            appointmentEndTime=1700013600,
            appointmentStatus="1",
            airconToService=[],
        )
        data = {
            "id": str(appt.id),
            "appointmentStatus": "1",
            "customerId": str(self.customer.id),
            "technicianId": None,
        }
        result = include_all_info(dict(data))
        # Should not crash; technicianName should not be present
        self.assertNotIn("technicianName", result["display"])

    # ── 8. hasRated flags ────────────────────────────────────────────
    def test_has_rated_flags(self):
        # Create a rating
        AppointmentRating.objects.create(
            appointment=self.appointment,
            ratedBy="technician",
            rating=4,
        )
        data = {
            "id": str(self.appointment.id),
            "appointmentStatus": "3",
            "customerId": str(self.customer.id),
            "technicianId": str(self.technician.id),
        }
        result = include_all_info(dict(data))
        # Default context (non-customer) → should have hasRatedCustomer
        self.assertTrue(result["display"]["hasRatedCustomer"])
