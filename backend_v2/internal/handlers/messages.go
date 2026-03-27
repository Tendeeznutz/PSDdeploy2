package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

// GET /api/messages/inbox/
func inboxHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		recipientID := c.Query("recipientId")
		recipientType := c.Query("recipientType")
		if recipientID == "" || recipientType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "recipientId and recipientType required"})
		}
		return queryMessages(c, a, `WHERE "recipientId"=$1 AND "recipientType"=$2 ORDER BY created_at DESC`, recipientID, recipientType)
	}
}

// GET /api/messages/sent/
func sentHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		senderID := c.Query("senderId")
		senderType := c.Query("senderType")
		if senderID == "" || senderType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "senderId and senderType required"})
		}
		return queryMessages(c, a, `WHERE "senderId"=$1 AND "senderType"=$2 ORDER BY created_at DESC`, senderID, senderType)
	}
}

// GET /api/messages/unread-count/
func unreadCountHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		recipientID := c.Query("recipientId")
		recipientType := c.Query("recipientType")
		if recipientID == "" || recipientType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "recipientId and recipientType required"})
		}
		var count int
		_ = a.DB.QueryRow(c.Context(),
			`SELECT COUNT(*) FROM messages WHERE "recipientId"=$1 AND "recipientType"=$2 AND "isRead"=FALSE`,
			recipientID, recipientType).Scan(&count)
		return c.JSON(fiber.Map{"unreadCount": count})
	}
}

// GET /api/messages/
func listMessagesHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := c.Query("userId")
		userType := c.Query("userType")
		if userID != "" && userType != "" {
			return queryMessages(c, a,
				`WHERE ("recipientId"=$1 AND "recipientType"=$2) OR ("senderId"=$1 AND "senderType"=$2) ORDER BY created_at DESC`,
				userID, userType)
		}
		recipientID := c.Query("recipientId")
		recipientType := c.Query("recipientType")
		if recipientID != "" && recipientType != "" {
			return queryMessages(c, a, `WHERE "recipientId"=$1 AND "recipientType"=$2 ORDER BY created_at DESC`, recipientID, recipientType)
		}
		return queryMessages(c, a, `ORDER BY created_at DESC`)
	}
}

// POST /api/messages/
func createMessageHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			SenderType         string  `json:"senderType"`
			SenderID           string  `json:"senderId"`
			SenderName         string  `json:"senderName"`
			RecipientType      string  `json:"recipientType"`
			RecipientID        string  `json:"recipientId"`
			RecipientName      string  `json:"recipientName"`
			Subject            string  `json:"subject"`
			Body               string  `json:"body"`
			RelatedAppointment *string `json:"relatedAppointment"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}

		var msgs []fiber.Map

		// Customer special path: no recipient specified → send to first coordinator (and optionally technician)
		if body.SenderType == "customer" && body.RecipientID == "" {
			var coordID, coordName string
			_ = a.DB.QueryRow(c.Context(),
				`SELECT id,"coordinatorName" FROM coordinators ORDER BY created_at LIMIT 1`).Scan(&coordID, &coordName)
			if coordID != "" {
				m, err := insertMessage(c, a, body.SenderType, body.SenderID, body.SenderName, "coordinator", coordID, coordName, body.Subject, body.Body, body.RelatedAppointment)
				if err == nil {
					msgs = append(msgs, m)
				}
			}
		} else {
			m, err := insertMessage(c, a, body.SenderType, body.SenderID, body.SenderName, body.RecipientType, body.RecipientID, body.RecipientName, body.Subject, body.Body, body.RelatedAppointment)
			if err != nil {
				return err
			}
			msgs = append(msgs, m)
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"success":  true,
			"messages": msgs,
			"count":    len(msgs),
		})
	}
}

// PATCH /api/messages/:id/mark-read/
func markReadHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var id string
		var isRead bool
		var readAt *time.Time
		err := a.DB.QueryRow(c.Context(),
			`UPDATE messages SET "isRead"=TRUE,"readAt"=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,"isRead","readAt"`,
			idStr).Scan(&id, &isRead, &readAt)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Message not found."})
		}
		return c.JSON(fiber.Map{"id": id, "isRead": isRead, "readAt": readAt})
	}
}

// ─── helpers ────────────────────────────────────────────────────────────────

func insertMessage(c *fiber.Ctx, a *App, senderType, senderID, senderName, recipientType, recipientID, recipientName, subject, body string, relatedAppt *string) (fiber.Map, error) {
	var id string
	err := a.DB.QueryRow(c.Context(),
		`INSERT INTO messages ("senderType","senderId","senderName","recipientType","recipientId","recipientName",subject,body,"relatedAppointment")
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		senderType, senderID, senderName, recipientType, recipientID, recipientName, subject, body, relatedAppt,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return fiber.Map{
		"id": id, "senderType": senderType, "senderId": senderID, "senderName": senderName,
		"recipientType": recipientType, "recipientId": recipientID, "recipientName": recipientName,
		"subject": subject, "body": body, "isRead": false,
	}, nil
}

func queryMessages(c *fiber.Ctx, a *App, whereClause string, args ...interface{}) error {
	rows, err := a.DB.Query(c.Context(),
		`SELECT id,"senderType","senderId","senderName","recipientType","recipientId","recipientName",subject,body,"isRead","readAt",created_at,updated_at
		 FROM messages `+whereClause, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	var result []fiber.Map
	for rows.Next() {
		var id, senderType, senderID, senderName, recipientType, recipientID, recipientName, subject, body string
		var isRead bool
		var readAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &senderType, &senderID, &senderName, &recipientType, &recipientID, &recipientName, &subject, &body, &isRead, &readAt, &createdAt, &updatedAt); err != nil {
			return err
		}
		result = append(result, fiber.Map{
			"id": id, "senderType": senderType, "senderId": senderID, "senderName": senderName,
			"recipientType": recipientType, "recipientId": recipientID, "recipientName": recipientName,
			"subject": subject, "body": body, "isRead": isRead, "readAt": readAt,
			"created_at": createdAt, "updated_at": updatedAt,
		})
	}
	if result == nil {
		result = []fiber.Map{}
	}
	return c.JSON(result)
}
