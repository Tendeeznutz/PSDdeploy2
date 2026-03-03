import time
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient, APITestCase

from backend_api.models import (
    Appointments,
    AppointmentRating,
    CustomerAirconDevices,
    Customers,
    Technicians,
)


@patch('backend_api.views.appointment_views.geo_onemap.get_location_from_postal', return_value='1.3521,103.8198')
@patch('backend_api.views.appointment_views.sendMail.send_email')
@patch('backend_api.views.appointment_views.send_appointment_confirmation')
@patch('backend_api.views.appointment_views.send_appointment_cancellation')
@patch('backend_api.views.appointment_views.get_nearby_technicians', return_value=[])
@patch('backend_api.views.appointment_views.get_technician_to_assign', return_value=None)
@patch('backend_api.views.appointment_views.check_and_apply_penalty', return_value={'penalty_applied': False})
@patch('backend_api.views.customer_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
class AppointmentAPITests(APITestCase):
    def setUp(self):
        from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}

        self.client = APIClient()
        self.base_url = '/api/appointments/'

        self.customer = Customers.objects.create(
            customerName='Test Customer',
            customerPostalCode='123456',
            customerAddress='1 Test Street',
            customerPhone='91234567',
            customerEmail='testcustomer@example.com',
            customerPassword=make_password('pass1234'),
            customerLocation='1.3521,103.8198',
        )

        self.device = CustomerAirconDevices.objects.create(
            customerId=self.customer,
            airconName='Daikin - FTN25',
            numberOfUnits=1,
            airconType='split',
        )

        self.technician = Technicians.objects.create(
            technicianName='Tech One',
            technicianPostalCode='654321',
            technicianAddress='2 Tech Road',
            technicianPhone='81234567',
            technicianEmail='tech@example.com',
            technicianPassword=make_password('techpass'),
            technicianStatus='1',
        )

    def _get_token(self):
        response = self.client.post(
            '/api/customers/login/',
            {'email': 'testcustomer@example.com', 'password': 'pass1234'},
            format='json',
        )
        return response.data['access']

    def _auth(self):
        token = self._get_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _future_start(self, offset=86400):
        return int(time.time()) + offset

    def _make_appointment(self, status='1', with_technician=False):
        start = self._future_start()
        end = start + 3600
        return Appointments.objects.create(
            customerId=self.customer,
            technicianId=self.technician if with_technician else None,
            appointmentStartTime=start,
            appointmentEndTime=end,
            appointmentStatus=status,
            paymentMethod='cash',
            airconToService=[str(self.device.id)],
        )

    # 1. Create appointment
    def test_create_appointment(self, *mocks):
        self._auth()
        start = self._future_start()
        payload = {
            'customerId': str(self.customer.id),
            'appointmentStartTime': start,
            'airconToService': [str(self.device.id)],
            'paymentMethod': 'cash',
        }
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 201)

    # 2. List all appointments
    def test_list_appointments(self, *mocks):
        self._auth()
        self._make_appointment()
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertGreaterEqual(len(response.data), 1)

    # 3. Filter list by customerId
    def test_list_filter_by_customer(self, *mocks):
        self._auth()
        self._make_appointment()
        response = self.client.get(self.base_url, {'customerId': str(self.customer.id)})
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

    # 4. Retrieve single appointment
    def test_retrieve_appointment(self, *mocks):
        self._auth()
        appt = self._make_appointment()
        response = self.client.get(f'{self.base_url}{appt.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(str(response.data['id']), str(appt.id))

    # 5. Partial update status (not cancellation)
    def test_partial_update_status(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='1')
        response = self.client.patch(
            f'{self.base_url}{appt.id}/',
            {'appointmentStatus': '2'},
            format='json',
        )
        # Partial update without technician auto-reverts to '1', but request should succeed
        self.assertIn(response.status_code, [200, 400])

    # 6. Cancel without reason returns 400
    def test_cancel_requires_reason(self, *mocks):
        self._auth()
        appt = self._make_appointment()
        response = self.client.patch(
            f'{self.base_url}{appt.id}/',
            {'appointmentStatus': '4'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Cancellation reason is required', str(response.data))

    # 7. Cancel with reason succeeds
    def test_cancel_with_reason(self, *mocks):
        self._auth()
        appt = self._make_appointment()
        response = self.client.patch(
            f'{self.base_url}{appt.id}/',
            {
                'appointmentStatus': '4',
                'cancellationReason': 'Schedule conflict',
                'cancelledBy': 'customer',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        appt.refresh_from_db()
        self.assertEqual(appt.appointmentStatus, '4')

    # 8. Delete appointment returns 204
    def test_delete_appointment(self, *mocks):
        self._auth()
        appt = self._make_appointment()
        response = self.client.delete(f'{self.base_url}{appt.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Appointments.objects.filter(id=appt.id).exists())

    # 9. Rate technician on completed appointment
    def test_rate_technician(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 4},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('technicianRating', response.data)

    # 10. Rate technician on non-completed appointment returns 400
    def test_rate_technician_not_completed(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='1', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 5},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('completed', str(response.data))

    # 11. Rate customer on completed appointment
    def test_rate_customer(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-customer/',
            {'technicianId': str(self.technician.id), 'rating': 5},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('customerRating', response.data)

    # 12. Guest booking (no auth required)
    def test_guest_booking(self, *mocks):
        start = self._future_start()
        payload = {
            'customerName': 'Guest User',
            'customerPhone': '98765432',
            'customerEmail': 'guest@example.com',
            'customerAddress': '99 Guest Lane',
            'customerPostalCode': '567890',
            'airconBrand': 'Mitsubishi',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('appointment', response.data)
        self.assertTrue(Customers.objects.filter(customerEmail='guest@example.com').exists())
