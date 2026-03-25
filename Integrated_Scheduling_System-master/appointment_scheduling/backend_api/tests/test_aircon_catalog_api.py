from django.test import override_settings
from rest_framework.test import APITestCase, APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AirconCatalogAPITests(APITestCase):
    """
    AirconCatalogViewSet exists in views but is NOT registered in the router
    (urls.py).  The endpoint should therefore be unreachable.
    """

    def setUp(self):
        from rest_framework.throttling import SimpleRateThrottle
        SimpleRateThrottle.THROTTLE_RATES = {
            'anon': '1000/minute', 'user': '1000/minute',
            'login': '1000/minute', 'guest_booking': '1000/minute',
        }
        self.client = APIClient()

    def test_airconcatalogs_endpoint_not_registered(self):
        """GET /api/airconcatalogs/ must return 404 because the viewset is dead code."""
        from django.urls import resolve, Resolver404

        with self.assertRaises(Resolver404):
            resolve("/api/airconcatalogs/")
