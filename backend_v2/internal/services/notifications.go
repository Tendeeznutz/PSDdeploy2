// notifications.go — email (SMTP) and Telegram notification dispatch.
package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

// NotificationService sends emails and Telegram messages.
type NotificationService struct {
	SMTPHost      string
	SMTPPort      int
	SMTPUser      string
	SMTPPassword  string
	FromAddress   string
	TelegramToken string
	FrontendURL   string
}

func NewNotificationService(smtpHost string, smtpPort int, smtpUser, smtpPass, telegramToken, frontendURL string) *NotificationService {
	return &NotificationService{
		SMTPHost:      smtpHost,
		SMTPPort:      smtpPort,
		SMTPUser:      smtpUser,
		SMTPPassword:  smtpPass,
		FromAddress:   smtpUser,
		TelegramToken: telegramToken,
		FrontendURL:   frontendURL,
	}
}

// SendEmail sends a plain-text email.  Silently no-ops if SMTP is not configured.
func (n *NotificationService) SendEmail(to, subject, body string) error {
	if n.SMTPUser == "" || n.SMTPPassword == "" {
		return nil
	}
	auth := smtp.PlainAuth("", n.SMTPUser, n.SMTPPassword, n.SMTPHost)
	msg := strings.Join([]string{
		"From: " + n.FromAddress,
		"To: " + to,
		"Subject: " + subject,
		"MIME-version: 1.0",
		"Content-Type: text/plain; charset=\"UTF-8\"",
		"",
		body,
	}, "\r\n")
	addr := fmt.Sprintf("%s:%d", n.SMTPHost, n.SMTPPort)
	return smtp.SendMail(addr, auth, n.FromAddress, []string{to}, []byte(msg))
}

// SendTelegram sends a message to a Telegram chat ID via the Bot API.
// Silently no-ops if the bot token is not configured.
func (n *NotificationService) SendTelegram(chatID int64, text string) error {
	if n.TelegramToken == "" {
		return nil
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", n.TelegramToken)
	resp, err := http.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// AppointmentConfirmationEmail builds the confirmation body.
func AppointmentConfirmationEmail(customerName, technicianName string, startUnix int64) string {
	t := time.Unix(startUnix, 0).UTC().In(singaporeLocation())
	return fmt.Sprintf(
		"Dear %s,\n\nYour appointment has been confirmed.\n\nDate & Time: %s\nTechnician: %s\n\nThank you for choosing AirServe.",
		customerName,
		t.Format("02 Jan 2006, 3:04 PM"),
		technicianName,
	)
}

// AppointmentCancellationEmail builds the cancellation body.
func AppointmentCancellationEmail(recipientName, reason string, startUnix int64) string {
	t := time.Unix(startUnix, 0).UTC().In(singaporeLocation())
	return fmt.Sprintf(
		"Dear %s,\n\nAn appointment scheduled for %s has been cancelled.\n\nReason: %s\n\nWe apologise for any inconvenience.",
		recipientName,
		t.Format("02 Jan 2006, 3:04 PM"),
		reason,
	)
}

func singaporeLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Singapore")
	if err != nil {
		return time.UTC
	}
	return loc
}
