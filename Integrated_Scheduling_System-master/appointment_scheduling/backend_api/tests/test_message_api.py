import uuid
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from rest_framework.test import APITestCase, APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from backend_api.models import Appointments, Coordinators, Customers, Messages, Technicians


class MessageAPITests(APITestCase):

    def setUp(self):
        from rest_framework.throttling import SimpleRateThrottle
        SimpleRateThrottle.THROTTLE_RATES = {
            'anon': '1000/minute', 'user': '1000/minute',
            'login': '1000/minute', 'guest_booking': '1000/minute',
        }
        self.client = APIClient()
        self.base_url = '/api/messages/'

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
        with patch('backend_api.views.customer_views.geo.get_location_from_postal', return_value='1.3521,103.8198'):
            resp = self.client.post('/api/customers/login/', {
                'email': 'testcustomer@example.com',
                'password': 'pass1234',
            }, format='json')
        token = resp.cookies['access_token'].value
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Shared UUIDs for ORM-created messages
        self.sender_id = uuid.uuid4()
        self.recipient_id = uuid.uuid4()

        # Create a message used in list/inbox/sent/unread/mark-read tests
        self.msg = Messages.objects.create(
            senderType='coordinator',
            senderId=self.sender_id,
            senderName='Coord One',
            recipientType='technician',
            recipientId=self.recipient_id,
            recipientName='Tech One',
            subject='Test Subject',
            body='Test body content',
        )

    # 1. Create non-customer message
    def test_create_message(self):
        payload = {
            'senderType': 'coordinator',
            'senderId': str(uuid.uuid4()),
            'senderName': 'Coord Alice',
            'recipientType': 'technician',
            'recipientId': str(uuid.uuid4()),
            'recipientName': 'Tech Bob',
            'subject': 'Hello',
            'body': 'Hello from coordinator.',
        }
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['subject'], 'Hello')

    # 2. Create customer message (fan-out to coordinator + technician)
    @patch('backend_api.views.technician_views.geo.get_location_from_postal', return_value='1.3521,103.8198')
    def test_create_customer_message(self, mock_tech_geo):
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

    # 3. List messages filtered by recipient
    def test_list_messages(self):
        response = self.client.get(self.base_url, {
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

    # 4. List filtered by recipient
    def test_list_filter_by_recipient(self):
        response = self.client.get(self.base_url, {
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['subject'], 'Test Subject')

    # 5. Inbox endpoint
    def test_inbox(self):
        response = self.client.get(f'{self.base_url}inbox/', {
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['recipientType'], 'technician')

    # 6. Sent endpoint
    def test_sent(self):
        response = self.client.get(f'{self.base_url}sent/', {
            'senderId': str(self.sender_id),
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
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('unreadCount', response.data)
        self.assertEqual(response.data['unreadCount'], 1)

    # 9. Mark-read changes isRead to True and sets readAt
    def test_mark_read_updates_fields(self):
        self.assertFalse(self.msg.isRead)
        self.assertIsNone(self.msg.readAt)
        self.client.patch(f'{self.base_url}{self.msg.id}/mark-read/')
        self.msg.refresh_from_db()
        self.assertTrue(self.msg.isRead)
        self.assertIsNotNone(self.msg.readAt)

    # 10. Unread count decreases after marking read
    def test_unread_count_decreases_after_mark_read(self):
        self.client.patch(f'{self.base_url}{self.msg.id}/mark-read/')
        response = self.client.get(f'{self.base_url}unread-count/', {
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['unreadCount'], 0)

    # 11. Multiple unread messages counted correctly
    def test_multiple_unread_messages(self):
        Messages.objects.create(
            senderType='coordinator',
            senderId=self.sender_id,
            senderName='Coord One',
            recipientType='technician',
            recipientId=self.recipient_id,
            recipientName='Tech One',
            subject='Second Message',
            body='Second body',
        )
        response = self.client.get(f'{self.base_url}unread-count/', {
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.data['unreadCount'], 2)

    # 12. Inbox only returns messages for the specified recipient
    def test_inbox_filters_correctly(self):
        other_id = uuid.uuid4()
        Messages.objects.create(
            senderType='coordinator',
            senderId=self.sender_id,
            senderName='Coord One',
            recipientType='technician',
            recipientId=other_id,
            recipientName='Other Tech',
            subject='Other Message',
            body='Not for recipient',
        )
        response = self.client.get(f'{self.base_url}inbox/', {
            'recipientId': str(self.recipient_id),
            'recipientType': 'technician',
        })
        self.assertEqual(response.status_code, 200)
        for msg in response.data:
            self.assertEqual(str(msg['recipientId']), str(self.recipient_id))

    # 13. Sent only returns messages from the specified sender
    def test_sent_filters_correctly(self):
        other_sender = uuid.uuid4()
        Messages.objects.create(
            senderType='coordinator',
            senderId=other_sender,
            senderName='Other Coord',
            recipientType='technician',
            recipientId=self.recipient_id,
            recipientName='Tech One',
            subject='From Other',
            body='Different sender',
        )
        response = self.client.get(f'{self.base_url}sent/', {
            'senderId': str(self.sender_id),
            'senderType': 'coordinator',
        })
        self.assertEqual(response.status_code, 200)
        for msg in response.data:
            self.assertEqual(str(msg['senderId']), str(self.sender_id))

    # 14. Create message missing required fields returns 400
    def test_create_message_missing_body(self):
        payload = {
            'senderType': 'coordinator',
            'senderId': str(uuid.uuid4()),
            'senderName': 'Coord Test',
            'recipientType': 'technician',
            'recipientId': str(uuid.uuid4()),
            'recipientName': 'Tech Test',
            'subject': 'No body',
            # Missing 'body'
        }
        response = self.client.post(self.base_url, payload, format='json')
        self.assertEqual(response.status_code, 400)

    # 15. Auth required for messages
    def test_auth_required(self):
        client = APIClient()
        response = client.get(self.base_url)
        self.assertEqual(response.status_code, 401)
