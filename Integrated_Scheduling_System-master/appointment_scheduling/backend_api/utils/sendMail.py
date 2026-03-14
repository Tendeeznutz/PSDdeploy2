import base64
import json
import logging
import os
from email.mime.text import MIMEText

import requests as http_requests

logger = logging.getLogger(__name__)

# Gmail API OAuth2 token endpoint
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def send_email(subject, body, to_email, alias_name):
    """
    Send an email via Gmail API over HTTPS (works on Render free tier).

    Priority order:
    1. Gmail API (GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN)
    2. Resend HTTP API (RESEND_API_KEY)
    3. Gmail SMTP fallback (EMAIL_HOST_USER + EMAIL_HOST_PASSWORD) - blocked on Render

    Returns:
        bool: True if email was sent successfully, False otherwise.
    """
    # 1. Try Gmail API (HTTPS, works everywhere)
    if os.environ.get("GMAIL_REFRESH_TOKEN"):
        return _send_via_gmail_api(subject, body, to_email, alias_name)

    # 2. Try Resend
    resend_api_key = os.environ.get("RESEND_API_KEY")
    if resend_api_key:
        return _send_via_resend(subject, body, to_email, alias_name, resend_api_key)

    # 3. Fallback: SMTP (works locally, blocked on Render free tier)
    return _send_via_smtp(subject, body, to_email, alias_name)


def _get_gmail_access_token():
    """Exchange the refresh token for a fresh access token."""
    client_id = os.environ.get("GMAIL_CLIENT_ID")
    client_secret = os.environ.get("GMAIL_CLIENT_SECRET")
    refresh_token = os.environ.get("GMAIL_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        logger.error("Gmail API credentials incomplete: CLIENT_ID=%s, CLIENT_SECRET=%s, REFRESH_TOKEN=%s",
                      "set" if client_id else "MISSING",
                      "set" if client_secret else "MISSING",
                      "set" if refresh_token else "MISSING")
        return None

    try:
        response = http_requests.post(
            _GOOGLE_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=10,
        )

        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            logger.error("Gmail token refresh failed: status=%s, body=%s",
                          response.status_code, response.text)
            return None
    except Exception as e:
        logger.exception("Gmail token refresh error: %s", e)
        return None


def _send_via_gmail_api(subject, body, to_email, alias_name):
    """Send email using Gmail API over HTTPS (no SMTP needed)."""
    from_email = os.environ.get("EMAIL_HOST_USER", "psdairserve@gmail.com")

    access_token = _get_gmail_access_token()
    if not access_token:
        logger.error("EMAIL SEND FAILED (Gmail API): could not get access token")
        return False

    # Build the MIME message
    msg = MIMEText(body)
    msg["To"] = to_email
    msg["From"] = f"{alias_name} <{from_email}>" if alias_name else from_email
    msg["Subject"] = subject

    # Gmail API expects base64url-encoded raw message
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    try:
        logger.info("EMAIL SEND ATTEMPT (Gmail API): to=%s, from=%s, subject=%s",
                      to_email, from_email, subject)

        response = http_requests.post(
            _GMAIL_SEND_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"raw": raw_message},
            timeout=10,
        )

        if response.status_code == 200:
            msg_id = response.json().get("id", "unknown")
            logger.info("EMAIL SENT OK (Gmail API): to=%s, messageId=%s", to_email, msg_id)
            return True
        else:
            logger.error("EMAIL SEND FAILED (Gmail API): to=%s, status=%s, body=%s",
                          to_email, response.status_code, response.text)
            return False

    except Exception as e:
        logger.exception("EMAIL SEND FAILED (Gmail API): to=%s, error=%s", to_email, e)
        return False


def _send_via_resend(subject, body, to_email, alias_name, api_key):
    """Send email using Resend's HTTP API."""
    from_address = os.environ.get("RESEND_FROM", "AirServe <onboarding@resend.dev>")

    try:
        logger.info("EMAIL SEND ATTEMPT (Resend): to=%s, subject=%s", to_email, subject)
        response = http_requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_address,
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
            timeout=10,
        )

        if response.status_code in (200, 201):
            logger.info("EMAIL SENT OK (Resend): to=%s, id=%s", to_email, response.json().get("id"))
            return True
        else:
            logger.error("EMAIL SEND FAILED (Resend): to=%s, status=%s, body=%s",
                          to_email, response.status_code, response.text)
            return False

    except Exception as e:
        logger.exception("EMAIL SEND FAILED (Resend): to=%s, error=%s", to_email, e)
        return False


def _send_via_smtp(subject, body, to_email, alias_name):
    """Send email using Gmail SMTP (works locally, blocked on Render free tier)."""
    import smtplib

    from_email = os.environ.get("EMAIL_HOST_USER")
    from_password = os.environ.get("EMAIL_HOST_PASSWORD")

    if not from_email or not from_password:
        logger.error("EMAIL NOT CONFIGURED: no GMAIL_REFRESH_TOKEN, no RESEND_API_KEY, no EMAIL_HOST_USER/PASSWORD")
        return False

    from_password = from_password.replace(" ", "")

    msg = MIMEText(body)
    msg["From"] = f"{alias_name} <{from_email}>" if alias_name else from_email
    msg["To"] = to_email
    msg["Subject"] = subject

    try:
        logger.info("EMAIL SEND ATTEMPT (SMTP): to=%s, from=%s, subject=%s", to_email, from_email, subject)
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10)
        server.ehlo()
        server.login(from_email, from_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.close()
        logger.info("EMAIL SENT OK (SMTP): to=%s", to_email)
        return True
    except Exception as e:
        logger.exception("EMAIL SEND FAILED (SMTP): to=%s, error=%s", to_email, e)
        return False
