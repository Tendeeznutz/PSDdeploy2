# AirServe Telegram Bot — Setup & Operations Guide

## Table of Contents

1. [Initial Setup (One-Time)](#1-initial-setup-one-time)
2. [Environment Configuration](#2-environment-configuration)
3. [Webhook Registration](#3-webhook-registration)
4. [Appointment Reminders (Cron)](#4-appointment-reminders-cron)
5. [How It Works — Customer Flow](#5-how-it-works--customer-flow)
6. [How It Works — Technician Flow](#6-how-it-works--technician-flow)
7. [What Notifications Get Sent](#7-what-notifications-get-sent)
8. [Admin Panel](#8-admin-panel)
9. [Bot Commands](#9-bot-commands)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Initial Setup (One-Time)

### Create the Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts:
   - **Name**: `AirServe Notifications` (display name, can have spaces)
   - **Username**: `AirServeBot` (must end in `Bot`, no spaces)
4. BotFather will reply with a **bot token** like:
   ```
   7123456789:AAF1kD3x5yJzWqP8vN2mR7bT0cU6hL4sE9w
   ```
5. Save this token — you'll need it for the `.env` file

### Optional: Set bot description and commands

Still in BotFather:
```
/setdescription
> AirServe appointment notifications for customers and technicians.

/setcommands
> start - Link your AirServe account
> unlink - Unlink your Telegram from AirServe
> help - Show available commands
```

---

## 2. Environment Configuration

Add these three values to the `.env` file in `appointment_scheduling/`:

```env
TELEGRAM_BOT_TOKEN=7123456789:AAF1kD3x5yJzWqP8vN2mR7bT0cU6hL4sE9w
TELEGRAM_BOT_USERNAME=AirServeBot
TELEGRAM_WEBHOOK_SECRET=any-random-string-you-choose-here
```

| Variable | What it is | Where to get it |
|----------|-----------|-----------------|
| `TELEGRAM_BOT_TOKEN` | Bot API token | BotFather gives this when you create the bot |
| `TELEGRAM_BOT_USERNAME` | Bot username (without @) | The username you chose in BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Shared secret for webhook verification | Generate any random string (e.g. `openssl rand -hex 32`) |

After setting these, restart Gunicorn:
```bash
pkill gunicorn
gunicorn appointment_scheduling.wsgi:application --bind 127.0.0.1:8000 --daemon
```

---

## 3. Webhook Registration

The webhook tells Telegram "send all bot messages to this URL". Run this **once** after deploying (or whenever the domain changes):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ay2526-tp-j.coding36.net/api/telegram/webhook/",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Replace `<TELEGRAM_BOT_TOKEN>` and `<TELEGRAM_WEBHOOK_SECRET>` with the actual values from your `.env`.

**Expected response:**
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

### Verify the webhook is active

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

You should see your URL in the response and `"pending_update_count": 0`.

### Remove webhook (if needed)

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

---

## 4. Appointment Reminders (Cron)

Reminders are sent via a Django management command that should run every 15 minutes. It sends Telegram messages:
- **24 hours** before an appointment
- **1 hour** before an appointment

### Set up the cron job on the server

```bash
crontab -e
```

Add this line (adjust paths to match your server):
```
*/15 * * * * cd /home/<username>/appointment_scheduling && /home/<username>/venv/bin/python manage.py send_reminders >> /tmp/airserve_reminders.log 2>&1
```

### Test it manually

```bash
cd /home/<username>/appointment_scheduling
python manage.py send_reminders
```

Output: `Processed 0 reminder(s)` (or more if there are upcoming appointments with linked Telegram users).

### How deduplication works

The command stores sent reminder keys in a file called `.telegram_reminders_sent.json` in the project root. This prevents duplicate reminders if the cron runs multiple times within the same window. Old entries are automatically pruned after 48 hours.

---

## 5. How It Works — Customer Flow

### Linking their Telegram account

1. Customer logs in to AirServe and goes to their **Profile** page
2. They see a **"Connect Telegram"** button at the bottom of their profile
3. They click the button — a **"Open in Telegram"** link appears
4. Clicking the link opens Telegram and starts a chat with the bot
5. The bot automatically links their account and confirms:
   > "Your Telegram account has been linked to AirServe! You will now receive appointment notifications here."
6. Back on the profile page, the button changes to a green **"Connected"** badge
7. Done — they will now receive Telegram notifications alongside emails

### Unlinking

Two ways to unlink:
- **From the website**: Click the **"Unlink"** button on the Profile page
- **From Telegram**: Send `/unlink` to the bot

Both methods clear the link and stop notifications immediately.

### What the customer sees after linking

Every notification they already get via email will also arrive instantly as a Telegram message. For example, when they book an appointment:

```
Appointment Confirmed

Start: Monday, 10 March 2026 at 02:30 PM
Units: 2 aircon unit(s)
Technician: John Tan (91234567)
Address: 123 Clementi Ave 3, S120123
```

---

## 6. How It Works — Technician Flow

Identical to the customer flow:

1. Technician logs in and goes to **Profile**
2. Clicks **"Connect Telegram"**
3. Taps the link to open Telegram
4. Bot confirms the link
5. They receive job notifications on Telegram

### What the technician sees

When assigned to a new job:
```
New Assignment

Start: Monday, 10 March 2026 at 02:30 PM
Units: 2 aircon unit(s)
Customer: Alice Tan
Phone: 81234567
Address: 123 Clementi Ave 3, S120123
```

---

## 7. What Notifications Get Sent

| Event | Email | In-App Mailbox | Telegram |
|-------|-------|---------------|----------|
| Appointment booked | Customer + Technician | Customer (receipt) | Customer + Technician |
| Technician assigned/changed | Customer + Technician | — | Customer + Technician |
| Appointment cancelled | Customer + Technician | Penalty only | Customer + Technician |
| Cancellation penalty applied | — | Customer | Customer |
| New in-app message received | — | Recipient | Recipient |
| 24h before appointment | — | — | Customer + Technician |
| 1h before appointment | — | — | Customer + Technician |

**Notes:**
- Telegram notifications only go to users who have linked their account
- If a user hasn't linked Telegram, they still get email and in-app notifications as before
- Coordinators do not have Telegram integration (they're internal staff)

---

## 8. Admin Panel

### Viewing linked accounts

In Django Admin (`/admin/`):

- **Customers** list now shows a `telegramChatId` column — `None` means not linked
- **Technicians** list also shows `telegramChatId`
- **Telegram Link Tokens** table shows all generated link tokens, their status (`isUsed`), and expiry time

### Manually unlinking a user

1. Go to the Customer or Technician in Django Admin
2. Set `telegramChatId` to empty/null
3. Save

---

## 9. Bot Commands

Users can send these commands directly to the bot in Telegram:

| Command | What it does |
|---------|-------------|
| `/start` | Shows welcome message with linking instructions |
| `/start <token>` | Links account (automatically triggered by deep link) |
| `/unlink` | Unlinks Telegram from their AirServe account |
| `/help` | Shows list of commands and notification types |

---

## 10. Troubleshooting

### "TELEGRAM_BOT_TOKEN not configured" in logs

The `.env` file is missing the token or Gunicorn wasn't restarted after adding it.

```bash
# Check if the env var is loaded
python manage.py shell -c "import os; print(os.environ.get('TELEGRAM_BOT_TOKEN', 'NOT SET'))"
```

### Webhook not receiving messages

1. Check the webhook is registered:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
2. Look for `"last_error_message"` in the response — common issues:
   - SSL certificate problem → make sure Apache has valid HTTPS
   - 403 Forbidden → the `TELEGRAM_WEBHOOK_SECRET` in `.env` doesn't match what you registered
   - 404 Not Found → the URL path is wrong, should be `/api/telegram/webhook/`

### Link token expired

Tokens expire after 10 minutes. The user just needs to click "Connect Telegram" again on their profile to generate a new one.

### User linked but not receiving notifications

1. Check `telegramChatId` is set in Django Admin for that user
2. Check the Gunicorn/Django logs for Telegram API errors:
   ```bash
   grep "Telegram" /path/to/gunicorn.log
   ```
3. Try sending a test message manually:
   ```bash
   python manage.py shell -c "
   from backend_api.utils.telegram_bot import send_telegram_message
   send_telegram_message(<CHAT_ID>, 'Test message from AirServe')
   "
   ```

### Reminders not sending

1. Check cron is running: `crontab -l`
2. Check the log file: `cat /tmp/airserve_reminders.log`
3. Run manually to see output: `python manage.py send_reminders`
4. Verify appointments exist in the right time window (24h or 1h from now) and have status Pending or Confirmed

### Resetting the reminders dedup file

If reminders were sent but you want to re-send (e.g., for testing):
```bash
rm appointment_scheduling/.telegram_reminders_sent.json
python manage.py send_reminders
```

---

## API Endpoints Reference

These are the endpoints used by the frontend. They can also be called directly for testing.

| Method | URL | Body / Params | Returns |
|--------|-----|---------------|---------|
| `POST` | `/api/telegram/generate-link/` | `{"userType": "customer", "userId": "<uuid>"}` | `{"deepLink": "https://t.me/...", "expiresAt": "..."}` |
| `GET` | `/api/telegram/status/?userType=customer&userId=<uuid>` | — | `{"linked": true}` or `{"linked": false}` |
| `POST` | `/api/telegram/unlink/` | `{"userType": "customer", "userId": "<uuid>"}` | `{"success": true}` |
| `POST` | `/api/telegram/webhook/` | (Telegram sends this automatically) | `{"ok": true}` |

---

## File Reference

| File | Purpose |
|------|---------|
| `backend_api/utils/telegram_bot.py` | Sends messages via Telegram Bot API |
| `backend_api/views/telegram_views.py` | Webhook + linking API endpoints |
| `backend_api/utils/notifications.py` | All notification logic (email + Telegram) |
| `backend_api/management/commands/send_reminders.py` | Cron-based appointment reminders |
| `backend_api/models.py` | `TelegramLinkToken` model + `telegramChatId` fields |
