from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient, APITestCase
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from backend_api.models import Coordinators, Customers, CustomerAirconDevices
from backend_api.tests.helpers import auth_client_as


class CustomerAirconDeviceAPITests(APITestCase):
    def setUp(self):
        AnonRateThrottle.THROTTLE_RATES = {"anon": "1000/minute"}
        UserRateThrottle.THROTTLE_RATES = {"user": "1000/minute"}
        self.client = APIClient()
        self.base_url = "/api/customeraircondevices/"

        self.customer = Customers.objects.create(
            customerName="Test Customer",
            customerPostalCode="123456",
            customerAddress="1 Test Street",
            customerPhone="91234567",
            customerEmail="test@example.com",
            customerPassword=make_password("pass1234"),
            customerLocation="1.3521,103.8198",
        )
        self.customer2 = Customers.objects.create(
            customerName="Other Customer",
            customerPostalCode="654321",
            customerAddress="2 Other Road",
            customerPhone="87654321",
            customerEmail="other@example.com",
            customerPassword=make_password("pass1234"),
            customerLocation="1.3521,103.8198",
        )

        auth_client_as(self.client, self.customer, "customer")

    def _make_device(self, customer=None, name="Test AC", units=1, ac_type="daikin"):
        return CustomerAirconDevices.objects.create(
            customerId=customer or self.customer,
            airconName=name,
            numberOfUnits=units,
            airconType=ac_type,
        )

    # ── 1. Create device with valid data → 201 ─────────────────────────
    def test_create_device_valid(self):
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Daikin FTN25",
            "numberOfUnits": 2,
            "airconType": "daikin",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["airconName"], "Daikin FTN25")
        self.assertEqual(resp.data["numberOfUnits"], 2)
        self.assertTrue(
            CustomerAirconDevices.objects.filter(airconName="Daikin FTN25").exists()
        )

    # ── 2. Create device without airconName → 201, auto-generated name ──
    @patch("backend_api.serializers.randomname.get_name", return_value="blue-tiger")
    def test_create_device_auto_name(self, mock_rng):
        payload = {
            "customerId": str(self.customer.id),
            "numberOfUnits": 1,
            "airconType": "daikin",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["airconName"], "blue-tiger")
        mock_rng.assert_called()

    # ── 3. Duplicate name for same customer → 400 ──────────────────────
    def test_create_device_duplicate_name(self):
        self._make_device(name="Living Room AC")
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Living Room AC",
            "numberOfUnits": 1,
            "airconType": "daikin",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("airconName", str(resp.data))

    # ── 4. numberOfUnits < 1 → 400 ─────────────────────────────────────
    def test_create_device_units_below_min(self):
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Bad Units",
            "numberOfUnits": 0,
            "airconType": "daikin",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("numberOfUnits", str(resp.data))

    # ── 5. numberOfUnits > 100 → 400 ───────────────────────────────────
    def test_create_device_units_above_max(self):
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Too Many Units",
            "numberOfUnits": 101,
            "airconType": "daikin",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("numberOfUnits", str(resp.data))

    # ── 6. Invalid lastServiceMonth format → 400 ───────────────────────
    def test_create_device_invalid_last_service_month(self):
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Bad Month",
            "numberOfUnits": 1,
            "airconType": "daikin",
            "lastServiceMonth": "2024-13",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("lastServiceMonth", str(resp.data))

    # ── 7. Future lastServiceMonth → 400 ───────────────────────────────
    def test_create_device_future_last_service_month(self):
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Future Month",
            "numberOfUnits": 1,
            "airconType": "daikin",
            "lastServiceMonth": "2030-06",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("lastServiceMonth", str(resp.data))

    # ── 8. Valid lastServiceMonth (YYYY-MM) → 201 ──────────────────────
    def test_create_device_valid_last_service_month(self):
        payload = {
            "customerId": str(self.customer.id),
            "airconName": "Valid Month",
            "numberOfUnits": 1,
            "airconType": "daikin",
            "lastServiceMonth": "2024-01",
        }
        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["lastServiceMonth"], "2024-01")

    # ── 9. List all devices (coordinator) → 200 ───────────────────────
    def test_list_devices(self):
        self._make_device(name="AC1")
        self._make_device(name="AC2")
        coord = Coordinators.objects.create(
            coordinatorName="Admin", coordinatorEmail="admin@test.com",
            coordinatorPhone="80000001", coordinatorPassword=make_password("pass"),
        )
        auth_client_as(self.client, coord, "coordinator")
        resp = self.client.get(self.base_url)
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
        self.assertEqual(len(resp.data), 2)

    # ── 10. List filtered by customerId → 200 ─────────────────────────
    def test_list_filtered_by_customer_id(self):
        self._make_device(customer=self.customer, name="Mine")
        self._make_device(customer=self.customer2, name="Theirs")
        resp = self.client.get(self.base_url, {"customerId": str(self.customer.id)})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["airconName"], "Mine")

    # ── 11. List filtered by customerName (coordinator) → 200 ─────────
    def test_list_filtered_by_customer_name(self):
        self._make_device(customer=self.customer, name="Mine")
        self._make_device(customer=self.customer2, name="Theirs")
        coord = Coordinators.objects.create(
            coordinatorName="Admin2", coordinatorEmail="admin2@test.com",
            coordinatorPhone="80000002", coordinatorPassword=make_password("pass"),
        )
        auth_client_as(self.client, coord, "coordinator")
        resp = self.client.get(self.base_url, {"customerName": "Other"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["airconName"], "Theirs")

    # ── 12. Invalid query param → 400 ─────────────────────────────────
    def test_list_invalid_query_param(self):
        resp = self.client.get(self.base_url, {"bogusParam": "whatever"})
        self.assertEqual(resp.status_code, 400)

    # ── 13. Retrieve single device → 200 ──────────────────────────────
    def test_retrieve_device(self):
        device = self._make_device(name="Retrieve Me")
        resp = self.client.get(f"{self.base_url}{device.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["airconName"], "Retrieve Me")

    # ── 14. Partial update (PATCH) → 200 ──────────────────────────────
    def test_partial_update(self):
        device = self._make_device(name="Old Name")
        resp = self.client.patch(
            f"{self.base_url}{device.id}/",
            {"airconName": "New Name"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["airconName"], "New Name")
        device.refresh_from_db()
        self.assertEqual(device.airconName, "New Name")

    # ── 15. PUT returns 405 ────────────────────────────────────────────
    def test_put_not_allowed(self):
        device = self._make_device()
        resp = self.client.put(
            f"{self.base_url}{device.id}/",
            {"airconName": "Should Fail"},
            format="json",
        )
        self.assertEqual(resp.status_code, 405)

    # ── 16. Delete device → 204, verify gone ──────────────────────────
    def test_delete_device(self):
        device = self._make_device()
        resp = self.client.delete(f"{self.base_url}{device.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(CustomerAirconDevices.objects.filter(id=device.id).exists())

    # ── 17. Auth required (no token → 401) ────────────────────────────
    def test_auth_required(self):
        client = APIClient()  # fresh client, no credentials
        resp = client.get(self.base_url)
        self.assertEqual(resp.status_code, 401)
