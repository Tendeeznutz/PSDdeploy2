package handlers

// ACID notes:
//   forgotPasswordHandler  — invalidate-old-tokens + insert-new-token in one
//     READ COMMITTED TX so there is never a window where a user has two valid
//     tokens simultaneously.
//   resetPasswordHandler   — update-password + mark-token-used in one READ
//     COMMITTED TX so a used token can never be replayed if the password update
//     succeeds but the token mark fails.

import (
	dbtx "backend_v2/internal/db"
	"backend_v2/internal/middleware"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// POST /api/technicians/login/
func technicianLoginHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Email    string `json:"email"` // carries phone number
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		var id, name, hash string
		var isActive bool
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id,"technicianName","technicianPassword","isActive" FROM technicians WHERE "technicianPhone"=$1`,
			body.Email).Scan(&id, &name, &hash, &isActive); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "Invalid credentials."})
		}
		if !isActive {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"detail": "Account is deactivated."})
		}
		if !checkPwd(hash, body.Password) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "Invalid credentials."})
		}
		access, refresh, err := middleware.IssueTokenPair(a.Cfg.JWTSecret, id, "technician", name)
		if err != nil {
			return fiber.ErrInternalServerError
		}
		return c.JSON(fiber.Map{
			"technician_phone": body.Email, "technician_id": id,
			"technicianName": name, "role": "technician",
			"access": access, "refresh": refresh,
		})
	}
}

// POST /api/technicians/
func createTechnicianHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Name       string   `json:"technicianName"`
			Phone      string   `json:"technicianPhone"`
			Email      string   `json:"technicianEmail"`
			Password   string   `json:"technicianPassword"`
			PostalCode string   `json:"technicianPostalCode"`
			Address    string   `json:"technicianAddress"`
			Status     string   `json:"technicianStatus"`
			TravelType string   `json:"technicianTravelType"`
			Specs      []string `json:"specializations"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.Name == "" || body.Phone == "" || body.Password == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Missing required fields."})
		}
		if !sgPhoneRe.MatchString(body.Phone) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Phone must be exactly 8 digits."})
		}
		if !sgPostalRe.MatchString(body.PostalCode) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Postal code must be exactly 6 digits."})
		}
		hash, _ := hashPwd(body.Password)
		location := a.Geo.LookupPostal(body.PostalCode)
		status := "1"
		if body.Status != "" {
			status = body.Status
		}
		specsJSON, _ := json.Marshal(body.Specs)
		var id string
		err := a.DB.QueryRow(c.Context(),
			`INSERT INTO technicians
			 ("technicianName","technicianPostalCode","technicianAddress","technicianLocation",
			  "technicianPhone","technicianEmail","technicianPassword","technicianStatus",
			  "technicianTravelType",specializations)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
			body.Name, body.PostalCode, body.Address, location, body.Phone,
			nilIfEmpty(body.Email), hash, status, nilIfEmpty(body.TravelType), specsJSON,
		).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Phone or email already registered."})
			}
			return fmt.Errorf("create technician: %w", err)
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "technicianName": body.Name})
	}
}

// GET /api/technicians/
func listTechniciansHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var rows interface {
			Close()
			Next() bool
			Scan(...interface{}) error
			Err() error
		}
		var err error
		switch {
		case c.Query("technicianStatus") != "":
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"technicianName","technicianPhone","technicianEmail","technicianPostalCode",
				        "technicianAddress","technicianLocation","technicianStatus","technicianRating",
				        "technicianRatingCount","isActive",created_at
				   FROM technicians WHERE "technicianStatus"=$1 ORDER BY created_at DESC`,
				c.Query("technicianStatus"))
		case c.Query("technicianPhone") != "":
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"technicianName","technicianPhone","technicianEmail","technicianPostalCode",
				        "technicianAddress","technicianLocation","technicianStatus","technicianRating",
				        "technicianRatingCount","isActive",created_at
				   FROM technicians WHERE "technicianPhone"=$1 ORDER BY created_at DESC`,
				c.Query("technicianPhone"))
		default:
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"technicianName","technicianPhone","technicianEmail","technicianPostalCode",
				        "technicianAddress","technicianLocation","technicianStatus","technicianRating",
				        "technicianRatingCount","isActive",created_at
				   FROM technicians ORDER BY created_at DESC`)
		}
		if err != nil {
			return err
		}
		defer rows.Close()
		var result []fiber.Map
		for rows.Next() {
			var id, name, phone, postal, address, status string
			var email, location *string
			var rating float64
			var ratingCount int
			var isActive bool
			var createdAt time.Time
			if err := rows.Scan(&id, &name, &phone, &email, &postal, &address, &location, &status, &rating, &ratingCount, &isActive, &createdAt); err != nil {
				return err
			}
			result = append(result, fiber.Map{
				"id": id, "technicianName": name, "technicianPhone": phone,
				"technicianEmail": email, "technicianPostalCode": postal,
				"technicianAddress": address, "technicianLocation": location,
				"technicianStatus": status, "technicianRating": rating,
				"technicianRatingCount": ratingCount, "isActive": isActive,
				"created_at": createdAt,
			})
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// GET /api/technicians/:id/
func getTechnicianHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var id, name, phone, postal, address, status string
		var email, location *string
		var rating float64
		var ratingCount int
		var isActive bool
		var createdAt time.Time
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id,"technicianName","technicianPhone","technicianEmail","technicianPostalCode",
			        "technicianAddress","technicianLocation","technicianStatus","technicianRating",
			        "technicianRatingCount","isActive",created_at
			   FROM technicians WHERE id=$1`, idStr).
			Scan(&id, &name, &phone, &email, &postal, &address, &location, &status, &rating, &ratingCount, &isActive, &createdAt); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Technician not found."})
		}
		return c.JSON(fiber.Map{
			"id": id, "technicianName": name, "technicianPhone": phone,
			"technicianEmail": email, "technicianPostalCode": postal,
			"technicianAddress": address, "technicianLocation": location,
			"technicianStatus": status, "technicianRating": rating,
			"technicianRatingCount": ratingCount, "isActive": isActive, "created_at": createdAt,
		})
	}
}

// PATCH /api/technicians/:id/
func updateTechnicianHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		if _, err := uuid.Parse(idStr); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid id"})
		}
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		sets := []string{"updated_at=NOW()"}
		args := []interface{}{}
		argN := 1
		for _, k := range []string{
			"technicianName", "technicianPhone", "technicianEmail", "technicianAddress",
			"technicianPostalCode", "technicianStatus", "technicianTravelType",
		} {
			if v, ok := body[k]; ok {
				sets = append(sets, fmt.Sprintf(`"%s"=$%d`, k, argN))
				args = append(args, v)
				argN++
			}
		}
		if postal, ok := body["technicianPostalCode"].(string); ok {
			loc := a.Geo.LookupPostal(postal)
			sets = append(sets, fmt.Sprintf(`"technicianLocation"=$%d`, argN))
			args = append(args, loc)
			argN++
		}
		args = append(args, idStr)
		var retID string
		if err := a.DB.QueryRow(c.Context(),
			fmt.Sprintf(`UPDATE technicians SET %s WHERE id=$%d RETURNING id`, strings.Join(sets, ","), argN),
			args...).Scan(&retID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Technician not found."})
		}
		return getTechnicianHandler(a)(c)
	}
}

// POST /api/technicians/:id/toggle-active-status/
func toggleActiveStatusHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body struct {
			Reason string `json:"reason"`
		}
		_ = c.BodyParser(&body)
		var name string
		var isActive bool
		if err := a.DB.QueryRow(c.Context(),
			`SELECT "technicianName","isActive" FROM technicians WHERE id=$1`, idStr).
			Scan(&name, &isActive); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Technician not found."})
		}
		newActive := !isActive
		var deactivatedAt interface{}
		var reason interface{}
		if !newActive {
			deactivatedAt = time.Now()
			reason = body.Reason
		}
		_, _ = a.DB.Exec(c.Context(),
			`UPDATE technicians SET "isActive"=$1,"deactivatedAt"=$2,"deactivationReason"=$3,updated_at=NOW() WHERE id=$4`,
			newActive, deactivatedAt, reason, idStr)
		action := "activated"
		if !newActive {
			action = "deactivated"
		}
		return c.JSON(fiber.Map{
			"message":        fmt.Sprintf("%s has been %s", name, action),
			"technicianName": name, "isActive": newActive,
		})
	}
}

// POST /api/technicians/:id/toggle-status/
func toggleStatusHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var name, status string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT "technicianName","technicianStatus" FROM technicians WHERE id=$1`, idStr).
			Scan(&name, &status); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Technician not found."})
		}
		newStatus := "1"
		if status == "1" {
			newStatus = "2"
		}
		_, _ = a.DB.Exec(c.Context(),
			`UPDATE technicians SET "technicianStatus"=$1,updated_at=NOW() WHERE id=$2`, newStatus, idStr)
		return c.JSON(fiber.Map{
			"message":          fmt.Sprintf("%s is now %s", name, map[string]string{"1": "Available", "2": "Unavailable"}[newStatus]),
			"technicianName":   name,
			"technicianStatus": newStatus,
		})
	}
}

