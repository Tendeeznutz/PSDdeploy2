from django.contrib.auth.hashers import make_password, check_password
from rest_framework.test import APITestCase, APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from ..models import Coordinators


BASE_URL = '/api/coordinators/'


def make_coordinator(**kwargs):
    defaults = {
        'coordinatorName': 'Test Coordinator',
        'coordinatorEmail': 'coord@example.com',
        'coordinatorPhone': '91234567',
        'coordinatorPassword': make_password('password123'),
    }
    defaults.update(kwargs)
    return Coordinators.objects.create(**defaults)


def get_auth_header(client, coordinator):
    resp = client.post(
        f'{BASE_URL}login/',
        {'email': coordinator.coordinatorEmail, 'password': 'password123'},
        format='json',
    )
    return {'HTTP_AUTHORIZATION': f'Bearer {resp.data["access"]}'}


class CoordinatorAPITests(APITestCase):
    def setUp(self):
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}
        self.client = APIClient()
        self.coordinator = make_coordinator()
        self.auth = get_auth_header(self.client, self.coordinator)

    # 1. Create coordinator
    def test_create_coordinator(self):
        data = {
            'coordinatorName': 'New Coord',
            'coordinatorEmail': 'new@example.com',
            'coordinatorPhone': '81234567',
            'coordinatorPassword': 'plaintext123',
        }
        resp = self.client.post(BASE_URL, data, format='json', **self.auth)
        self.assertEqual(resp.status_code, 201)
        coord = Coordinators.objects.get(coordinatorEmail='new@example.com')
        self.assertTrue(check_password('plaintext123', coord.coordinatorPassword))

    # 2. Login success
    def test_login_success(self):
        resp = self.client.post(
            f'{BASE_URL}login/',
            {'email': self.coordinator.coordinatorEmail, 'password': 'password123'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)
        self.assertEqual(resp.data['coordinatorEmail'], self.coordinator.coordinatorEmail)
        self.assertEqual(resp.data['role'], 'coordinator')

    # 3. Login wrong password
    def test_login_wrong_password(self):
        resp = self.client.post(
            f'{BASE_URL}login/',
            {'email': self.coordinator.coordinatorEmail, 'password': 'wrongpass'},
            format='json',
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data['detail'], 'Invalid credentials')

    # 4. Login missing fields
    def test_login_missing_fields(self):
        resp = self.client.post(f'{BASE_URL}login/', {'email': 'only@example.com'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['detail'], 'Email and password are required')

    # 5. List coordinators (authenticated)
    def test_list_coordinators(self):
        resp = self.client.get(BASE_URL, **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
        self.assertGreaterEqual(len(resp.data), 1)

    # 6. Retrieve coordinator
    def test_retrieve_coordinator(self):
        resp = self.client.get(f'{BASE_URL}{self.coordinator.id}/', **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['coordinatorEmail'], self.coordinator.coordinatorEmail)

    # 7. Partial update
    def test_partial_update(self):
        resp = self.client.patch(
            f'{BASE_URL}{self.coordinator.id}/',
            {'coordinatorName': 'Updated Name'},
            format='json',
            **self.auth,
        )
        self.assertEqual(resp.status_code, 200)
        self.coordinator.refresh_from_db()
        self.assertEqual(self.coordinator.coordinatorName, 'Updated Name')

    # 8. Partial update hashes password
    def test_partial_update_hashes_password(self):
        resp = self.client.patch(
            f'{BASE_URL}{self.coordinator.id}/',
            {'coordinatorPassword': 'newplainpass'},
            format='json',
            **self.auth,
        )
        self.assertEqual(resp.status_code, 200)
        self.coordinator.refresh_from_db()
        self.assertTrue(check_password('newplainpass', self.coordinator.coordinatorPassword))

    # 9. PUT returns 405
    def test_put_not_allowed(self):
        resp = self.client.put(
            f'{BASE_URL}{self.coordinator.id}/',
            {'coordinatorName': 'X'},
            format='json',
            **self.auth,
        )
        self.assertEqual(resp.status_code, 405)

    # 10. Password not in response (create and list)
    def test_password_not_in_response(self):
        data = {
            'coordinatorName': 'NoPwd Coord',
            'coordinatorEmail': 'nopwd@example.com',
            'coordinatorPhone': '71234567',
            'coordinatorPassword': 'secret',
        }
        create_resp = self.client.post(BASE_URL, data, format='json', **self.auth)
        self.assertNotIn('coordinatorPassword', create_resp.data)

        list_resp = self.client.get(BASE_URL, **self.auth)
        for item in list_resp.data:
            self.assertNotIn('coordinatorPassword', item)

    # 11. List requires authentication
    def test_list_requires_auth(self):
        resp = self.client.get(BASE_URL)
        self.assertIn(resp.status_code, [401, 403])
