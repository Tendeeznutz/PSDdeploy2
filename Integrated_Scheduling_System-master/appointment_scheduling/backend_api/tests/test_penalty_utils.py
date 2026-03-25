from datetime import datetime
from decimal import Decimal
from unittest.mock import patch
import uuid

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone

from backend_api.models import Appointments, Customers
from backend_api.penalty_utils import (
    CANCELLATION_THRESHOLD,
    PENALTY_AMOUNT,
    SHORT_NOTICE_PENALTY,
    SHORT_NOTICE_SECONDS,
    check_and_apply_penalty,
    clear_penalty_fee,
    get_monthly_cancellation_count,
    get_penalty_summary,
)


class PenaltyConstantsTests(TestCase):
    def test_cancellation_threshold(self):
        self.assertEqual(CANCELLATION_THRESHOLD, 5)

    def test_penalty_amount(self):
        self.assertEqual(PENALTY_AMOUNT, Decimal("20.00"))

    def test_short_notice_seconds(self):
        self.assertEqual(SHORT_NOTICE_SECONDS, 1800)

    def test_short_notice_penalty_amount(self):
        self.assertEqual(SHORT_NOTICE_PENALTY, Decimal("20.00"))


class GetMonthlyCancellationCountTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="Test",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="91234567",
            customerEmail="test@example.com",
            customerPassword=make_password("p"),
            customerLocation="1,1",
        )
        self.now = timezone.now()

    def _make_cancelled(self, cancelled_at):
        return Appointments.objects.create(
            customerId=self.customer,
            appointmentStartTime=1700000000,
            appointmentEndTime=1700003600,
            appointmentStatus="4",
            cancelledAt=cancelled_at,
            airconToService=[],
        )

    # 1 – zero cancellations
    def test_zero_for_no_cancellations(self):
        count = get_monthly_cancellation_count(self.customer.id)
        self.assertEqual(count, 0)

    # 2 – correct count for current month
    def test_correct_count_current_month(self):
        for _ in range(3):
            self._make_cancelled(self.now)
        count = get_monthly_cancellation_count(self.customer.id)
        self.assertEqual(count, 3)

    # 3 – does not count other months
    def test_ignores_other_months(self):
        # Create cancellation in a previous month
        if self.now.month == 1:
            prev = self.now.replace(year=self.now.year - 1, month=12, day=1)
        else:
            prev = self.now.replace(month=self.now.month - 1, day=1)
        self._make_cancelled(prev)
        # Create cancellation in current month
        self._make_cancelled(self.now)
        count = get_monthly_cancellation_count(self.customer.id)
        self.assertEqual(count, 1)

    # 4 – accepts explicit month/year
    def test_explicit_month_year(self):
        target = timezone.make_aware(datetime(2025, 3, 15, 12, 0))
        self._make_cancelled(target)
        count = get_monthly_cancellation_count(self.customer.id, month=3, year=2025)
        self.assertEqual(count, 1)
        count_other = get_monthly_cancellation_count(
            self.customer.id, month=4, year=2025
        )
        self.assertEqual(count_other, 0)

    # 5 – monthly count resets across month boundaries
    def test_monthly_count_resets_new_month(self):
        """Cancellations in January should not count in February."""
        jan = timezone.make_aware(datetime(2025, 1, 15, 12, 0))
        feb = timezone.make_aware(datetime(2025, 2, 15, 12, 0))
        for _ in range(6):
            self._make_cancelled(jan)
        self._make_cancelled(feb)
        jan_count = get_monthly_cancellation_count(self.customer.id, month=1, year=2025)
        feb_count = get_monthly_cancellation_count(self.customer.id, month=2, year=2025)
        self.assertEqual(jan_count, 6)
        self.assertEqual(feb_count, 1)

    # 6 – does not count non-cancelled appointments
    def test_ignores_non_cancelled_appointments(self):
        Appointments.objects.create(
            customerId=self.customer,
            appointmentStartTime=1700000000,
            appointmentEndTime=1700003600,
            appointmentStatus="1",  # Pending, not cancelled
            airconToService=[],
        )
        Appointments.objects.create(
            customerId=self.customer,
            appointmentStartTime=1700010000,
            appointmentEndTime=1700013600,
            appointmentStatus="3",  # Completed, not cancelled
            airconToService=[],
        )
        self._make_cancelled(self.now)
        count = get_monthly_cancellation_count(self.customer.id)
        self.assertEqual(count, 1)

    # 7 – does not count cancellations from other customers
    def test_ignores_other_customers(self):
        other_customer = Customers.objects.create(
            customerName="Other",
            customerPostalCode="654321",
            customerAddress="b",
            customerPhone="87654321",
            customerEmail="other@example.com",
            customerPassword=make_password("p"),
            customerLocation="1,1",
        )
        Appointments.objects.create(
            customerId=other_customer,
            appointmentStartTime=1700000000,
            appointmentEndTime=1700003600,
            appointmentStatus="4",
            cancelledAt=self.now,
            airconToService=[],
        )
        self._make_cancelled(self.now)
        count = get_monthly_cancellation_count(self.customer.id)
        self.assertEqual(count, 1)

    # 8 – december to january boundary
    def test_december_boundary(self):
        dec = timezone.make_aware(datetime(2025, 12, 20, 12, 0))
        self._make_cancelled(dec)
        count = get_monthly_cancellation_count(self.customer.id, month=12, year=2025)
        self.assertEqual(count, 1)
        count_jan = get_monthly_cancellation_count(self.customer.id, month=1, year=2026)
        self.assertEqual(count_jan, 0)


class CheckAndApplyPenaltyTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="Test",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="91234567",
            customerEmail="test@example.com",
            customerPassword=make_password("p"),
            customerLocation="1,1",
        )
        self.now = timezone.now()

    def _make_cancelled_batch(self, count):
        for _ in range(count):
            Appointments.objects.create(
                customerId=self.customer,
                appointmentStartTime=1700000000,
                appointmentEndTime=1700003600,
                appointmentStatus="4",
                cancelledAt=self.now,
                airconToService=[],
            )

    # 9 – under threshold → no penalty
    def test_no_penalty_under_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD - 1)
        result = check_and_apply_penalty(self.customer.id)
        self.assertFalse(result["penalty_applied"])
        self.assertEqual(result["penalty_amount"], Decimal("0.00"))

    # 10 – exactly at threshold → no penalty (threshold is 5, penalty starts after 5th)
    def test_no_penalty_at_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD)
        result = check_and_apply_penalty(self.customer.id)
        self.assertFalse(result["penalty_applied"])
        self.assertFalse(result["monthly_limit_penalty"])

    # 11 – over threshold → $20 penalty
    def test_penalty_over_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 1)
        result = check_and_apply_penalty(self.customer.id)
        self.assertTrue(result["penalty_applied"])
        self.assertEqual(result["penalty_amount"], PENALTY_AMOUNT)
        self.assertTrue(result["monthly_limit_penalty"])

    # 12 – increments pendingPenaltyFee
    def test_increments_pending_fee(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 1)
        check_and_apply_penalty(self.customer.id)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, PENALTY_AMOUNT)
        # Apply again
        self._make_cancelled_batch(1)  # one more → still over threshold
        check_and_apply_penalty(self.customer.id)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, PENALTY_AMOUNT * 2)

    # 13 – short-notice cancellation penalty (appointment within 30 min)
    def test_short_notice_penalty(self):
        """Cancelling less than 30 minutes before appointment incurs $20 penalty."""
        # Appointment starts 15 minutes from now
        appointment_start = timezone.now().timestamp() + 900  # 15 min
        result = check_and_apply_penalty(
            self.customer.id, appointment_start_time_unix=appointment_start
        )
        self.assertTrue(result["penalty_applied"])
        self.assertTrue(result["short_notice_penalty"])
        self.assertEqual(result["penalty_amount"], SHORT_NOTICE_PENALTY)

    # 14 – no short-notice penalty if appointment is far away
    def test_no_short_notice_penalty_far_appointment(self):
        """Cancelling an appointment > 30 min away does NOT incur short-notice penalty."""
        appointment_start = timezone.now().timestamp() + 7200  # 2 hours away
        result = check_and_apply_penalty(
            self.customer.id, appointment_start_time_unix=appointment_start
        )
        self.assertFalse(result["short_notice_penalty"])

    # 15 – both penalties can stack
    def test_both_penalties_stack(self):
        """Monthly limit + short-notice can both apply, totalling $40."""
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 1)
        appointment_start = timezone.now().timestamp() + 900  # 15 min away
        result = check_and_apply_penalty(
            self.customer.id, appointment_start_time_unix=appointment_start
        )
        self.assertTrue(result["penalty_applied"])
        self.assertTrue(result["monthly_limit_penalty"])
        self.assertTrue(result["short_notice_penalty"])
        self.assertEqual(result["penalty_amount"], PENALTY_AMOUNT + SHORT_NOTICE_PENALTY)

    # 16 – penalty accumulates on pending fee across multiple calls
    def test_penalty_fee_accumulation(self):
        """Multiple penalty calls accumulate on pendingPenaltyFee."""
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 1)
        check_and_apply_penalty(self.customer.id)
        self._make_cancelled_batch(1)
        check_and_apply_penalty(self.customer.id)
        self._make_cancelled_batch(1)
        check_and_apply_penalty(self.customer.id)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, PENALTY_AMOUNT * 3)

    # 17 – nonexistent customer returns no penalty applied
    def test_nonexistent_customer_no_crash(self):
        fake_id = uuid.uuid4()
        result = check_and_apply_penalty(fake_id)
        self.assertFalse(result["penalty_applied"])
        self.assertEqual(result["penalty_amount"], Decimal("0.00"))

    # 18 – result includes total_pending_penalty even when no penalty applied
    def test_returns_total_pending_when_no_penalty(self):
        self.customer.pendingPenaltyFee = Decimal("40.00")
        self.customer.save()
        result = check_and_apply_penalty(self.customer.id)
        self.assertFalse(result["penalty_applied"])
        self.assertEqual(result["total_pending_penalty"], Decimal("40.00"))

    # 19 – no short-notice penalty for past appointments (negative time)
    def test_no_short_notice_for_past_appointment(self):
        """Appointment already passed should not trigger short-notice penalty."""
        appointment_start = timezone.now().timestamp() - 3600  # 1 hour ago
        result = check_and_apply_penalty(
            self.customer.id, appointment_start_time_unix=appointment_start
        )
        self.assertFalse(result["short_notice_penalty"])


class ClearPenaltyFeeTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="Test",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="91234567",
            customerEmail="test@example.com",
            customerPassword=make_password("p"),
            customerLocation="1,1",
            pendingPenaltyFee=Decimal("60.00"),
        )

    # 20 – clears all when amount=None
    def test_clear_all(self):
        remaining = clear_penalty_fee(self.customer.id)
        self.assertEqual(remaining, Decimal("0.00"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, Decimal("0.00"))

    # 21 – deducts specific amount
    def test_deduct_specific(self):
        remaining = clear_penalty_fee(self.customer.id, amount=Decimal("20.00"))
        self.assertEqual(remaining, Decimal("40.00"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, Decimal("40.00"))

    # 22 – never goes below zero
    def test_never_below_zero(self):
        remaining = clear_penalty_fee(self.customer.id, amount=Decimal("999.00"))
        self.assertEqual(remaining, Decimal("0.00"))

    # 23 – nonexistent customer returns 0
    def test_nonexistent_customer_returns_zero(self):
        remaining = clear_penalty_fee(uuid.uuid4())
        self.assertEqual(remaining, Decimal("0.00"))

    # 24 – partial deduction leaves correct remainder
    def test_partial_deduction_correct_remainder(self):
        remaining = clear_penalty_fee(self.customer.id, amount=Decimal("45.00"))
        self.assertEqual(remaining, Decimal("15.00"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, Decimal("15.00"))


class GetPenaltySummaryTests(TestCase):
    def setUp(self):
        self.customer = Customers.objects.create(
            customerName="Test",
            customerPostalCode="123456",
            customerAddress="a",
            customerPhone="91234567",
            customerEmail="test@example.com",
            customerPassword=make_password("p"),
            customerLocation="1,1",
        )
        self.now = timezone.now()

    def _make_cancelled_batch(self, count):
        for _ in range(count):
            Appointments.objects.create(
                customerId=self.customer,
                appointmentStartTime=1700000000,
                appointmentEndTime=1700003600,
                appointmentStatus="4",
                cancelledAt=self.now,
                airconToService=[],
            )

    # 25 – correct structure
    def test_correct_structure(self):
        summary = get_penalty_summary(self.customer.id)
        self.assertIn("current_month_cancellations", summary)
        self.assertIn("remaining_free_cancellations", summary)
        self.assertIn("pending_penalty_fee", summary)
        self.assertIn("warning_message", summary)
        self.assertIn("penalty_threshold", summary)
        self.assertIn("penalty_amount", summary)
        self.assertEqual(summary["penalty_threshold"], CANCELLATION_THRESHOLD)
        self.assertEqual(summary["penalty_amount"], PENALTY_AMOUNT)

    # 26 – warning when near threshold (remaining <= 2)
    def test_warning_near_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD - 1)  # 4 -> remaining=1
        summary = get_penalty_summary(self.customer.id)
        self.assertIsNotNone(summary["warning_message"])
        self.assertIn("free cancellation", summary["warning_message"])

    # 27 – exceeded message when over threshold
    def test_exceeded_message(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 2)  # 7
        summary = get_penalty_summary(self.customer.id)
        self.assertIsNotNone(summary["warning_message"])
        self.assertIn("exceeded", summary["warning_message"])
        self.assertEqual(summary["remaining_free_cancellations"], 0)

    # 28 – no warning when well under threshold
    def test_no_warning_well_under_threshold(self):
        self._make_cancelled_batch(1)  # 1 cancellation, remaining=4
        summary = get_penalty_summary(self.customer.id)
        self.assertIsNone(summary["warning_message"])

    # 29 – exactly at threshold shows limit-reached message
    def test_at_threshold_shows_limit_reached(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD)  # 5
        summary = get_penalty_summary(self.customer.id)
        self.assertIsNotNone(summary["warning_message"])
        self.assertIn("reached", summary["warning_message"])

    # 30 – pending_penalty_fee reflects actual DB value
    def test_pending_fee_reflects_db(self):
        self.customer.pendingPenaltyFee = Decimal("80.00")
        self.customer.save()
        summary = get_penalty_summary(self.customer.id)
        self.assertEqual(summary["pending_penalty_fee"], Decimal("80.00"))

    # 31 – nonexistent customer returns zero penalty fee
    def test_nonexistent_customer_returns_zero_fee(self):
        summary = get_penalty_summary(uuid.uuid4())
        self.assertEqual(summary["pending_penalty_fee"], Decimal("0.00"))
