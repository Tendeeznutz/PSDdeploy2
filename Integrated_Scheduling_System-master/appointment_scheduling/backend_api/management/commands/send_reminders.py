"""
Django management command: send_reminders

Sends Telegram reminders for upcoming appointments:
- 24 hours before appointment
- 1 hour before appointment

Designed to be run via cron every 15 minutes:
    */15 * * * * cd /path/to/project && /path/to/venv/bin/python manage.py send_reminders

Uses a JSON file to track which reminders have already been sent,
to avoid duplicates across cron runs.
"""
import json
import logging
import os
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from backend_api.models import Appointments
from backend_api.utils.telegram_bot import send_telegram_message
from backend_api.utils.notifications import format_timestamp_to_readable

logger = logging.getLogger(__name__)

# Reminder windows in seconds
REMINDER_24H = 24 * 3600
REMINDER_1H = 1 * 3600

# Tolerance: how far before/after the exact window to search (matches cron interval)
TOLERANCE = 15 * 60  # 15 minutes


class Command(BaseCommand):
    help = "Send Telegram reminders for upcoming appointments (24h and 1h before)"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sent_file = os.path.join(
            settings.BASE_DIR, ".telegram_reminders_sent.json"
        )

    def _load_sent(self):
        """Load dict of already-sent reminder keys. Prune entries older than 48h."""
        try:
            with open(self.sent_file, "r") as f:
                data = json.load(f)
                cutoff = time.time() - (48 * 3600)
                return {k: v for k, v in data.items() if v > cutoff}
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_sent(self, sent_dict):
        """Persist sent reminder tracking to disk."""
        with open(self.sent_file, "w") as f:
            json.dump(sent_dict, f)

    def _reminder_key(self, appointment_id, window_label):
        """Generate a unique key for an appointment + reminder window combo."""
        return f"{appointment_id}_{window_label}"

    def handle(self, *args, **options):
        now_epoch = int(time.time())
        sent = self._load_sent()
        count = 0

        reminder_windows = [
            (REMINDER_24H, "24h", "Your appointment is tomorrow"),
            (REMINDER_1H, "1h", "Your appointment is in 1 hour"),
        ]

        for window_seconds, label, message_prefix in reminder_windows:
            target_start = now_epoch + window_seconds - TOLERANCE
            target_end = now_epoch + window_seconds + TOLERANCE

            appointments = (
                Appointments.objects.filter(
                    appointmentStartTime__gte=target_start,
                    appointmentStartTime__lte=target_end,
                    appointmentStatus__in=["1", "2"],  # Pending or Confirmed
                )
                .select_related("customerId", "technicianId")
            )

            for appt in appointments:
                key = self._reminder_key(appt.id, label)
                if key in sent:
                    continue  # Already sent this reminder

                start_str = format_timestamp_to_readable(appt.appointmentStartTime)
                num_aircons = (
                    len(appt.airconToService) if appt.airconToService else 0
                )

                # Send to customer
                customer = appt.customerId
                if customer and customer.telegramChatId:
                    tech_name = (
                        appt.technicianId.technicianName
                        if appt.technicianId
                        else "Pending"
                    )
                    send_telegram_message(
                        customer.telegramChatId,
                        f"⏰ <b>Reminder: {message_prefix}</b>\n\n"
                        f"🕐 {start_str}\n"
                        f"🔧 {num_aircons} aircon unit(s)\n"
                        f"👤 Technician: {tech_name}\n"
                        f"📍 {customer.customerAddress}, S{customer.customerPostalCode}",
                    )
                    logger.info(
                        "Sent %s reminder to customer %s for appt %s",
                        label, customer.id, appt.id,
                    )

                # Send to technician
                technician = appt.technicianId
                if technician and technician.telegramChatId:
                    send_telegram_message(
                        technician.telegramChatId,
                        f"⏰ <b>Reminder: {message_prefix}</b>\n\n"
                        f"🕐 {start_str}\n"
                        f"🔧 {num_aircons} aircon unit(s)\n"
                        f"👤 Customer: {customer.customerName}\n"
                        f"📞 {customer.customerPhone}\n"
                        f"📍 {customer.customerAddress}, S{customer.customerPostalCode}",
                    )
                    logger.info(
                        "Sent %s reminder to technician %s for appt %s",
                        label, technician.id, appt.id,
                    )

                sent[key] = now_epoch
                count += 1

        self._save_sent(sent)
        self.stdout.write(
            self.style.SUCCESS(f"Processed {count} reminder(s)")
        )
