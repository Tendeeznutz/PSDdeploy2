from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient, APITestCase

from backend_api.models import Coordinators, Customers
from backend_api.tests.helpers import auth_client_as


@patch('backend_api.views.customer_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
@patch('backend_api.views.appointment_views.geo_onemap.get_location_from_postal', return_value='1.3521,103.8198')
@patch('backend_api.views.appointment_views.sendMail.send_email')
@patch('backend_api.views.appointment_views.send_appointment_confirmation')
@patch('backend_api.views.appointment_views.send_appointment_cancellation')
@patch('backend_api.views.appointment_views.get_nearby_technicians', return_value=[])
@patch('backend_api.views.appointment_views.get_technician_to_assign', return_value=None)
class AuthEnforcementTests(APITestCase):
    def setUp(self):
        from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}
        self.client = APIClient()

    def test_public_endpoints_no_auth(self, *mocks):
        """Public endpoints must not return 401/403 even with no token."""
        endpoints = [
            ('/api/customers/login/', {}),
            ('/api/customers/', {}),
            ('/api/technicians/login/', {}),
            ('/api/coordinators/login/', {}),
            ('/api/appointments/guest-booking/', {}),
        ]
        for url, data in endpoints:
            response = self.client.post(url, data, format='json')
            self.assertNotEqual(
                response.status_code,
                401,
                msg=f"Expected non-401 for public endpoint {url}, got {response.status_code}",
            )

    def test_protected_endpoints_require_auth(self, *mocks):
        """Protected endpoints must return 401 when no token is provided."""
        endpoints = [
            '/api/customers/',
            '/api/technicians/',
            '/api/coordinators/',
            '/api/appointments/',
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                401,
                msg=f"Expected 401 for protected endpoint {url}, got {response.status_code}",
            )

    def test_valid_token_grants_access(self, *mocks):
        """A valid JWT allows access to protected customer list endpoint."""
        coordinator = Coordinators.objects.create(
            coordinatorName='Auth Coord',
            coordinatorEmail='authcoord@example.com',
            coordinatorPhone='81234567',
            coordinatorPassword=make_password('coordpass'),
        )
        auth_client_as(self.client, coordinator, "coordinator")
        response = self.client.get('/api/customers/')
        self.assertEqual(response.status_code, 200, msg="Valid token should grant access to /api/customers/")
