from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from rest_framework.test import APIClient, APITestCase

from backend_api.models import Customers


@patch('backend_api.views.customer_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
class CustomerAPITests(APITestCase):
    def setUp(self):
        from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}
        self.client = APIClient()
        self.base_url = '/api/customers/'

        self.valid_payload = {
            'customerName': 'Alice Tan',
            'customerPostalCode': '123456',
            'customerAddress': '123 Test Street',
            'customerPhone': '91234567',
            'customerEmail': 'alice@example.com',
            'customerPassword': 'securepass123',
        }

    def _create_customer(self, email='bob@example.com', phone='87654321', password='pass1234'):
        customer = Customers.objects.create(
            customerName='Bob Lee',
            customerPostalCode='654321',
            customerAddress='456 Example Road',
            customerPhone=phone,
            customerEmail=email,
            customerPassword=make_password(password),
            customerLocation='1.3521,103.8198',
        )
        return customer, password

    def _get_token(self, email, password):
        response = self.client.post(
            f'{self.base_url}login/',
            {'email': email, 'password': password},
            format='json',
        )
        return response.data['access']

    def _auth_client(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    # 1. Register with valid data
    def test_register_customer(self, mock_geo):
        response = self.client.post(self.base_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, 201)
        customer = Customers.objects.get(customerEmail='alice@example.com')
        self.assertTrue(check_password('securepass123', customer.customerPassword))
        self.assertEqual(customer.customerLocation, '1.3521,103.8198')

    # 2. Duplicate email returns 400
    def test_register_duplicate_email(self, mock_geo):
        self.client.post(self.base_url, self.valid_payload, format='json')
        response = self.client.post(self.base_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Customer with this email already exists.', response.data.get('error', ''))

    # 3. Invalid phone (non-8-digit) returns 400
    def test_register_invalid_phone(self, mock_geo):
        payload = {**self.valid_payload, 'customerPhone': '123'}
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 400)

    # 4. Invalid postal (non-6-digit) returns 400
    def test_register_invalid_postal(self, mock_geo):
        payload = {**self.valid_payload, 'customerPostalCode': '12'}
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 400)

    # 5. Login success returns 200 with tokens
    def test_login_success(self, mock_geo):
        customer, password = self._create_customer()
        response = self.client.post(
            f'{self.base_url}login/',
            {'email': customer.customerEmail, 'password': password},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['role'], 'customer')

    # 6. Wrong password returns 401
    def test_login_wrong_password(self, mock_geo):
        customer, _ = self._create_customer()
        response = self.client.post(
            f'{self.base_url}login/',
            {'email': customer.customerEmail, 'password': 'wrongpass'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['error'], 'Invalid credentials')

    # 7. Nonexistent email returns 401 (no user enumeration)
    def test_login_nonexistent_email(self, mock_geo):
        response = self.client.post(
            f'{self.base_url}login/',
            {'email': 'nobody@example.com', 'password': 'anything'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['error'], 'Invalid credentials')

    # 8. Missing fields returns 400
    def test_login_missing_fields(self, mock_geo):
        response = self.client.post(f'{self.base_url}login/', {'email': 'x@x.com'}, format='json')
        self.assertEqual(response.status_code, 400)

    # 9. List customers (authenticated)
    def test_list_customers(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)

    # 10. Filter by email
    def test_list_filter_by_email(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        response = self.client.get(self.base_url, {'customerEmail': customer.customerEmail})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(c['customerEmail'] == customer.customerEmail for c in response.data))

    # 11. Retrieve customer
    def test_retrieve_customer(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        response = self.client.get(f'{self.base_url}{customer.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['customerEmail'], customer.customerEmail)

    # 12. Partial update (PATCH)
    def test_partial_update(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        response = self.client.patch(
            f'{self.base_url}{customer.id}/',
            {'customerName': 'Updated Name'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['customerName'], 'Updated Name')

    # 13. PATCH with password hashes it
    def test_update_password_hashed(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        new_password = 'newpass9999'
        self.client.patch(
            f'{self.base_url}{customer.id}/',
            {'customerPassword': new_password},
            format='json',
        )
        customer.refresh_from_db()
        self.assertTrue(check_password(new_password, customer.customerPassword))

    # 14. PUT returns 405
    def test_put_not_allowed(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        response = self.client.put(
            f'{self.base_url}{customer.id}/',
            {'customerName': 'Should Fail'},
            format='json',
        )
        self.assertEqual(response.status_code, 405)

    # 15. DELETE returns 204
    def test_delete_customer(self, mock_geo):
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        response = self.client.delete(f'{self.base_url}{customer.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Customers.objects.filter(id=customer.id).exists())

    # 16. Password not in response
    def test_password_not_in_response(self, mock_geo):
        # Check registration response
        response = self.client.post(self.base_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('customerPassword', response.data)

        # Check list response
        customer, password = self._create_customer()
        token = self._get_token(customer.customerEmail, password)
        self._auth_client(token)
        list_response = self.client.get(self.base_url)
        for item in list_response.data:
            self.assertNotIn('customerPassword', item)

        # Check retrieve response
        retrieve_response = self.client.get(f'{self.base_url}{customer.id}/')
        self.assertNotIn('customerPassword', retrieve_response.data)
