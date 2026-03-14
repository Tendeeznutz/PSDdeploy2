import uuid
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from rest_framework.test import APITestCase, APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from backend_api.models import Appointments, Coordinators, Customers, Messages, Technicians
from backend_api.tests.helpers import auth_client_as


class MessageAPITests(APITestCase):

    def setUp(self):
        AnonRateThrottle.THROTTLE_RATES = {'anon': '1000/minute'}
        UserRateThrottle.THROTTLE_RATES = {'user': '1000/minute'}
        self.client = APIClient()
        self.base_url = '/api/messages/'

        # Create a coordinator for admin-level access
        self.coordinator = Coordinators.objects.create(
            coordinatorName='Test Coordinator',
            coordinatorEmail='coord@example.com',
            coordinatorPhone='80000001',
            coordinatorPassword=make_password('pass1234'),
        )

        # Create and authenticate a customer for all tests
        self.customer = Customers.objects.create(
            customerName='Test Customer',
            customerPostalCode='123456',
            customerAddress='1 Test Road',
            customerPhone='91234567',
            customerEmail='testcustomer@example.com',
            customerPassword=make_password('pass1234'),
            customerLocation='1.3521,103.8198',
        )
        # Default auth as coordinator (can access all messages)
        auth_client_as(self.client, self.coordinator, "coordinator")

        # Shared UUIDs for ORM-created messages
        self.sender_id = uuid.uuid4()
        self.recipient_id = uuid.uuid4()

        # Create a message used in list/inbox/sent/unread/mark-read tests
        self.msg = Messages.objects.create(
            senderType='coordinator',
            senderId=self.coordinator.id,
            senderName='Test Coordinator',
            recipientType='customer',
            recipientId=self.customer.id,
            recipientName='Test Customer',
            subject='Test Subject',
            body='Test body content',
        )

    # 1. Create non-customer message (senderId must match auth user)
    def test_create_message(self):
        payload = {
            'senderType': 'coordinator',
            'senderId': str(self.coordinator.id),
            'senderName': 'Test Coordinator',
            'recipientType': 'customer',
            'recipientId': str(self.customer.id),
            'recipientName': 'Test Customer',
            'subject': 'Hello',
            'body': 'Hello from coordinator.',
        }
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['subject'], 'Hello')

    # 2. Create customer message (fan-out to coordinator + technician)
    @patch('backend_api.views.technician_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
    def test_create_customer_message(self, mock_tech_geo):
        auth_client_as(self.client, self.customer, "customer")
        coordinator = Coordinators.objects.create(
            coordinatorName='Coord Fan',
            coordinatorEmail='coordfan@example.com',
            coordinatorPhone='81111111',
            coordinatorPassword=make_password('coordpass'),
        )
        technician = Technicians.objects.create(
            technicianName='Tech Fan',
            technicianPostalCode='654321',
            technicianAddress='2 Tech Road',
            technicianPhone='82222222',
            technicianPassword=make_password('techpass'),
            technicianLocation='1.3521,103.8198',
        )
        Appointments.objects.create(
            customerId=self.customer,
            technicianId=technician,
            appointmentStartTime=1700000000,
            appointmentEndTime=1700003600,
            airconToService=[],
        )
        payload = {
            'senderType': 'customer',
            'senderId': str(self.customer.id),
            'senderName': self.customer.customerName,
            'subject': 'Fan-out test',
            'body': 'Sending to coordinator and technician.',
        }
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data.get('success'))
        self.assertGreaterEqual(response.data.get('count', 0), 1)

    # 3. List all messages
    def test_list_messages(self):
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

    # 4. List filtered by recipient
    def test_list_filter_by_recipient(self):
        response = self.client.get(self.base_url, {
            'recipientId': str(self.customer.id),
            'recipientType': 'customer',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['subject'], 'Test Subject')

    # 5. Inbox endpoint
    def test_inbox(self):
        response = self.client.get(f'{self.base_url}inbox/', {
            'recipientId': str(self.customer.id),
            'recipientType': 'customer',
        })
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['recipientType'], 'customer')

    # 6. Sent endpoint
    def test_sent(self):
        response = self.client.get(f'{self.base_url}sent/', {
            'senderId': str(self.coordinator.id),
            'senderType': 'coordinator',
        })
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['senderType'], 'coordinator')

    # 7. Mark read
    def test_mark_read(self):
        self.assertFalse(self.msg.isRead)
        response = self.client.patch(f'{self.base_url}{self.msg.id}/mark-read/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['isRead'])
        self.assertIsNotNone(response.data['readAt'])

    # 8. Unread count
    def test_unread_count(self):
        response = self.client.get(f'{self.base_url}unread-count/', {
            'recipientId': str(self.customer.id),
            'recipientType': 'customer',
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('unreadCount', response.data)
        self.assertEqual(response.data['unreadCount'], 1)
