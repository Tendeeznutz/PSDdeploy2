"""
Views for Telegram bot webhook and account linking API.

Webhook: receives POST from Telegram servers when users interact with the bot.
API endpoints: generate link tokens, check status, unlink — called by React frontend.
"""
import json
import logging
import os
import secrets
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import Customers, Technicians, TelegramLinkToken
from ..utils.telegram_bot import send_telegram_message, get_deep_link_url

logger = logging.getLogger(__name__)

WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")


# ============================================================
# Telegram Webhook (called by Telegram servers, not the frontend)
# ============================================================

@csrf_exempt
@require_POST
def telegram_webhook(request):
    """
    Receives POST from Telegram servers when users interact with the bot.
    Handles /start <token> for account linking and /unlink for unlinking.

    This endpoint is NOT behind JWT auth — it's called by Telegram servers.
    We verify authenticity via the X-Telegram-Bot-Api-Secret-Token header.
    """
    # Verify webhook secret
    received_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if WEBHOOK_SECRET and received_secret != WEBHOOK_SECRET:
        return JsonResponse({"ok": False}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"ok": False}, status=400)

    message = data.get("message", {})
    text = message.get("text", "")
    chat = message.get("chat", {})
    chat_id = chat.get("id")

    if not chat_id:
        return JsonResponse({"ok": True})  # Acknowledge but ignore

    # Handle /start command with token payload
    if text.startswith("/start "):
        token_str = text[7:].strip()
        _handle_link_token(chat_id, token_str)
    elif text == "/start":
        send_telegram_message(
            chat_id,
            "Welcome to AirServe Bot! 🔧\n\n"
            "To link your account, go to your Profile page on the AirServe "
            "website and click <b>Connect Telegram</b>. Then tap the link provided.",
        )
    elif text == "/unlink":
        _handle_unlink(chat_id)
    elif text == "/help":
        send_telegram_message(
            chat_id,
            "<b>AirServe Bot Commands</b>\n\n"
            "/start — Link your AirServe account\n"
            "/unlink — Unlink your Telegram from AirServe\n"
            "/help — Show this help message\n\n"
            "Once linked, you'll receive notifications for:\n"
            "• Appointment confirmations\n"
            "• Technician assignments\n"
            "• Cancellations\n"
            "• Appointment reminders (24h and 1h before)\n"
            "• New messages",
        )

    return JsonResponse({"ok": True})


def _handle_link_token(chat_id, token_str):
    """Process a /start <token> command to link a Telegram account."""
    try:
        link_token = TelegramLinkToken.objects.get(
            token=token_str,
            isUsed=False,
            expiresAt__gt=timezone.now(),
        )
    except TelegramLinkToken.DoesNotExist:
        send_telegram_message(
            chat_id,
            "This link has expired or is invalid.\n"
            "Please generate a new link from your AirServe profile page.",
        )
        return

    # Mark token as used
    link_token.isUsed = True
    link_token.save()

    # Save chat_id to the appropriate user model
    if link_token.userType == "customer":
        try:
            customer = Customers.objects.get(id=link_token.userId)
            customer.telegramChatId = chat_id
            customer.save(update_fields=["telegramChatId"])
            send_telegram_message(
                chat_id,
                "✅ Your Telegram account has been linked to AirServe!\n\n"
                "You will now receive appointment notifications here.\n"
                f"Account: {customer.customerName} ({customer.customerEmail})",
            )
        except Customers.DoesNotExist:
            send_telegram_message(chat_id, "Error: Customer account not found.")

    elif link_token.userType == "technician":
        try:
            technician = Technicians.objects.get(id=link_token.userId)
            technician.telegramChatId = chat_id
            technician.save(update_fields=["telegramChatId"])
            send_telegram_message(
                chat_id,
                "✅ Your Telegram account has been linked to AirServe!\n\n"
                "You will now receive job notifications here.\n"
                f"Account: {technician.technicianName}",
            )
        except Technicians.DoesNotExist:
            send_telegram_message(chat_id, "Error: Technician account not found.")


