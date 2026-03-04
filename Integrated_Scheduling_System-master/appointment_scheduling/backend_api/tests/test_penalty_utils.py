from datetime import datetime
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone

from backend_api.models import Appointments, Customers
from backend_api.penalty_utils import (
    CANCELLATION_THRESHOLD,
    PENALTY_AMOUNT,
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

    # 5 – under threshold → no penalty
    def test_no_penalty_under_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD - 1)
        result = check_and_apply_penalty(self.customer.id)
        self.assertFalse(result["penalty_applied"])
        self.assertEqual(result["penalty_amount"], Decimal("0.00"))

    # 6 – over threshold → $20 penalty
    def test_penalty_over_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 1)
        result = check_and_apply_penalty(self.customer.id)
        self.assertTrue(result["penalty_applied"])
        self.assertEqual(result["penalty_amount"], PENALTY_AMOUNT)

    # 7 – increments pendingPenaltyFee
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

    # 8 – clears all when amount=None
    def test_clear_all(self):
        remaining = clear_penalty_fee(self.customer.id)
        self.assertEqual(remaining, Decimal("0.00"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, Decimal("0.00"))

    # 9 – deducts specific amount
    def test_deduct_specific(self):
        remaining = clear_penalty_fee(self.customer.id, amount=Decimal("20.00"))
        self.assertEqual(remaining, Decimal("40.00"))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.pendingPenaltyFee, Decimal("40.00"))

    # 10 – never goes below zero
    def test_never_below_zero(self):
        remaining = clear_penalty_fee(self.customer.id, amount=Decimal("999.00"))
        self.assertEqual(remaining, Decimal("0.00"))


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

    # 11 – correct structure
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

    # 12 – warning when near threshold (remaining ≤ 2)
    def test_warning_near_threshold(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD - 1)  # 4 → remaining=1
        summary = get_penalty_summary(self.customer.id)
        self.assertIsNotNone(summary["warning_message"])
        self.assertIn("free cancellation", summary["warning_message"])

    # 13 – exceeded message when over threshold
    def test_exceeded_message(self):
        self._make_cancelled_batch(CANCELLATION_THRESHOLD + 2)  # 7
        summary = get_penalty_summary(self.customer.id)
        self.assertIsNotNone(summary["warning_message"])
        self.assertIn("exceeded", summary["warning_message"])
        self.assertEqual(summary["remaining_free_cancellations"], 0)
