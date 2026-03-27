package handlers

import (
	"backend_v2/internal/middleware"
	"backend_v2/internal/services"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	sgPhoneRe  = regexp.MustCompile(`^\d{8}$`)
	sgPostalRe = regexp.MustCompile(`^\d{6}$`)
	emailRe    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

func hashPwd(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(b), err
}

func checkPwd(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// POST /api/customers/login/
func customerLoginHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.Email == "" || body.Password == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "email and password required"})
		}

		row := a.DB.QueryRow(c.Context(),
			`SELECT id,"customerName","customerPassword" FROM customers WHERE "customerEmail"=$1`, body.Email)
		var id, name, hash string
		if err := row.Scan(&id, &name, &hash); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "Invalid credentials."})
		}

		if !checkPwd(hash, body.Password) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "Invalid credentials."})
		}

		access, refresh, err := middleware.IssueTokenPair(a.Cfg.JWTSecret, id, "customer", name)
		if err != nil {
			return fiber.ErrInternalServerError
		}
		return c.JSON(fiber.Map{
			"customer_id":  id,
			"customerName": name,
			"role":         "customer",
			"access":       access,
			"refresh":      refresh,
		})
	}
}

// POST /api/customers/
func createCustomerHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Name       string `json:"customerName"`
			Email      string `json:"customerEmail"`
			Phone      string `json:"customerPhone"`
			Password   string `json:"customerPassword"`
			Address    string `json:"customerAddress"`
			PostalCode string `json:"customerPostalCode"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}

		// Validation
		body.Email = strings.TrimSpace(strings.ToLower(body.Email))
		if !emailRe.MatchString(body.Email) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Invalid email format."})
		}
		if !sgPhoneRe.MatchString(body.Phone) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Phone must be exactly 8 digits."})
		}
		if !sgPostalRe.MatchString(body.PostalCode) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Postal code must be exactly 6 digits."})
		}
		if body.Name == "" || body.Password == "" || body.Address == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Missing required fields."})
		}

		hash, err := hashPwd(body.Password)
		if err != nil {
			return fiber.ErrInternalServerError
		}

		location := a.Geo.LookupPostal(body.PostalCode)

		var id, name string
		err = a.DB.QueryRow(c.Context(),
			`INSERT INTO customers ("customerName","customerPostalCode","customerLocation","customerAddress","customerPhone","customerPassword","customerEmail")
			 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,"customerName"`,
			body.Name, body.PostalCode, location, body.Address, body.Phone, hash, body.Email,
		).Scan(&id, &name)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Email or phone already registered."})
			}
			return fmt.Errorf("create customer: %w", err)
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "customerName": name})
	}
}

// GET /api/customers/ — with optional filters
func listCustomersHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := c.Context()
		var rows interface {
			Close()
			Next() bool
			Scan(...interface{}) error
			Err() error
		}

		if q := c.Query("customerEmail"); q != "" {
			r, err := a.DB.Query(ctx,
				`SELECT id,"customerName","customerEmail","customerPhone","customerPostalCode","customerAddress","customerLocation","pendingPenaltyFee","customerRating","ratingCount","telegramChatId",created_at,updated_at
				 FROM customers WHERE "customerEmail" ILIKE $1 ORDER BY created_at DESC`, "%"+q+"%")
			if err != nil {
				return err
			}
			rows = r
		} else if q := c.Query("customerPhone"); q != "" {
			r, err := a.DB.Query(ctx,
				`SELECT id,"customerName","customerEmail","customerPhone","customerPostalCode","customerAddress","customerLocation","pendingPenaltyFee","customerRating","ratingCount","telegramChatId",created_at,updated_at
				 FROM customers WHERE "customerPhone" = $1 ORDER BY created_at DESC`, q)
			if err != nil {
				return err
			}
			rows = r
		} else {
			r, err := a.DB.Query(ctx,
				`SELECT id,"customerName","customerEmail","customerPhone","customerPostalCode","customerAddress","customerLocation","pendingPenaltyFee","customerRating","ratingCount","telegramChatId",created_at,updated_at
				 FROM customers ORDER BY created_at DESC`)
			if err != nil {
				return err
			}
			rows = r
		}

		return scanCustomerRows(c, rows)
	}
}

func scanCustomerRows(c *fiber.Ctx, rows interface {
	Close()
	Next() bool
	Scan(...interface{}) error
	Err() error
}) error {
	defer rows.Close()
	var result []fiber.Map
	for rows.Next() {
		var (
			id, name, email, phone, postal, address string
			location                                *string
			penalty, rating                         float64
			ratingCount                             int
			telegramChatID                          *int64
			createdAt, updatedAt                    time.Time
		)
		if err := rows.Scan(&id, &name, &email, &phone, &postal, &address, &location, &penalty, &rating, &ratingCount, &telegramChatID, &createdAt, &updatedAt); err != nil {
			return err
		}
		result = append(result, fiber.Map{
			"id":                 id,
			"customerName":       name,
			"customerEmail":      email,
			"customerPhone":      phone,
			"customerPostalCode": postal,
			"customerAddress":    address,
			"customerLocation":   location,
			"pendingPenaltyFee":  penalty,
			"customerRating":     rating,
			"ratingCount":        ratingCount,
			"created_at":         createdAt,
			"updated_at":         updatedAt,
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if result == nil {
		result = []fiber.Map{}
	}
	return c.JSON(result)
}

// GET /api/customers/:id/
func getCustomerHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		if _, err := uuid.Parse(idStr); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid id"})
		}
		var (
			id, name, email, phone, postal, address string
			location                                *string
			penalty, rating                         float64
			ratingCount                             int
			telegramChatID                          *int64
			createdAt, updatedAt                    time.Time
		)
		err := a.DB.QueryRow(c.Context(),
			`SELECT id,"customerName","customerEmail","customerPhone","customerPostalCode","customerAddress","customerLocation","pendingPenaltyFee","customerRating","ratingCount","telegramChatId",created_at,updated_at
			 FROM customers WHERE id=$1`, idStr).
			Scan(&id, &name, &email, &phone, &postal, &address, &location, &penalty, &rating, &ratingCount, &telegramChatID, &createdAt, &updatedAt)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Customer not found."})
		}
		return c.JSON(fiber.Map{
			"id": id, "customerName": name, "customerEmail": email, "customerPhone": phone,
			"customerPostalCode": postal, "customerAddress": address, "customerLocation": location,
			"pendingPenaltyFee": penalty, "customerRating": rating, "ratingCount": ratingCount,
			"created_at": createdAt, "updated_at": updatedAt,
		})
	}
}

// PATCH /api/customers/:id/
func updateCustomerHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		if _, err := uuid.Parse(idStr); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid id"})
		}
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}

		// Build dynamic SET clause
		sets := []string{"updated_at = NOW()"}
		args := []interface{}{}
		argN := 1

		allowed := map[string]string{
			"customerName": "customerName", "customerPhone": "customerPhone",
			"customerEmail": "customerEmail", "customerAddress": "customerAddress",
			"customerPostalCode": "customerPostalCode", "customerLocation": "customerLocation",
		}
		for jsonKey, colKey := range allowed {
			if v, ok := body[jsonKey]; ok {
				sets = append(sets, fmt.Sprintf(`"%s" = $%d`, colKey, argN))
				args = append(args, v)
				argN++
			}
		}
		if rawPwd, ok := body["customerPassword"].(string); ok && rawPwd != "" {
			hash, err := hashPwd(rawPwd)
			if err != nil {
				return fiber.ErrInternalServerError
			}
			sets = append(sets, fmt.Sprintf(`"customerPassword" = $%d`, argN))
			args = append(args, hash)
			argN++
		}
		// If postal code updated, refresh location
		if postal, ok := body["customerPostalCode"].(string); ok && postal != "" {
			loc := a.Geo.LookupPostal(postal)
			sets = append(sets, fmt.Sprintf(`"customerLocation" = $%d`, argN))
			args = append(args, loc)
			argN++
		}

		args = append(args, idStr)
		query := fmt.Sprintf(`UPDATE customers SET %s WHERE id = $%d RETURNING id`, strings.Join(sets, ", "), argN)
		var retID string
		if err := a.DB.QueryRow(c.Context(), query, args...).Scan(&retID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Customer not found."})
		}
		return getCustomerHandler(a)(c)
	}
}

// POST /api/customers/:id/coordinator-reset-password/
func coordinatorResetCustomerPasswordHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		hash, _ := hashPwd("password123")
		var name string
		err := a.DB.QueryRow(c.Context(),
			`UPDATE customers SET "customerPassword"=$1, updated_at=NOW() WHERE id=$2 RETURNING "customerName"`,
			hash, idStr).Scan(&name)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Customer not found."})
		}
		return c.JSON(fiber.Map{
			"message":      fmt.Sprintf("Password for %s has been reset to default (password123)", name),
			"customerName": name,
		})
	}
}

// ─── helpers shared with other handlers ────────────────────────────────────

// moodScore returns the AC mood annotation for a device.
func moodScore(lastServiceMonth string) fiber.Map {
	if lastServiceMonth == "" {
		return fiber.Map{
			"mood_score":   0,
			"mood_label":   "Ghost of Aircons Past",
			"mood_message": "I have no memory of being serviced. I may already be dead.",
		}
	}
	var year, month int
	fmt.Sscanf(lastServiceMonth, "%d-%d", &year, &month)
	now := time.Now()
	months := (now.Year()-year)*12 + int(now.Month()) - month
	score := max(0, 100-months*10)
	switch {
	case score >= 80:
		return fiber.Map{"mood_score": score, "mood_label": "Well", "mood_message": "I feel great! Thanks for the recent service."}
	case score >= 60:
		return fiber.Map{"mood_score": score, "mood_label": "Aging", "mood_message": "I'm doing okay, but I wouldn't mind a check-up soon."}
	case score >= 40:
		return fiber.Map{"mood_score": score, "mood_label": "Concerned", "mood_message": "My filters are getting clogged. I'm not saying anything, but... I'm saying something."}
	case score >= 20:
		return fiber.Map{"mood_score": score, "mood_label": "Critically Unwell", "mood_message": "I haven't been serviced in ages. I am SUFFERING. Also I smell like mold."}
	default:
		return fiber.Map{"mood_score": score, "mood_label": "Ghost of Aircons Past", "mood_message": "I am a relic. A fossil. Book a service or buy a new one, I beg of you."}
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// displayAppointmentStatus maps status codes to labels.
func displayAppointmentStatus(s string) string {
	m := map[string]string{"1": "Pending", "2": "Confirmed", "3": "Completed", "4": "Cancelled"}
	if v, ok := m[s]; ok {
		return v
	}
	return s
}

// displayPaymentMethod maps payment method codes to labels.
func displayPaymentMethod(s string) string {
	m := map[string]string{
		"cash": "Cash", "cheque": "Cheque", "card": "Card",
		"bank_transfer": "Bank Transfer", "paynow": "PayNow",
	}
	if v, ok := m[s]; ok {
		return v
	}
	return s
}

// validatePassword enforces: min 8 chars, alphanumeric, at least 3 digits.
func validatePassword(p string) error {
	if len(p) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	for _, ch := range p {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) {
			return fmt.Errorf("password must be alphanumeric only")
		}
	}
	digits := 0
	for _, ch := range p {
		if ch >= '0' && ch <= '9' {
			digits++
		}
	}
	if digits < 3 {
		return fmt.Errorf("password must contain at least 3 digits")
	}
	return nil
}

// unused import suppressor
var _ = services.NewGeoService