def _handle_unlink(chat_id):
    """Handle /unlink command from the Telegram side."""
    customer = Customers.objects.filter(telegramChatId=chat_id).first()
    technician = Technicians.objects.filter(telegramChatId=chat_id).first()

    unlinked = False
    if customer:
        customer.telegramChatId = None
        customer.save(update_fields=["telegramChatId"])
        unlinked = True
    if technician:
        technician.telegramChatId = None
        technician.save(update_fields=["telegramChatId"])
        unlinked = True

    if unlinked:
        send_telegram_message(
            chat_id, "Your Telegram account has been unlinked from AirServe."
        )
    else:
        send_telegram_message(
            chat_id,
            "No linked AirServe account found for this Telegram chat.",
        )


# ============================================================
# REST API endpoints (called by React frontend)
# ============================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def generate_link_token(request):
    """
    Generate a one-time token for Telegram account linking.

    Body: { "userType": "customer"|"technician", "userId": "<uuid>" }
    Returns: { "token": "...", "deepLink": "https://t.me/...", "expiresAt": "..." }
    """
    user_type = request.data.get("userType")
    user_id = request.data.get("userId")

    if user_type not in ("customer", "technician") or not user_id:
        return Response({"error": "userType and userId required"}, status=400)

    # Verify user exists
    if user_type == "customer":
        if not Customers.objects.filter(id=user_id).exists():
            return Response({"error": "Customer not found"}, status=404)
    else:
        if not Technicians.objects.filter(id=user_id).exists():
            return Response({"error": "Technician not found"}, status=404)

    # Invalidate any existing unused tokens for this user
    TelegramLinkToken.objects.filter(
        userType=user_type, userId=user_id, isUsed=False
    ).update(isUsed=True)

    # Generate new token
    token_str = secrets.token_urlsafe(32)
    expires = timezone.now() + timedelta(minutes=10)

    TelegramLinkToken.objects.create(
        token=token_str,
        userType=user_type,
        userId=user_id,
        expiresAt=expires,
    )

    deep_link = get_deep_link_url(token_str)

    return Response(
        {
            "token": token_str,
            "deepLink": deep_link,
            "expiresAt": expires.isoformat(),
        },
        status=201,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def check_telegram_status(request):
    """
    Check if a user has linked their Telegram account.

    Query params: userType, userId
    Returns: { "linked": bool }
    """
    user_type = request.query_params.get("userType")
    user_id = request.query_params.get("userId")

    if user_type == "customer":
        customer = Customers.objects.filter(id=user_id).first()
        if customer:
            return Response({"linked": customer.telegramChatId is not None})
    elif user_type == "technician":
        technician = Technicians.objects.filter(id=user_id).first()
        if technician:
            return Response({"linked": technician.telegramChatId is not None})

    return Response({"error": "User not found"}, status=404)


@api_view(["POST"])
@permission_classes([AllowAny])
def unlink_telegram(request):
    """
    Unlink Telegram from a user account.

    Body: { "userType": "customer"|"technician", "userId": "<uuid>" }
    """
    user_type = request.data.get("userType")
    user_id = request.data.get("userId")

    if user_type == "customer":
        customer = Customers.objects.filter(id=user_id).first()
        if customer and customer.telegramChatId:
            old_chat_id = customer.telegramChatId
            customer.telegramChatId = None
            customer.save(update_fields=["telegramChatId"])
            send_telegram_message(
                old_chat_id,
                "Your AirServe account has been unlinked from Telegram.",
            )
            return Response({"success": True})
    elif user_type == "technician":
        technician = Technicians.objects.filter(id=user_id).first()
        if technician and technician.telegramChatId:
            old_chat_id = technician.telegramChatId
            technician.telegramChatId = None
            technician.save(update_fields=["telegramChatId"])
            send_telegram_message(
                old_chat_id,
                "Your AirServe account has been unlinked from Telegram.",
            )
            return Response({"success": True})

    return Response({"error": "Not linked or user not found"}, status=400)
