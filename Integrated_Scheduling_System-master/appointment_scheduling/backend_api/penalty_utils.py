"""
Utility functions for managing customer penalty fees for excessive cancellations
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from .models import Appointments, Customers

logger = logging.getLogger(__name__)

# Penalty configuration
CANCELLATION_THRESHOLD = 5  # Number of free cancellations per month
PENALTY_AMOUNT = Decimal("20.00")  # $20 penalty per cancellation over threshold
SHORT_NOTICE_SECONDS = 1800  # 30 minutes
SHORT_NOTICE_PENALTY = Decimal("20.00")  # $20 penalty for short-notice cancellation


def get_monthly_cancellation_count(customer_id, month=None, year=None):
    """
    Count the number of cancelled appointments for a customer in a specific month.

    Args:
        customer_id: UUID of the customer
        month: Month to check (1-12). Defaults to current month.
        year: Year to check. Defaults to current year.

    Returns:
        int: Number of cancelled appointments in the specified month
    """
    if month is None or year is None:
        now = timezone.now()
        month = now.month
        year = now.year

    # Calculate start and end of the month
    start_date = timezone.make_aware(datetime(year, month, 1))

    # Get the first day of next month, then subtract 1 second to get end of current month
    if month == 12:
        end_date = timezone.make_aware(datetime(year + 1, 1, 1))
    else:
        end_date = timezone.make_aware(datetime(year, month + 1, 1))

    # Count cancelled appointments in this month
    cancellation_count = Appointments.objects.filter(
        customerId=customer_id,
        appointmentStatus="4",  # Cancelled status
        cancelledAt__gte=start_date,
        cancelledAt__lt=end_date,
    ).count()

    return cancellation_count


def check_and_apply_penalty(customer_id, appointment_start_time_unix=None):
    """
    Check if customer has exceeded cancellation threshold and apply penalty if needed.
    Also applies a short-notice penalty if the appointment starts within 30 minutes.

    Args:
        customer_id: UUID of the customer
        appointment_start_time_unix: Optional Unix timestamp of the appointment start time.
            If provided and the appointment starts within 30 minutes, a short-notice
            penalty of $20 is applied.

    Returns:
        dict: {
            'penalty_applied': bool,
            'cancellation_count': int,
            'penalty_amount': Decimal,
            'total_pending_penalty': Decimal,
            'short_notice_penalty': bool,
            'monthly_limit_penalty': bool
        }
    """
    # Get current month's cancellation count
    cancellation_count = get_monthly_cancellation_count(customer_id)

    # Initialize result
    result = {
        "penalty_applied": False,
        "cancellation_count": cancellation_count,
        "penalty_amount": Decimal("0.00"),
        "total_pending_penalty": Decimal("0.00"),
        "short_notice_penalty": False,
        "monthly_limit_penalty": False,
    }

    # Determine which penalties apply
    monthly_limit_exceeded = cancellation_count > CANCELLATION_THRESHOLD
    short_notice = False
    if appointment_start_time_unix is not None:
        now_unix = timezone.now().timestamp()
        time_until_appointment = appointment_start_time_unix - now_unix
        if 0 <= time_until_appointment <= SHORT_NOTICE_SECONDS:
            short_notice = True

    # Apply penalties if any conditions are met
    if monthly_limit_exceeded or short_notice:
        try:
            customer = Customers.objects.get(id=customer_id)
            total_penalty = Decimal("0.00")

            if monthly_limit_exceeded:
                total_penalty += PENALTY_AMOUNT
                result["monthly_limit_penalty"] = True

            if short_notice:
                total_penalty += SHORT_NOTICE_PENALTY
                result["short_notice_penalty"] = True

            customer.pendingPenaltyFee += total_penalty
            customer.save()

            result["penalty_applied"] = True
            result["penalty_amount"] = total_penalty
            result["total_pending_penalty"] = customer.pendingPenaltyFee

        except Customers.DoesNotExist:
            logger.warning("Penalty check: customer %s not found", customer_id)
    else:
        # Even if no penalty applied, return current pending penalty
        try:
            customer = Customers.objects.get(id=customer_id)
            result["total_pending_penalty"] = customer.pendingPenaltyFee
        except Customers.DoesNotExist:
            logger.warning("Penalty check: customer %s not found", customer_id)

    return result


def clear_penalty_fee(customer_id, amount=None):
    """
    Clear penalty fee for a customer (called after payment).

    Args:
        customer_id: UUID of the customer
        amount: Specific amount to clear. If None, clears all pending penalties.

    Returns:
        Decimal: Remaining penalty amount
    """
    try:
        customer = Customers.objects.get(id=customer_id)

        if amount is None:
            # Clear all penalties
            customer.pendingPenaltyFee = Decimal("0.00")
        else:
            # Deduct specific amount
            customer.pendingPenaltyFee = max(
                Decimal("0.00"), customer.pendingPenaltyFee - amount
            )

        customer.save()
        return customer.pendingPenaltyFee

    except Customers.DoesNotExist:
        return Decimal("0.00")


def get_penalty_summary(customer_id):
    """
    Get a summary of penalty information for a customer.

    Args:
        customer_id: UUID of the customer

    Returns:
        dict: {
            'current_month_cancellations': int,
            'remaining_free_cancellations': int,
            'pending_penalty_fee': Decimal,
            'warning_message': str or None
        }
    """
    cancellation_count = get_monthly_cancellation_count(customer_id)
    remaining = max(0, CANCELLATION_THRESHOLD - cancellation_count)

    try:
        customer = Customers.objects.get(id=customer_id)
        pending_fee = customer.pendingPenaltyFee
    except Customers.DoesNotExist:
        pending_fee = Decimal("0.00")

    warning_message = None
    if cancellation_count >= CANCELLATION_THRESHOLD:
        if cancellation_count == CANCELLATION_THRESHOLD:
            warning_message = f"You have reached your cancellation limit for this month. Further cancellations will incur a ${PENALTY_AMOUNT} fee each."
        else:
            over_limit = cancellation_count - CANCELLATION_THRESHOLD
            warning_message = f"You have exceeded your monthly cancellation limit by {over_limit} cancellation(s). A ${PENALTY_AMOUNT} penalty per extra cancellation has been added to your next payment."
    elif remaining <= 2:
        warning_message = (
            f"Warning: You have {remaining} free cancellation(s) remaining this month."
        )

    return {
        "current_month_cancellations": cancellation_count,
        "remaining_free_cancellations": remaining,
        "pending_penalty_fee": pending_fee,
        "warning_message": warning_message,
        "penalty_threshold": CANCELLATION_THRESHOLD,
        "penalty_amount": PENALTY_AMOUNT,
    }
