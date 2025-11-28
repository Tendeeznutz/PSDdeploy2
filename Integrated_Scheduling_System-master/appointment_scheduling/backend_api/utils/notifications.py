"""
Notification utilities for appointment confirmations and cancellations.
"""
from datetime import datetime
from .sendMail import send_email


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


def send_appointment_confirmation(appointment, customer, technician=None):
    """
    Send appointment confirmation email to customer and technician.

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
    status_map = {
        '1': 'Pending',
        '2': 'Confirmed',
        '3': 'Completed',
        '4': 'Cancelled'
    }
    status = status_map.get(appointment.appointmentStatus, 'Unknown')

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
        alias_name="AirServe Appointments"
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

        # Note: Technicians don't have email in the current model
        # This is a placeholder - you may need to add email field to Technicians model
        # For now, we'll skip sending to technicians
        # technician_email_sent = send_email(
        #     subject=tech_subject,
        #     body=tech_body,
        #     to_email=technician.technicianEmail,  # This field doesn't exist yet
        #     alias_name="AirServe Scheduling"
        # )

    return customer_email_sent and technician_email_sent


def send_appointment_cancellation(appointment, customer, technician, cancelled_by, cancellation_reason):
    """
    Send appointment cancellation email to customer and technician.

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
        'customer': 'the customer',
        'technician': 'the assigned technician',
        'coordinator': 'our scheduling team'
    }.get(cancelled_by, 'the system')

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

    if cancelled_by != 'customer':
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
        alias_name="AirServe Appointments"
    )

    # Email to Technician (if assigned and cancellation wasn't by technician)
    technician_email_sent = True  # Default to True
    if technician and cancelled_by != 'technician':
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

        # Note: Technicians don't have email in the current model
        # This is a placeholder
        # technician_email_sent = send_email(
        #     subject=tech_subject,
        #     body=tech_body,
        #     to_email=technician.technicianEmail,  # This field doesn't exist yet
        #     alias_name="AirServe Scheduling"
        # )

    return customer_email_sent and technician_email_sent
