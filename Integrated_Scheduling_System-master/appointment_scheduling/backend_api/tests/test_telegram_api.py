import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from backend_api.models import Customers, Technicians, TelegramLinkToken


WEBHOOK_URL = "/api/telegram/webhook/"
GENERATE_LINK_URL = "/api/telegram/generate-link/"
STATUS_URL = "/api/telegram/status/"
UNLINK_URL = "/api/telegram/unlink/"


class TelegramWebhookTests(TestCase):
    """Tests for the Telegram webhook endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.customer = Customers.objects.create(
            customerName="Tele Customer",
            customerPostalCode="123456",
            customerAddress="1 Tele Street",
            customerPhone="91234567",
            customerEmail="tele@example.com",
            customerPassword=make_password("telepass"),
            customerLocation="1.3521,103.8198",
        )

    def _webhook_post(self, body, secret="testsecret"):
        return self.client.post(
            WEBHOOK_URL,
            data=json.dumps(body),
            content_type="application/json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=secret,
        )

    # 1. Webhook rejects requests without valid secret
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    def test_webhook_rejects_wrong_secret(self):
        body = {"message": {"text": "/start", "chat": {"id": 12345}}}
        response = self._webhook_post(body, secret="wrongsecret")
        self.assertEqual(response.status_code, 403)

    # 2. Webhook rejects when no secret configured
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "")
    def test_webhook_rejects_no_configured_secret(self):
        body = {"message": {"text": "/start", "chat": {"id": 12345}}}
        response = self._webhook_post(body, secret="anything")
        self.assertEqual(response.status_code, 403)

    # 3. Webhook handles malformed JSON
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    def test_webhook_handles_malformed_json(self):
        response = self.client.post(
            WEBHOOK_URL,
            data="not json",
            content_type="application/json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="testsecret",
        )
        self.assertEqual(response.status_code, 400)

    # 4. Webhook with valid /start <token> links customer account
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    @patch("backend_api.views.telegram_views.send_telegram_message")
    def test_start_with_valid_token_links_customer(self, mock_send):
        token = TelegramLinkToken.objects.create(
            token="validtoken123",
            userType="customer",
            userId=self.customer.id,
            expiresAt=timezone.now() + timedelta(minutes=10),
        )
        body = {
            "message": {
                "text": "/start validtoken123",
                "chat": {"id": 99999},
            }
        }
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)

        # Customer should have telegramChatId set
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.telegramChatId, 99999)

        # Token should be marked as used
        token.refresh_from_db()
        self.assertTrue(token.isUsed)

        # Confirmation message sent
        mock_send.assert_called()

    # 5. Webhook with expired token sends error message
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    @patch("backend_api.views.telegram_views.send_telegram_message")
    def test_start_with_expired_token(self, mock_send):
        TelegramLinkToken.objects.create(
            token="expiredtoken",
            userType="customer",
            userId=self.customer.id,
            expiresAt=timezone.now() - timedelta(minutes=5),  # Already expired
        )
        body = {
            "message": {
                "text": "/start expiredtoken",
                "chat": {"id": 99999},
            }
        }
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)
        # Customer should NOT be linked
        self.customer.refresh_from_db()
        self.assertIsNone(self.customer.telegramChatId)
        # Error message sent
        mock_send.assert_called()
        call_args = mock_send.call_args[0]
        self.assertIn("expired", call_args[1].lower())

    # 6. Webhook with already-used token sends error
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    @patch("backend_api.views.telegram_views.send_telegram_message")
    def test_start_with_used_token(self, mock_send):
        TelegramLinkToken.objects.create(
            token="usedtoken",
            userType="customer",
            userId=self.customer.id,
            expiresAt=timezone.now() + timedelta(minutes=10),
            isUsed=True,
        )
        body = {
            "message": {
                "text": "/start usedtoken",
                "chat": {"id": 99999},
            }
        }
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertIsNone(self.customer.telegramChatId)

    # 7. /unlink command clears telegramChatId
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    @patch("backend_api.views.telegram_views.send_telegram_message")
    def test_unlink_command(self, mock_send):
        self.customer.telegramChatId = 99999
        self.customer.save()
        body = {
            "message": {
                "text": "/unlink",
                "chat": {"id": 99999},
            }
        }
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertIsNone(self.customer.telegramChatId)

    # 8. /unlink when not linked sends appropriate message
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    @patch("backend_api.views.telegram_views.send_telegram_message")
    def test_unlink_not_linked(self, mock_send):
        body = {
            "message": {
                "text": "/unlink",
                "chat": {"id": 11111},
            }
        }
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)
        mock_send.assert_called()
        call_args = mock_send.call_args[0]
        self.assertIn("No linked", call_args[1])

    # 9. Webhook links technician account
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    @patch("backend_api.views.telegram_views.send_telegram_message")
    def test_start_links_technician(self, mock_send):
        tech = Technicians.objects.create(
            technicianName="Tele Tech",
            technicianPostalCode="654321",
            technicianAddress="2 Tech Road",
            technicianPhone="81234567",
            technicianPassword=make_password("techpass"),
            technicianLocation="1.3521,103.8198",
        )
        TelegramLinkToken.objects.create(
            token="techtoken",
            userType="technician",
            userId=tech.id,
            expiresAt=timezone.now() + timedelta(minutes=10),
        )
        body = {
            "message": {
                "text": "/start techtoken",
                "chat": {"id": 88888},
            }
        }
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)
        tech.refresh_from_db()
        self.assertEqual(tech.telegramChatId, 88888)

    # 10. Webhook without chat_id is acknowledged but ignored
    @patch("backend_api.views.telegram_views.WEBHOOK_SECRET", "testsecret")
    def test_webhook_no_chat_id(self):
        body = {"message": {"text": "/start sometoken", "chat": {}}}
        response = self._webhook_post(body)
        self.assertEqual(response.status_code, 200)


@patch("backend_api.views.customer_views.geo.get_location_from_postal", return_value="1.3521,103.8198")
class TelegramAPITests(APITestCase):
    """Tests for the Telegram REST API endpoints (generate-link, status, unlink)."""

    def setUp(self):
        from rest_framework.throttling import SimpleRateThrottle
        SimpleRateThrottle.THROTTLE_RATES = {
            'anon': '1000/minute', 'user': '1000/minute',
            'login': '1000/minute', 'guest_booking': '1000/minute',
        }
        self.client = APIClient()

        self.customer = Customers.objects.create(
            customerName="API Customer",
            customerPostalCode="123456",
            customerAddress="1 API Street",
            customerPhone="91234567",
            customerEmail="api@example.com",
            customerPassword=make_password("apipass"),
            customerLocation="1.3521,103.8198",
        )

    def _login_customer(self):
        resp = self.client.post(
            "/api/customers/login/",
            {"email": "api@example.com", "password": "apipass"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.cookies['access_token'].value}")
        return resp.data

    # 11. Generate link requires auth
    def test_generate_link_requires_auth(self, mock_geo):
        client = APIClient()
        resp = client.post(GENERATE_LINK_URL, {}, format="json")
        self.assertEqual(resp.status_code, 401)

    # 12. Check status requires auth
    def test_status_requires_auth(self, mock_geo):
        client = APIClient()
        resp = client.get(STATUS_URL)
        self.assertEqual(resp.status_code, 401)

    # 13. Unlink requires auth
    def test_unlink_requires_auth(self, mock_geo):
        client = APIClient()
        resp = client.post(UNLINK_URL, {}, format="json")
        self.assertEqual(resp.status_code, 401)

    # 14. Generate link with valid data returns token and deep link
    @patch("backend_api.views.telegram_views.get_deep_link_url", return_value="https://t.me/bot?start=xyz")
    def test_generate_link_success(self, mock_deep_link, mock_geo):
        login_data = self._login_customer()
        resp = self.client.post(
            GENERATE_LINK_URL,
            {
                "userType": "customer",
                "userId": str(self.customer.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("token", resp.data)
        self.assertIn("deepLink", resp.data)
        self.assertIn("expiresAt", resp.data)

    # 15. Generate link with wrong userId returns 403
    @patch("backend_api.views.telegram_views.get_deep_link_url", return_value="https://t.me/bot?start=xyz")
    def test_generate_link_wrong_user(self, mock_deep_link, mock_geo):
        import uuid
        self._login_customer()
        resp = self.client.post(
            GENERATE_LINK_URL,
            {
                "userType": "customer",
                "userId": str(uuid.uuid4()),  # Wrong user
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    # 16. Generate link with invalid userType returns 400
    def test_generate_link_invalid_user_type(self, mock_geo):
        self._login_customer()
        resp = self.client.post(
            GENERATE_LINK_URL,
            {
                "userType": "admin",  # Invalid
                "userId": str(self.customer.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    # 17. Check status returns linked=False when no telegram
    def test_status_not_linked(self, mock_geo):
        self._login_customer()
        resp = self.client.get(
            STATUS_URL,
            {
                "userType": "customer",
                "userId": str(self.customer.id),
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["linked"])

    # 18. Check status returns linked=True when telegram is set
    def test_status_linked(self, mock_geo):
        self.customer.telegramChatId = 12345
        self.customer.save()
        self._login_customer()
        resp = self.client.get(
            STATUS_URL,
            {
                "userType": "customer",
                "userId": str(self.customer.id),
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["linked"])

    # 19. Unlink clears telegram and returns success
    @patch("backend_api.views.telegram_views.send_telegram_message")
    @patch("backend_api.views.telegram_views.log_admin_action")
    def test_unlink_success(self, mock_log, mock_send, mock_geo):
        self.customer.telegramChatId = 12345
        self.customer.save()
        self._login_customer()
        resp = self.client.post(
            UNLINK_URL,
            {
                "userType": "customer",
                "userId": str(self.customer.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])
        self.customer.refresh_from_db()
        self.assertIsNone(self.customer.telegramChatId)

    # 20. Unlink when not linked returns 400
    def test_unlink_not_linked(self, mock_geo):
        self._login_customer()
        resp = self.client.post(
            UNLINK_URL,
            {
                "userType": "customer",
                "userId": str(self.customer.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    # 21. Generate link invalidates previous unused tokens
    @patch("backend_api.views.telegram_views.get_deep_link_url", return_value="https://t.me/bot?start=xyz")
    def test_generate_link_invalidates_old_tokens(self, mock_deep_link, mock_geo):
        self._login_customer()
        # Create an existing unused token
        old_token = TelegramLinkToken.objects.create(
            token="oldtoken",
            userType="customer",
            userId=self.customer.id,
            expiresAt=timezone.now() + timedelta(minutes=10),
            isUsed=False,
        )
        # Generate new token
        self.client.post(
            GENERATE_LINK_URL,
            {
                "userType": "customer",
                "userId": str(self.customer.id),
            },
            format="json",
        )
        old_token.refresh_from_db()
        self.assertTrue(old_token.isUsed)
