import logging
import os

import requests as http_requests

logger = logging.getLogger(__name__)


def send_email(subject, body, to_email, alias_name):
    """
    Send an email via Resend HTTP API (SMTP is blocked on Render free tier).

    Falls back to SMTP if RESEND_API_KEY is not set but EMAIL_HOST_USER is.

    Required env var:
        RESEND_API_KEY  – API key from https://resend.com
        RESEND_FROM     – Verified sender (e.g. "AirServe <noreply@yourdomain.com>")
                          or use Resend's test address "onboarding@resend.dev"

    Returns:
        bool: True if email was sent successfully, False otherwise.
    """
    resend_api_key = os.environ.get("RESEND_API_KEY")

    if resend_api_key:
        return _send_via_resend(subject, body, to_email, alias_name, resend_api_key)

    # Fallback: try SMTP (works locally, blocked on Render free tier)
    return _send_via_smtp(subject, body, to_email, alias_name)


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
            logger.error(
                "EMAIL SEND FAILED (Resend): to=%s, status=%s, body=%s",
                to_email, response.status_code, response.text,
            )
            return False

    except Exception as e:
        logger.exception("EMAIL SEND FAILED (Resend): to=%s, error=%s", to_email, e)
        return False


def _send_via_smtp(subject, body, to_email, alias_name):
    """Send email using Gmail SMTP (works locally, blocked on Render free tier)."""
    import smtplib
    from email.mime.text import MIMEText

    from_email = os.environ.get("EMAIL_HOST_USER")
    from_password = os.environ.get("EMAIL_HOST_PASSWORD")

    if not from_email or not from_password:
        logger.error(
            "EMAIL NOT CONFIGURED: no RESEND_API_KEY and no EMAIL_HOST_USER/PASSWORD",
        )
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
