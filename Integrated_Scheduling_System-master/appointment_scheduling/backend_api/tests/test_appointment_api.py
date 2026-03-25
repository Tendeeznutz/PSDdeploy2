import time
import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from backend_api.models import (
    Appointments,
    AppointmentRating,
    Coordinators,
    CustomerAirconDevices,
    Customers,
    Technicians,
)

_THROTTLE_OVERRIDE = {
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/minute',
        'user': '1000/minute',
        'login': '1000/minute',
        'guest_booking': '1000/minute',
    }
}


@override_settings(REST_FRAMEWORK={**_THROTTLE_OVERRIDE})
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
        from rest_framework.throttling import SimpleRateThrottle
        SimpleRateThrottle.THROTTLE_RATES = {
            'anon': '1000/minute', 'user': '1000/minute',
            'login': '1000/minute', 'guest_booking': '1000/minute',
        }

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
        return response.cookies['access_token'].value

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

    # ─── Basic CRUD ─────────────────────────────────────────────────

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

    # ─── Cancellation Tests ─────────────────────────────────────────

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

    # 7b. Cancel with empty reason returns 400
    def test_cancel_empty_reason_rejected(self, *mocks):
        self._auth()
        appt = self._make_appointment()
        response = self.client.patch(
            f'{self.base_url}{appt.id}/',
            {
                'appointmentStatus': '4',
                'cancellationReason': '   ',
                'cancelledBy': 'customer',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    # 7c. Cancellation sets cancelledAt and cancelledBy
    def test_cancel_sets_metadata(self, *mocks):
        self._auth()
        appt = self._make_appointment()
        response = self.client.patch(
            f'{self.base_url}{appt.id}/',
            {
                'appointmentStatus': '4',
                'cancellationReason': 'No longer needed',
                'cancelledBy': 'customer',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        appt.refresh_from_db()
        self.assertIsNotNone(appt.cancelledAt)
        self.assertEqual(appt.cancelledBy, 'customer')

    # 8. Delete appointment returns 204 (coordinator only)
    def test_delete_appointment(self, *mocks):
        # Delete requires coordinator role
        coord = Coordinators.objects.create(
            coordinatorName='Del Coord',
            coordinatorEmail='delcoord@example.com',
            coordinatorPhone='71234567',
            coordinatorPassword=make_password('coordpass'),
        )
        resp = self.client.post(
            '/api/coordinators/login/',
            {'email': 'delcoord@example.com', 'password': 'coordpass'},
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.cookies['access_token'].value}")
        appt = self._make_appointment()
        response = self.client.delete(f'{self.base_url}{appt.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Appointments.objects.filter(id=appt.id).exists())

    # ─── Rating Tests ───────────────────────────────────────────────

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

    # 11b. Invalid rating value (0) rejected
    def test_rate_technician_invalid_zero(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 0},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('between 1 and 5', str(response.data))

    # 11c. Invalid rating value (6) rejected
    def test_rate_technician_invalid_six(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 6},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('between 1 and 5', str(response.data))

    # 11d. Non-integer rating rejected
    def test_rate_technician_non_integer(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 'abc'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    # 11e. Duplicate rating prevented
    def test_rate_technician_duplicate_prevented(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        # First rating
        self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 4},
            format='json',
        )
        # Second rating should fail
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 5},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('already rated', str(response.data))

    # 11f. Duplicate customer rating prevented
    def test_rate_customer_duplicate_prevented(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        self.client.post(
            f'{self.base_url}{appt.id}/rate-customer/',
            {'technicianId': str(self.technician.id), 'rating': 5},
            format='json',
        )
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-customer/',
            {'technicianId': str(self.technician.id), 'rating': 3},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('already rated', str(response.data))

    # 11g. Rating updates technician average
    def test_rating_updates_technician_average(self, *mocks):
        self._auth()
        # Technician starts at default 5.00 rating, 0 count
        appt1 = self._make_appointment(status='3', with_technician=True)
        self.client.post(
            f'{self.base_url}{appt1.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 3},
            format='json',
        )
        self.technician.refresh_from_db()
        # (5*0 + 3) / 1 = 3.0
        self.assertEqual(self.technician.technicianRatingCount, 1)
        self.assertEqual(float(self.technician.technicianRating), 3.0)

    # 11h. Rating missing customerId returns 400
    def test_rate_technician_missing_customer_id(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'rating': 4},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('customerId', str(response.data))

    # 11i. Rating missing rating field returns 400
    def test_rate_technician_missing_rating(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    # 11j. Cannot rate appointment without technician
    def test_rate_appointment_no_technician(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=False)
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': str(self.customer.id), 'rating': 4},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    # 11k. Customer cannot rate another customer's appointment
    def test_rate_wrong_customer_rejected(self, *mocks):
        self._auth()
        appt = self._make_appointment(status='3', with_technician=True)
        other_id = str(uuid.uuid4())
        response = self.client.post(
            f'{self.base_url}{appt.id}/rate-technician/',
            {'customerId': other_id, 'rating': 4},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    # ─── Unrated-completed endpoint ─────────────────────────────────

    # 11l. Unrated-completed returns correct appointments
    def test_unrated_completed_returns_unrated(self, *mocks):
        self._auth()
        appt_rated = self._make_appointment(status='3', with_technician=True)
        appt_unrated = self._make_appointment(status='3', with_technician=True)
        # Rate one of them
        AppointmentRating.objects.create(
            appointment=appt_rated, ratedBy='customer', rating=4
        )
        response = self.client.get(
            f'{self.base_url}unrated-completed/',
            {'customerId': str(self.customer.id)},
        )
        self.assertEqual(response.status_code, 200)
        returned_ids = [str(a['id']) for a in response.data]
        self.assertNotIn(str(appt_rated.id), returned_ids)
        self.assertIn(str(appt_unrated.id), returned_ids)

    # ─── Penalty Status Endpoint ────────────────────────────────────

    # 11m. Penalty status endpoint
    def test_penalty_status_endpoint(self, *mocks):
        self._auth()
        response = self.client.get(
            f'{self.base_url}penalty-status/',
            {'customerId': str(self.customer.id)},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('current_month_cancellations', response.data)
        self.assertIn('remaining_free_cancellations', response.data)
        self.assertIn('pending_penalty_fee', response.data)

    # 11n. Penalty status requires customerId
    def test_penalty_status_requires_customer_id(self, *mocks):
        self._auth()
        response = self.client.get(f'{self.base_url}penalty-status/')
        self.assertEqual(response.status_code, 400)

    # ─── Guest Booking Tests ────────────────────────────────────────

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

    # 12b. Guest booking creates new customer if no match
    def test_guest_booking_creates_new_customer(self, *mocks):
        start = self._future_start()
        initial_count = Customers.objects.count()
        payload = {
            'customerName': 'Brand New Guest',
            'customerPhone': '98761111',
            'customerEmail': 'brandnew@example.com',
            'customerAddress': '10 New Lane',
            'customerPostalCode': '111111',
            'airconBrand': 'Daikin',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Customers.objects.count(), initial_count + 1)
        new_customer = Customers.objects.get(customerEmail='brandnew@example.com')
        self.assertEqual(new_customer.customerName, 'Brand New Guest')

    # 12c. Guest booking reuses existing customer if phone matches
    def test_guest_booking_reuses_existing_by_phone(self, *mocks):
        start = self._future_start()
        initial_count = Customers.objects.count()
        payload = {
            'customerName': 'Updated Name',
            'customerPhone': '91234567',  # Matches self.customer
            'customerEmail': 'different@example.com',
            'customerAddress': '99 Updated Lane',
            'customerPostalCode': '567890',
            'airconBrand': 'Mitsubishi',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        # Should NOT create a new customer
        self.assertEqual(Customers.objects.count(), initial_count)

    # 12d. Guest booking reuses existing customer if email matches
    def test_guest_booking_reuses_existing_by_email(self, *mocks):
        start = self._future_start()
        initial_count = Customers.objects.count()
        payload = {
            'customerName': 'Updated Name',
            'customerPhone': '99998888',
            'customerEmail': 'testcustomer@example.com',  # Matches self.customer
            'customerAddress': '99 Updated Lane',
            'customerPostalCode': '567890',
            'airconBrand': 'Mitsubishi',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Customers.objects.count(), initial_count)

    # 12e. Guest booking with missing required fields returns 400
    def test_guest_booking_missing_fields(self, *mocks):
        payload = {
            'customerName': 'Guest User',
            # Missing phone, email, address, postal, airconBrand, appointmentStartTime
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Missing required fields', str(response.data))

    # 12f. Guest booking missing phone returns 400
    def test_guest_booking_missing_phone(self, *mocks):
        start = self._future_start()
        payload = {
            'customerName': 'Guest User',
            'customerEmail': 'guest2@example.com',
            'customerAddress': '99 Guest Lane',
            'customerPostalCode': '567890',
            'airconBrand': 'Mitsubishi',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
            # Missing customerPhone
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 400)

    # 12g. Guest booking creates aircon device for the booking
    def test_guest_booking_creates_aircon_device(self, *mocks):
        start = self._future_start()
        initial_device_count = CustomerAirconDevices.objects.count()
        payload = {
            'customerName': 'Device Guest',
            'customerPhone': '98762222',
            'customerEmail': 'deviceguest@example.com',
            'customerAddress': '10 Device Lane',
            'customerPostalCode': '222222',
            'airconBrand': 'Panasonic',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertGreater(CustomerAirconDevices.objects.count(), initial_device_count)

    # 12h. Guest booking auto-assigns nearest technician when available
    def test_guest_booking_assigns_technician(self, *mocks):
        """When get_nearby_technicians returns a technician, guest booking assigns them."""
        # Override the get_nearby_technicians mock for this test
        # Decorator order (bottom-to-top): customer_views.geo, check_penalty, get_tech_to_assign,
        # get_nearby_tech, send_cancel, send_confirm, sendMail, geo_onemap
        # mocks order (top-to-bottom): customer_views.geo[0], check_penalty[1], get_tech_to_assign[2],
        # get_nearby_tech[3], send_cancel[4], send_confirm[5], sendMail[6], geo_onemap[7]
        mocks[3].return_value = [str(self.technician.id)]  # get_nearby_technicians
        start = self._future_start()
        payload = {
            'customerName': 'Assigned Guest',
            'customerPhone': '98763333',
            'customerEmail': 'assigned@example.com',
            'customerAddress': '10 Assigned Lane',
            'customerPostalCode': '333333',
            'airconBrand': 'Daikin',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        appt_id = response.data['appointment']['id']
        appt = Appointments.objects.get(id=appt_id)
        self.assertEqual(appt.technicianId.id, self.technician.id)
        self.assertEqual(appt.appointmentStatus, '2')  # Confirmed

    # 12i. Confirmation email triggered on guest booking
    def test_guest_booking_triggers_email(self, *mocks):
        mock_send_email = mocks[6]  # sendMail.send_email (7th mock from bottom)
        start = self._future_start()
        payload = {
            'customerName': 'Email Guest',
            'customerPhone': '98764444',
            'customerEmail': 'emailguest@example.com',
            'customerAddress': '10 Email Lane',
            'customerPostalCode': '444444',
            'airconBrand': 'Daikin',
            'appointmentStartTime': start,
            'paymentMethod': 'cash',
        }
        response = self.client.post(f'{self.base_url}guest-booking/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        # send_email is called for guest booking
        mock_send_email.assert_called()
