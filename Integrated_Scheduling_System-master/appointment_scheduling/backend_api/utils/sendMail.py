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
    from_email = os.environ.get('EMAIL_HOST_USER')
    from_password = os.environ.get('EMAIL_HOST_PASSWORD')

    if not from_email or not from_password:
        logger.error("Email credentials not configured. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD env vars.")
        return False

    msg = MIMEText(body)

    if alias_name:
        msg['From'] = f"{alias_name} <{from_email}>"
    else:
        msg['From'] = from_email

    msg['To'] = to_email
    msg['Subject'] = subject

    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.ehlo()
        server.login(from_email, from_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.close()

        logger.info("Email sent to %s", to_email)
        return True

    except Exception as e:
        logger.exception("Failed to send email to %s", to_email)
        return False
