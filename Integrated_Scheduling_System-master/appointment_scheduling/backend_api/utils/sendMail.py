import logging
import os
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(subject, body, to_email, alias_name):
    """
    Send an email using Gmail's SMTP server.

    Args:
    - subject (str): Subject of the email.
    - body (str): Body content of the email.
    - to_email (str): Recipient email address.
    - alias_name (str): Alias name to be displayed as the sender.

    Returns:
    - bool: True if email was sent successfully, False otherwise.
    """
    from_email = os.environ.get("EMAIL_HOST_USER")
    from_password = os.environ.get("EMAIL_HOST_PASSWORD")

    if not from_email or not from_password:
        logger.error(
            "EMAIL NOT CONFIGURED: EMAIL_HOST_USER=%s, EMAIL_HOST_PASSWORD=%s",
            "set" if from_email else "MISSING",
            "set" if from_password else "MISSING",
        )
        return False

    # Strip spaces from App Password (Gmail App Passwords are sometimes displayed with spaces)
    from_password = from_password.replace(" ", "")

    msg = MIMEText(body)

    if alias_name:
        msg["From"] = f"{alias_name} <{from_email}>"
    else:
        msg["From"] = from_email

    msg["To"] = to_email
    msg["Subject"] = subject

    try:
        logger.info("EMAIL SEND ATTEMPT: to=%s, from=%s, subject=%s", to_email, from_email, subject)
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30)
        server.ehlo()
        server.login(from_email, from_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.close()

        logger.info("EMAIL SENT OK: to=%s", to_email)
        return True

    except Exception as e:
        logger.exception("EMAIL SEND FAILED: to=%s, error=%s", to_email, e)
        return False
