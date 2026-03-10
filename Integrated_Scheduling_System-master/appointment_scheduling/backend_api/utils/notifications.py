"""
Notification utilities for appointment confirmations and cancellations.
Sends both email and Telegram notifications (if the user has linked Telegram).
"""

import logging
from datetime import datetime

from .sendMail import send_email
from .telegram_bot import send_telegram_message

logger = logging.getLogger(__name__)


def format_timestamp_to_readable(timestamp):
    """
    Convert Unix timestamp to human-readable date/time string.

    Args:
        timestamp: Unix epoch timestamp (integer)

    Returns:
        Formatted datetime string (e.g., "Monday, 15 January 2024 at 2:30 PM")
    """
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%A, %d %B %Y at %I:%M %p")


def _send_telegram_if_linked(user_obj, message_text):
    """
    Send a Telegram notification if the user has a linked Telegram account.
    Silently skips if not linked. Logs errors but never raises.
    """
    chat_id = getattr(user_obj, "telegramChatId", None)
    if chat_id:
        try:
            send_telegram_message(chat_id, message_text)
        except Exception as e:
            logger.exception("Failed to send Telegram notification: %s", e)


def send_appointment_confirmation(appointment, customer, technician=None):
    """
    Send appointment confirmation email and Telegram message to customer and technician.

    Args:
        appointment: Appointment object
        customer: Customer object
        technician: Technician object (optional - may be None if not yet assigned)

    Returns:
        bool: True if emails sent successfully
    """
    # Format appointment times
    start_time = format_timestamp_to_readable(appointment.appointmentStartTime)
    end_time = format_timestamp_to_readable(appointment.appointmentEndTime)

    # Get appointment status display
    status_map = {"1": "Pending", "2": "Confirmed", "3": "Completed", "4": "Cancelled"}
    status = status_map.get(appointment.appointmentStatus, "Unknown")

    # Get number of aircon units
    num_aircons = len(appointment.airconToService) if appointment.airconToService else 0

    # Email to Customer
    customer_subject = f"Appointment Confirmation - AirServe"
    customer_body = f"""Dear {customer.customerName},

Your air conditioning service appointment has been scheduled!

APPOINTMENT DETAILS:
-------------------
Appointment ID: {appointment.id}
Status: {status}
Start Time: {start_time}
End Time: {end_time}
Number of Units: {num_aircons}

SERVICE ADDRESS:
---------------
{customer.customerAddress}
Postal Code: {customer.customerPostalCode}
"""

    if technician:
        customer_body += f"""
ASSIGNED TECHNICIAN:
-------------------
Name: {technician.technicianName}
Phone: {technician.technicianPhone}
"""
    else:
        customer_body += """
TECHNICIAN:
----------
A technician will be assigned to your appointment shortly. You will receive another notification once assigned.
"""

    customer_body += """
If you need to reschedule or cancel this appointment, please contact us as soon as possible.

Thank you for choosing AirServe!

Best regards,
The AirServe Team
"""

    # Send email to customer
    customer_email_sent = send_email(
        subject=customer_subject,
        body=customer_body,
        to_email=customer.customerEmail,
        alias_name="AirServe Appointments",
    )

    # Telegram notification to customer
    tech_info = (
        f"Technician: {technician.technicianName} ({technician.technicianPhone})"
        if technician
        else "Technician: Pending assignment"
    )
    _send_telegram_if_linked(
        customer,
        f"📋 <b>Appointment {status}</b>\n\n"
        f"🕐 {start_time}\n"
        f"🔧 {num_aircons} aircon unit(s)\n"
        f"👤 {tech_info}\n"
        f"📍 {customer.customerAddress}, S{customer.customerPostalCode}",
    )

    # Email to Technician (if assigned)
    technician_email_sent = True  # Default to True if no technician
    if technician:
        tech_subject = f"New Appointment Assignment - AirServe"
        tech_body = f"""Dear {technician.technicianName},

You have been assigned to a new service appointment.

APPOINTMENT DETAILS:
-------------------
Appointment ID: {appointment.id}
Start Time: {start_time}
End Time: {end_time}
Number of Units: {num_aircons}

CUSTOMER INFORMATION:
--------------------
Name: {customer.customerName}
Phone: {customer.customerPhone}
Email: {customer.customerEmail}

SERVICE ADDRESS:
---------------
{customer.customerAddress}
Postal Code: {customer.customerPostalCode}

Please ensure you arrive on time and bring all necessary equipment.

Best regards,
The AirServe Team
"""

        if hasattr(technician, "technicianEmail") and technician.technicianEmail:
            technician_email_sent = send_email(
                subject=tech_subject,
                body=tech_body,
                to_email=technician.technicianEmail,
                alias_name="AirServe Scheduling",
            )

        # Telegram notification to technician
        _send_telegram_if_linked(
            technician,
            f"🔧 <b>New Assignment</b>\n\n"
            f"🕐 {start_time}\n"
            f"🔧 {num_aircons} aircon unit(s)\n"
            f"👤 Customer: {customer.customerName}\n"
            f"📞 {customer.customerPhone}\n"
            f"📍 {customer.customerAddress}, S{customer.customerPostalCode}",
        )

    return customer_email_sent and technician_email_sent


