from unittest.mock import patch

from django.contrib.auth.hashers import make_password, check_password
from rest_framework.test import APITestCase, APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from ..models import Technicians
from backend_api.tests.helpers import auth_client_as


@patch('backend_api.views.technician_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
@patch('backend_api.views.technician_views.sendMail.send_email')
class TechnicianAPITestCase(APITestCase):

    def setUp(self):
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}

        from backend_api.views.technician_views import LoginRateThrottle as TechLoginThrottle
        TechLoginThrottle.rate = '1000/minute'

        self.client = APIClient()
        self.base_url = '/api/technicians/'

        self.technician_data = {
            'technicianName': 'Alice Tan',
            'technicianPostalCode': '123456',
            'technicianAddress': '10 Test Street',
            'technicianPhone': '91234567',
            'technicianPassword': 'password123',
        }

        # Create a default technician for auth and reuse across tests
        self.technician = self._create_technician()

    def _create_technician(self, phone='91234567', name='Alice Tan', password='password123'):
        return Technicians.objects.create(
            technicianName=name,
            technicianPostalCode='123456',
            technicianAddress='10 Test Street',
            technicianPhone=phone,
            technicianPassword=make_password(password),
            technicianLocation='1.3521,103.8198',
        )

    def _auth_as_coordinator(self):
        """Authenticate the test client as a coordinator (bypasses login endpoint)."""
        auth_client_as(self.client, self.technician, 'coordinator')

    def _auth_as_technician(self, tech=None):
        """Authenticate the test client as a technician (bypasses login endpoint)."""
        auth_client_as(self.client, tech or self.technician, 'technician')

    # ------------------------------------------------------------------ #
    # 1. Create technician
    # ------------------------------------------------------------------ #
    def test_create_technician(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        create_data = {
            'technicianName': 'Bob Lee',
            'technicianPostalCode': '654321',
            'technicianAddress': '20 Test Street',
            'technicianPhone': '98765432',
            'technicianPassword': 'password123',
        }
        resp = self.client.post(self.base_url, create_data, format='json')
        self.assertEqual(resp.status_code, 201)
        tech = Technicians.objects.get(technicianPhone='98765432')
        self.assertTrue(check_password('password123', tech.technicianPassword))

    # ------------------------------------------------------------------ #
    # 2. Login success
    # ------------------------------------------------------------------ #
    def test_login_success(self, mock_send_email, mock_geo):
        resp = self.client.post(f'{self.base_url}login/', {
            'email': '91234567',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['technician_phone'], '91234567')
        self.assertEqual(resp.data['role'], 'technician')

    # ------------------------------------------------------------------ #
    # 3. Login wrong password
    # ------------------------------------------------------------------ #
    def test_login_wrong_password(self, mock_send_email, mock_geo):
        resp = self.client.post(f'{self.base_url}login/', {
            'email': '91234567',
            'password': 'wrongpass',
        }, format='json')
        self.assertEqual(resp.status_code, 401)

    # ------------------------------------------------------------------ #
    # 4. Login deactivated account
    # ------------------------------------------------------------------ #
    def test_login_deactivated_account(self, mock_send_email, mock_geo):
        self.technician.isActive = False
        self.technician.save()
        resp = self.client.post(f'{self.base_url}login/', {
            'email': '91234567',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('deactivated', resp.data['detail'].lower())

    # ------------------------------------------------------------------ #
    # 5. List technicians
    # ------------------------------------------------------------------ #
    def test_list_technicians(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        resp = self.client.get(self.base_url)
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
        self.assertGreaterEqual(len(resp.data), 1)

    # ------------------------------------------------------------------ #
    # 6. List filter by name
    # ------------------------------------------------------------------ #
    def test_list_filter_by_name(self, mock_send_email, mock_geo):
        self._create_technician(phone='98765432', name='Bob Lee')
        self._auth_as_coordinator()
        resp = self.client.get(self.base_url, {'technicianName': 'Alice'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['technicianName'], 'Alice Tan')

    # ------------------------------------------------------------------ #
    # 7. Retrieve single technician
    # ------------------------------------------------------------------ #
    def test_retrieve_technician(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        resp = self.client.get(f'{self.base_url}{self.technician.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['technicianPhone'], '91234567')

    # ------------------------------------------------------------------ #
    # 8. Partial update (PATCH)
    # ------------------------------------------------------------------ #
    def test_partial_update(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        resp = self.client.patch(f'{self.base_url}{self.technician.id}/', {
            'technicianName': 'Alice Updated',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['technicianName'], 'Alice Updated')

    # ------------------------------------------------------------------ #
    # 9. PUT not allowed
    # ------------------------------------------------------------------ #
    def test_put_not_allowed(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        resp = self.client.put(f'{self.base_url}{self.technician.id}/', self.technician_data, format='json')
        self.assertEqual(resp.status_code, 405)

    # ------------------------------------------------------------------ #
    # 10. Delete technician
    # ------------------------------------------------------------------ #
    def test_delete_technician(self, mock_send_email, mock_geo):
        tech = self._create_technician(phone='98765432', name='Bob Lee')
        self._auth_as_coordinator()
        resp = self.client.delete(f'{self.base_url}{tech.id}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Technicians.objects.filter(id=tech.id).exists())

    # ------------------------------------------------------------------ #
    # 11. Toggle active — deactivate
    # ------------------------------------------------------------------ #
    def test_toggle_active_deactivate(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        resp = self.client.post(
            f'{self.base_url}{self.technician.id}/toggle-active-status/',
            {'reason': 'Poor performance'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data['isActive'])
        self.technician.refresh_from_db()
        self.assertFalse(self.technician.isActive)
        self.assertEqual(self.technician.deactivationReason, 'Poor performance')

    # ------------------------------------------------------------------ #
    # 12. Toggle active — reactivate
    # ------------------------------------------------------------------ #
    def test_toggle_active_reactivate(self, mock_send_email, mock_geo):
        self.technician.isActive = False
        self.technician.save()
        self._auth_as_coordinator()
        resp = self.client.post(
            f'{self.base_url}{self.technician.id}/toggle-active-status/',
            {},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['isActive'])
        self.technician.refresh_from_db()
        self.assertTrue(self.technician.isActive)

    # ------------------------------------------------------------------ #
    # 13. Password not in response
    # ------------------------------------------------------------------ #
    def test_password_not_in_response(self, mock_send_email, mock_geo):
        self._auth_as_coordinator()
        resp = self.client.get(f'{self.base_url}{self.technician.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('technicianPassword', resp.data)
