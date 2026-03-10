"""
Telegram Bot API utility for sending notifications.
Uses raw HTTP requests via the `requests` library (already a dependency).
Mirrors the pattern in sendMail.py — env vars for credentials, returns bool, logs errors.
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}"


def _get_token():
    """Get the bot token from environment/settings."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured")
    return token


def send_telegram_message(chat_id, text, parse_mode="HTML"):
    """
    Send a text message to a Telegram chat.

    Args:
        chat_id: Telegram chat ID (integer)
        text: Message text (supports HTML formatting)
        parse_mode: 'HTML' or 'Markdown'

    Returns:
        bool: True if sent successfully
    """
    token = _get_token()
    if not token or not chat_id:
        return False

    url = f"{TELEGRAM_API_BASE.format(token=token)}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            logger.info("Telegram message sent to chat_id=%s", chat_id)
            return True
        else:
            logger.error(
                "Telegram API error %s: %s", resp.status_code, resp.text
            )
            return False
    except Exception as e:
        logger.exception(
            "Failed to send Telegram message to chat_id=%s: %s", chat_id, e
        )
        return False


def get_deep_link_url(token_string):
    """
    Build a Telegram deep link URL for account linking.
    Example: https://t.me/AirServeBot?start=abc123token

    Args:
        token_string: The unique link token

    Returns:
        str: The deep link URL, or empty string if bot username not configured
    """
    bot_username = os.environ.get("TELEGRAM_BOT_USERNAME", "")
    if not bot_username:
        return ""
    return f"https://t.me/{bot_username}?start={token_string}"