def send_appointment_cancellation(
    appointment, customer, technician, cancelled_by, cancellation_reason
):
    """
    Send appointment cancellation email and Telegram message to customer and technician.

    Args:
        appointment: Appointment object
        customer: Customer object
        technician: Technician object (may be None)
        cancelled_by: Role of person who cancelled ('customer', 'technician', 'coordinator')
        cancellation_reason: Reason for cancellation

    Returns:
        bool: True if emails sent successfully
    """
    # Format appointment times
    start_time = format_timestamp_to_readable(appointment.appointmentStartTime)

    # Determine who cancelled
    cancelled_by_text = {
        "customer": "the customer",
        "technician": "the assigned technician",
        "coordinator": "our scheduling team",
    }.get(cancelled_by, "the system")

    # Email to Customer
    customer_subject = f"Appointment Cancelled - AirServe"
    customer_body = f"""Dear {customer.customerName},

Your air conditioning service appointment has been CANCELLED.

CANCELLED APPOINTMENT DETAILS:
-----------------------------
Appointment ID: {appointment.id}
Scheduled Time: {start_time}

CANCELLATION INFORMATION:
------------------------
Cancelled By: {cancelled_by_text}
Reason: {cancellation_reason}

SERVICE ADDRESS:
---------------
{customer.customerAddress}
Postal Code: {customer.customerPostalCode}
"""

    if cancelled_by != "customer":
        customer_body += """
We apologize for any inconvenience this may cause.

If you would like to reschedule your service, please contact us and we'll be happy to arrange a new appointment at your convenience.
"""
    else:
        customer_body += """
Your appointment has been successfully cancelled as requested.

If you would like to book a new appointment in the future, please don't hesitate to contact us.
"""

    customer_body += """
Thank you for your understanding.

Best regards,
The AirServe Team
"""

    # Send email to customer
    customer_email_sent = send_email(
        subject=customer_subject,
        body=customer_body,
        to_email=customer.customerEmail,
        alias_name="AirServe Appointments",
    )

    # Telegram notification to customer
    _send_telegram_if_linked(
        customer,
        f"❌ <b>Appointment Cancelled</b>\n\n"
        f"🕐 Was scheduled: {start_time}\n"
        f"📝 Cancelled by: {cancelled_by_text}\n"
        f"💬 Reason: {cancellation_reason}",
    )

    # Email to Technician (if assigned and cancellation wasn't by technician)
    technician_email_sent = True  # Default to True
    if technician and cancelled_by != "technician":
        tech_subject = f"Appointment Cancelled - AirServe"
        tech_body = f"""Dear {technician.technicianName},

An appointment assigned to you has been CANCELLED.

CANCELLED APPOINTMENT DETAILS:
-----------------------------
Appointment ID: {appointment.id}
Scheduled Time: {start_time}

CANCELLATION INFORMATION:
------------------------
Cancelled By: {cancelled_by_text}
Reason: {cancellation_reason}

CUSTOMER INFORMATION:
--------------------
Name: {customer.customerName}
Address: {customer.customerAddress}
Postal Code: {customer.customerPostalCode}

This appointment has been removed from your schedule.

Best regards,
The AirServe Team
"""

        if hasattr(technician, "technicianEmail") and technician.technicianEmail:
            technician_email_sent = send_email(
                subject=tech_subject,
                body=tech_body,
                to_email=technician.technicianEmail,
                alias_name="AirServe Scheduling",
            )

        # Telegram notification to technician
        _send_telegram_if_linked(
            technician,
            f"❌ <b>Appointment Cancelled</b>\n\n"
            f"🕐 Was scheduled: {start_time}\n"
            f"👤 Customer: {customer.customerName}\n"
            f"📝 Cancelled by: {cancelled_by_text}\n"
            f"💬 Reason: {cancellation_reason}",
        )

    return customer_email_sent and technician_email_sent


def send_penalty_notification_telegram(customer, penalty_result):
    """Send penalty notice via Telegram if customer has linked account."""
    _send_telegram_if_linked(
        customer,
        f"⚠️ <b>Cancellation Penalty Notice</b>\n\n"
        f"Penalty fee: ${penalty_result['penalty_amount']}\n"
        f"Total pending: ${penalty_result['total_pending_penalty']}\n"
        f"Cancellations this month: {penalty_result['cancellation_count']}",
    )


def send_new_message_telegram(recipient_type, recipient_id, sender_name, subject):
    """
    Notify user via Telegram when they receive a new in-app message.
    Imports models locally to avoid circular imports.
    """
    from ..models import Customers, Technicians

    if recipient_type == "customer":
        user = Customers.objects.filter(id=recipient_id).first()
    elif recipient_type == "technician":
        user = Technicians.objects.filter(id=recipient_id).first()
    else:
        return

    if user:
        _send_telegram_if_linked(
            user,
            f"💬 <b>New Message</b>\n\n"
            f"From: {sender_name}\n"
            f"Subject: {subject}\n\n"
            f"Log in to AirServe to read the full message.",
        )
