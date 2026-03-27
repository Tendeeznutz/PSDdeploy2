package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/gofiber/fiber/v2"
)

// POST /api/telegram/webhook/
func telegramWebhookHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		secret := c.Get("X-Telegram-Bot-Api-Secret-Token")
		if a.Cfg.TelegramWebhookSecret != "" && secret != a.Cfg.TelegramWebhookSecret {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "invalid webhook secret"})
		}
		var update struct {
			Message *struct {
				Chat struct {
					ID int64 `json:"id"`
				} `json:"chat"`
				Text string `json:"text"`
			} `json:"message"`
		}
		if err := c.BodyParser(&update); err != nil {
			return c.SendStatus(fiber.StatusOK)
		}
		if update.Message == nil {
			return c.SendStatus(fiber.StatusOK)
		}

		chatID := update.Message.Chat.ID
		text := update.Message.Text

		// Handle /start <token>
		if len(text) > 7 && text[:7] == "/start " {
			token := text[7:]
			go func() {
				var userType, userID string
				var isUsed bool
				var expiresAt time.Time
				err := a.DB.QueryRow(c.Context(),
					`SELECT "userType","userId","isUsed","expiresAt" FROM telegram_link_tokens WHERE token=$1`, token).
					Scan(&userType, &userID, &isUsed, &expiresAt)
				if err != nil || isUsed || time.Now().After(expiresAt) {
					_ = a.Notif.SendTelegram(chatID, "This link is invalid or has expired. Please generate a new one from the app.")
					return
				}
				// Link the account
				if userType == "customer" {
					_, _ = a.DB.Exec(c.Context(), `UPDATE customers SET "telegramChatId"=$1,updated_at=NOW() WHERE id=$2`, chatID, userID)
				} else {
					_, _ = a.DB.Exec(c.Context(), `UPDATE technicians SET "telegramChatId"=$1,updated_at=NOW() WHERE id=$2`, chatID, userID)
				}
				_, _ = a.DB.Exec(c.Context(), `UPDATE telegram_link_tokens SET "isUsed"=TRUE,updated_at=NOW() WHERE token=$1`, token)
				_ = a.Notif.SendTelegram(chatID, "✅ Your Telegram account has been linked to AirServe! You will now receive appointment notifications here.")
			}()
		}
		return c.SendStatus(fiber.StatusOK)
	}
}

// POST /api/telegram/generate-link/
func generateTelegramLinkHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			UserType string `json:"userType"`
			UserID   string `json:"userId"`
		}
		if err := c.BodyParser(&body); err != nil || body.UserType == "" || body.UserID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "userType and userId required"})
		}
		b := make([]byte, 32)
		_, _ = rand.Read(b)
		token := hex.EncodeToString(b)
		expires := time.Now().Add(10 * time.Minute)
		_, err := a.DB.Exec(c.Context(),
			`INSERT INTO telegram_link_tokens (token,"userType","userId","expiresAt") VALUES ($1,$2,$3,$4)`,
			token, body.UserType, body.UserID, expires)
		if err != nil {
			return err
		}
		link := "https://t.me/" + a.Cfg.TelegramBotUsername + "?start=" + token
		return c.JSON(fiber.Map{"token": token, "link": link, "expiresAt": expires})
	}
}

// GET /api/telegram/status/
func telegramStatusHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userType := c.Query("userType")
		userID := c.Query("userId")
		if userType == "" || userID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "userType and userId required"})
		}
		var chatID *int64
		switch userType {
		case "customer":
			_ = a.DB.QueryRow(c.Context(), `SELECT "telegramChatId" FROM customers WHERE id=$1`, userID).Scan(&chatID)
		case "technician":
			_ = a.DB.QueryRow(c.Context(), `SELECT "telegramChatId" FROM technicians WHERE id=$1`, userID).Scan(&chatID)
		}
		linked := chatID != nil
		return c.JSON(fiber.Map{"linked": linked, "telegramChatId": chatID})
	}
}

// POST /api/telegram/unlink/
func telegramUnlinkHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			UserType string `json:"userType"`
			UserID   string `json:"userId"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		switch body.UserType {
		case "customer":
			_, _ = a.DB.Exec(c.Context(), `UPDATE customers SET "telegramChatId"=NULL,updated_at=NOW() WHERE id=$1`, body.UserID)
		case "technician":
			_, _ = a.DB.Exec(c.Context(), `UPDATE technicians SET "telegramChatId"=NULL,updated_at=NOW() WHERE id=$1`, body.UserID)
		}
		return c.JSON(fiber.Map{"message": "Telegram account unlinked."})
	}
}