// POST /api/technicians/forgot-password/
// Invalidate old tokens + insert new in one READ COMMITTED TX.
func forgotPasswordHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Phone string `json:"phone"`
		}
		if err := c.BodyParser(&body); err != nil || body.Phone == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "phone required"})
		}
		var techID, name string
		var emailPtr *string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id,"technicianName","technicianEmail" FROM technicians WHERE "technicianPhone"=$1`, body.Phone).
			Scan(&techID, &name, &emailPtr); err != nil {
			// 200 to avoid phone enumeration
			return c.JSON(fiber.Map{"message": "Password reset email sent successfully"})
		}

		token := generateSecureToken(32)
		expires := time.Now().Add(24 * time.Hour)

		err := dbtx.WithTxReadCommitted(c.Context(), a.DB, func(tx pgx.Tx) error {
			// Atomically invalidate all existing tokens and create the new one.
			if _, err := tx.Exec(c.Context(),
				`UPDATE technician_password_reset_tokens SET "isUsed"=TRUE,updated_at=NOW()
				  WHERE technician_id=$1 AND "isUsed"=FALSE`, techID); err != nil {
				return err
			}
			_, err := tx.Exec(c.Context(),
				`INSERT INTO technician_password_reset_tokens (technician_id,token,"expiresAt")
				 VALUES ($1,$2,$3)`, techID, token, expires)
			return err
		})
		if err != nil {
			return err
		}

		if emailPtr != nil && *emailPtr != "" {
			msg := fmt.Sprintf(
				"Hi %s,\n\nReset your password:\n%s/reset-password?token=%s\n\nExpires in 24 hours.",
				name, a.Cfg.FrontendURL, token)
			_ = a.Notif.SendEmail(*emailPtr, "Password Reset Request", msg)
		}
		return c.JSON(fiber.Map{"message": "Password reset email sent successfully"})
	}
}

// GET /api/technicians/validate-reset-token/
func validateResetTokenHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Query("token")
		if token == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "token required"})
		}
		var name string
		var isUsed bool
		var expires time.Time
		err := a.DB.QueryRow(c.Context(),
			`SELECT t."technicianName",tr."isUsed",tr."expiresAt"
			   FROM technician_password_reset_tokens tr
			   JOIN technicians t ON t.id=tr.technician_id
			  WHERE tr.token=$1`, token).Scan(&name, &isUsed, &expires)
		if err != nil || isUsed || time.Now().After(expires) {
			return c.JSON(fiber.Map{"valid": false})
		}
		return c.JSON(fiber.Map{"valid": true, "technicianName": name})
	}
}

// POST /api/technicians/reset-password/
// Password UPDATE + token mark-used in one READ COMMITTED TX so a token
// cannot be replayed if the second statement fails.
func resetPasswordHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Token       string `json:"token"`
			NewPassword string `json:"newPassword"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if err := validatePassword(body.NewPassword); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": err.Error()})
		}

		var techID string
		var isUsed bool
		var expires time.Time
		if err := a.DB.QueryRow(c.Context(),
			`SELECT technician_id,"isUsed","expiresAt" FROM technician_password_reset_tokens WHERE token=$1`,
			body.Token).Scan(&techID, &isUsed, &expires); err != nil || isUsed || time.Now().After(expires) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Invalid or expired token."})
		}

		hash, _ := hashPwd(body.NewPassword)
		err := dbtx.WithTxReadCommitted(c.Context(), a.DB, func(tx pgx.Tx) error {
			if _, err := tx.Exec(c.Context(),
				`UPDATE technicians SET "technicianPassword"=$1,updated_at=NOW() WHERE id=$2`, hash, techID); err != nil {
				return err
			}
			_, err := tx.Exec(c.Context(),
				`UPDATE technician_password_reset_tokens SET "isUsed"=TRUE,updated_at=NOW() WHERE token=$1`, body.Token)
			return err
		})
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"message": "Password has been reset successfully"})
	}
}

// POST /api/technicians/:id/coordinator-reset-password/
func coordinatorResetTechnicianPasswordHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		tmpPwd := generateSecureToken(8)
		hash, _ := hashPwd(tmpPwd)
		var name string
		if err := a.DB.QueryRow(c.Context(),
			`UPDATE technicians SET "technicianPassword"=$1,updated_at=NOW() WHERE id=$2 RETURNING "technicianName"`,
			hash, idStr).Scan(&name); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Technician not found."})
		}
		return c.JSON(fiber.Map{
			"message":        fmt.Sprintf("Password for %s has been reset to default", name),
			"technicianName": name,
		})
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func generateSecureToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)[:n]
}

func jsonMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// suppress unused import warnings pre-tidy
var (
	_ = uuid.Nil
	_ = jsonMarshal
)
