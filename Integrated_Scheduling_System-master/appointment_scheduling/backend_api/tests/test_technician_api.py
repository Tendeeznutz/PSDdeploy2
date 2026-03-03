from unittest.mock import patch

from django.contrib.auth.hashers import make_password, check_password
from rest_framework.test import APITestCase, APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from ..models import Technicians, Customers


@patch('backend_api.views.technician_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
@patch('backend_api.views.technician_views.sendMail.send_email')
class TechnicianAPITestCase(APITestCase):

    def setUp(self):
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}
        self.client = APIClient()
        self.base_url = '/api/technicians/'

        self.technician_data = {
            'technicianName': 'Alice Tan',
            'technicianPostalCode': '123456',
            'technicianAddress': '10 Test Street',
            'technicianPhone': '91234567',
            'technicianPassword': 'password123',
        }

    def _create_technician(self, phone='91234567', name='Alice Tan', password='password123'):
        return Technicians.objects.create(
            technicianName=name,
            technicianPostalCode='123456',
            technicianAddress='10 Test Street',
            technicianPhone=phone,
            technicianPassword=make_password(password),
            technicianLocation='1.3521,103.8198',
        )

    def _get_auth_token(self, mock_send_email=None):
        """Create a customer and log in to get a JWT access token."""
        with patch('backend_api.views.customer_views.geo.get_location_from_postal', return_value='1.3521,103.8198'):
            Customers.objects.create(
                customerName='Test User',
                customerPostalCode='654321',
                customerPhone='81234567',
                customerEmail='testuser@example.com',
                customerPassword=make_password('pass1234'),
                customerLocation='1.3521,103.8198',
            )
            resp = self.client.post('/api/customers/login/', {
                'email': 'testuser@example.com',
                'password': 'pass1234',
            }, format='json')
        return resp.data['access']

    def _auth_client(self):
        token = self._get_auth_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    # ------------------------------------------------------------------ #
    # 1. Create technician
    # ------------------------------------------------------------------ #
    def test_create_technician(self, mock_send_email, mock_geo):
        self._auth_client()
        resp = self.client.post(self.base_url, self.technician_data, format='json')
        self.assertEqual(resp.status_code, 201)
        tech = Technicians.objects.get(technicianPhone='91234567')
        self.assertTrue(check_password('password123', tech.technicianPassword))

    # ------------------------------------------------------------------ #
    # 2. Login success
    # ------------------------------------------------------------------ #
    def test_login_success(self, mock_send_email, mock_geo):
        self._create_technician()
        resp = self.client.post(f'{self.base_url}login/', {
            'email': '91234567',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)
        self.assertEqual(resp.data['technician_phone'], '91234567')
        self.assertEqual(resp.data['role'], 'technician')

    # ------------------------------------------------------------------ #
    # 3. Login wrong password
    # ------------------------------------------------------------------ #
    def test_login_wrong_password(self, mock_send_email, mock_geo):
        self._create_technician()
        resp = self.client.post(f'{self.base_url}login/', {
            'email': '91234567',
            'password': 'wrongpass',
        }, format='json')
        self.assertEqual(resp.status_code, 401)

    # ------------------------------------------------------------------ #
    # 4. Login deactivated account
    # ------------------------------------------------------------------ #
    def test_login_deactivated_account(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        tech.isActive = False
        tech.save()
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
        self._create_technician()
        self._auth_client()
        resp = self.client.get(self.base_url)
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
        self.assertGreaterEqual(len(resp.data), 1)

    # ------------------------------------------------------------------ #
    # 6. List filter by name
    # ------------------------------------------------------------------ #
    def test_list_filter_by_name(self, mock_send_email, mock_geo):
        self._create_technician(phone='91234567', name='Alice Tan')
        self._create_technician(phone='98765432', name='Bob Lee')
        self._auth_client()
        resp = self.client.get(self.base_url, {'technicianName': 'Alice'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['technicianName'], 'Alice Tan')

    # ------------------------------------------------------------------ #
    # 7. Retrieve single technician
    # ------------------------------------------------------------------ #
    def test_retrieve_technician(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        self._auth_client()
        resp = self.client.get(f'{self.base_url}{tech.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['technicianPhone'], '91234567')

    # ------------------------------------------------------------------ #
    # 8. Partial update (PATCH)
    # ------------------------------------------------------------------ #
    def test_partial_update(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        self._auth_client()
        resp = self.client.patch(f'{self.base_url}{tech.id}/', {
            'technicianName': 'Alice Updated',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['technicianName'], 'Alice Updated')

    # ------------------------------------------------------------------ #
    # 9. PUT not allowed
    # ------------------------------------------------------------------ #
    def test_put_not_allowed(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        self._auth_client()
        resp = self.client.put(f'{self.base_url}{tech.id}/', self.technician_data, format='json')
        self.assertEqual(resp.status_code, 405)

    # ------------------------------------------------------------------ #
    # 10. Delete technician
    # ------------------------------------------------------------------ #
    def test_delete_technician(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        self._auth_client()
        resp = self.client.delete(f'{self.base_url}{tech.id}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Technicians.objects.filter(id=tech.id).exists())

    # ------------------------------------------------------------------ #
    # 11. Toggle active — deactivate
    # ------------------------------------------------------------------ #
    def test_toggle_active_deactivate(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        self._auth_client()
        resp = self.client.post(
            f'{self.base_url}{tech.id}/toggle-active-status/',
            {'reason': 'Poor performance'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data['isActive'])
        tech.refresh_from_db()
        self.assertFalse(tech.isActive)
        self.assertEqual(tech.deactivationReason, 'Poor performance')

    # ------------------------------------------------------------------ #
    # 12. Toggle active — reactivate
    # ------------------------------------------------------------------ #
    def test_toggle_active_reactivate(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        tech.isActive = False
        tech.save()
        self._auth_client()
        resp = self.client.post(
            f'{self.base_url}{tech.id}/toggle-active-status/',
            {},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['isActive'])
        tech.refresh_from_db()
        self.assertTrue(tech.isActive)

    # ------------------------------------------------------------------ #
    # 13. Password not in response
    # ------------------------------------------------------------------ #
    def test_password_not_in_response(self, mock_send_email, mock_geo):
        tech = self._create_technician()
        self._auth_client()
        resp = self.client.get(f'{self.base_url}{tech.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('technicianPassword', resp.data)
