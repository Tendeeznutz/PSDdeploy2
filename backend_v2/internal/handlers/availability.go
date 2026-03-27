package handlers

import (
	"backend_v2/internal/services"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/technician-availability/available-slots/
func availableSlotsHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		techID := c.Query("technicianId")
		date := c.Query("date")
		if techID == "" || date == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "technicianId and date required"})
		}
		tID, err := uuid.Parse(techID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid technicianId"})
		}
		durationHours := 1.0
		if d := c.QueryFloat("durationHours", 1.0); d > 0 {
			durationHours = d
		}
		slots, err := services.GetAvailableTimeSlots(c.Context(), a.DB, tID, date, durationHours)
		if err != nil {
			return err
		}
		type slot struct {
			StartTime          int64  `json:"startTime"`
			EndTime            int64  `json:"endTime"`
			StartTimeFormatted string `json:"startTimeFormatted"`
			EndTimeFormatted   string `json:"endTimeFormatted"`
		}
		var formatted []slot
		loc := singaporeLocation()
		for _, s := range slots {
			formatted = append(formatted, slot{
				StartTime:          s[0],
				EndTime:            s[1],
				StartTimeFormatted: time.Unix(s[0], 0).In(loc).Format("2006-01-02 15:04"),
				EndTimeFormatted:   time.Unix(s[1], 0).In(loc).Format("2006-01-02 15:04"),
			})
		}
		if formatted == nil {
			formatted = []slot{}
		}

		var techName string
		_ = a.DB.QueryRow(c.Context(), `SELECT "technicianName" FROM technicians WHERE id=$1`, techID).Scan(&techName)
		return c.JSON(fiber.Map{
			"technicianId":   techID,
			"technicianName": techName,
			"date":           date,
			"durationHours":  durationHours,
			"availableSlots": formatted,
			"totalSlots":     len(formatted),
		})
	}
}

// GET /api/technician-availability/working-days/
func workingDaysHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		techID := c.Query("technicianId")
		if techID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "technicianId required"})
		}
		rows, err := a.DB.Query(c.Context(),
			`SELECT "dayOfWeek","isAvailable","startTime","endTime","specificDate" FROM technician_availability
			 WHERE "technicianId"=$1 ORDER BY "dayOfWeek","specificDate"`, techID)
		if err != nil {
			return err
		}
		defer rows.Close()
		var weeklyDays []string
		overrides := fiber.Map{}
		for rows.Next() {
			var dow, startT, endT string
			var isAvail bool
			var specificDate *string
			if err := rows.Scan(&dow, &isAvail, &startT, &endT, &specificDate); err != nil {
				return err
			}
			if specificDate != nil {
				overrides[*specificDate] = fiber.Map{"isAvailable": isAvail, "startTime": startT, "endTime": endT}
			} else if isAvail {
				weeklyDays = append(weeklyDays, dow)
			}
		}
		if weeklyDays == nil {
			weeklyDays = []string{}
		}
		var techName string
		_ = a.DB.QueryRow(c.Context(), `SELECT "technicianName" FROM technicians WHERE id=$1`, techID).Scan(&techName)
		return c.JSON(fiber.Map{
			"technicianId":            techID,
			"technicianName":          techName,
			"weeklyWorkingDays":       weeklyDays,
			"totalWeeklyDays":         len(weeklyDays),
			"specificDateOverrides":   overrides,
			"meetsMinimumRequirement": len(weeklyDays) >= 5,
		})
	}
}

// POST /api/technician-availability/bulk-create/
func bulkCreateAvailabilityHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			TechnicianID string `json:"technicianId"`
			Schedules    []struct {
				DayOfWeek string `json:"dayOfWeek"`
				StartTime string `json:"startTime"`
				EndTime   string `json:"endTime"`
			} `json:"schedules"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if len(body.Schedules) < 5 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Minimum 5 working days required."})
		}
		for _, s := range body.Schedules {
			if !isValidTime(s.StartTime) || !isValidTime(s.EndTime) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "startTime and endTime must be HH:MM format"})
			}
			if s.EndTime <= s.StartTime {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "endTime must be after startTime"})
			}
		}
		var created []fiber.Map
		for _, s := range body.Schedules {
			var id string
			err := a.DB.QueryRow(c.Context(),
				`INSERT INTO technician_availability ("technicianId","dayOfWeek","startTime","endTime","isAvailable")
				 VALUES ($1,$2,$3,$4,TRUE)
				 ON CONFLICT DO NOTHING RETURNING id`,
				body.TechnicianID, s.DayOfWeek, s.StartTime, s.EndTime,
			).Scan(&id)
			if err == nil {
				created = append(created, fiber.Map{"id": id, "dayOfWeek": s.DayOfWeek})
			}
		}
		if created == nil {
			created = []fiber.Map{}
		}
		return c.Status(fiber.StatusCreated).JSON(created)
	}
}

// GET /api/technician-availability/
func listAvailabilityHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		techID := c.Query("technicianId")
		var rows interface {
			Close()
			Next() bool
			Scan(...interface{}) error
			Err() error
		}
		var err error
		if techID != "" {
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"technicianId","dayOfWeek","startTime","endTime","specificDate","isAvailable",created_at
				 FROM technician_availability WHERE "technicianId"=$1 ORDER BY "dayOfWeek","specificDate"`, techID)
		} else {
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"technicianId","dayOfWeek","startTime","endTime","specificDate","isAvailable",created_at
				 FROM technician_availability ORDER BY "technicianId","dayOfWeek"`)
		}
		if err != nil {
			return err
		}
		defer rows.Close()
		var result []fiber.Map
		for rows.Next() {
			var id, tID, dow, startT, endT string
			var isAvail bool
			var specificDate *string
			var createdAt time.Time
			if err := rows.Scan(&id, &tID, &dow, &startT, &endT, &specificDate, &isAvail, &createdAt); err != nil {
				return err
			}
			result = append(result, fiber.Map{
				"id": id, "technicianId": tID, "dayOfWeek": dow,
				"startTime": startT, "endTime": endT, "specificDate": specificDate,
				"isAvailable": isAvail, "created_at": createdAt,
			})
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// POST /api/technician-availability/
func createAvailabilityHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			TechnicianID string  `json:"technicianId"`
			DayOfWeek    string  `json:"dayOfWeek"`
			StartTime    string  `json:"startTime"`
			EndTime      string  `json:"endTime"`
			SpecificDate *string `json:"specificDate"`
			IsAvailable  *bool   `json:"isAvailable"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if !isValidTime(body.StartTime) || !isValidTime(body.EndTime) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "startTime and endTime must be HH:MM"})
		}
		if body.EndTime <= body.StartTime {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "endTime must be after startTime"})
		}
		isAvail := true
		if body.IsAvailable != nil {
			isAvail = *body.IsAvailable
		}
		var id string
		err := a.DB.QueryRow(c.Context(),
			`INSERT INTO technician_availability ("technicianId","dayOfWeek","startTime","endTime","specificDate","isAvailable")
			 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
			body.TechnicianID, body.DayOfWeek, body.StartTime, body.EndTime, body.SpecificDate, isAvail,
		).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Availability record already exists for this day."})
			}
			return err
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
	}
}

// GET /api/technician-availability/:id/
func getAvailabilityHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var id, tID, dow, startT, endT string
		var isAvail bool
		var specificDate *string
		err := a.DB.QueryRow(c.Context(),
			`SELECT id,"technicianId","dayOfWeek","startTime","endTime","specificDate","isAvailable" FROM technician_availability WHERE id=$1`, idStr).
			Scan(&id, &tID, &dow, &startT, &endT, &specificDate, &isAvail)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Record not found."})
		}
		return c.JSON(fiber.Map{"id": id, "technicianId": tID, "dayOfWeek": dow, "startTime": startT, "endTime": endT, "specificDate": specificDate, "isAvailable": isAvail})
	}
}

// PATCH /api/technician-availability/:id/
func updateAvailabilityHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		sets := []string{"updated_at=NOW()"}
		args := []interface{}{}
		argN := 1
		for _, k := range []string{"startTime", "endTime", "isAvailable"} {
			if v, ok := body[k]; ok {
				sets = append(sets, fmt.Sprintf(`"%s"=$%d`, k, argN))
				args = append(args, v)
				argN++
			}
		}
		args = append(args, idStr)
		query := fmt.Sprintf(`UPDATE technician_availability SET %s WHERE id=$%d RETURNING id`, strings.Join(sets, ","), argN)
		var retID string
		if err := a.DB.QueryRow(c.Context(), query, args...).Scan(&retID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Record not found."})
		}
		return getAvailabilityHandler(a)(c)
	}
}

// DELETE /api/technician-availability/:id/
func deleteAvailabilityHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		// Fetch technician to check min-days constraint
		var techID string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT "technicianId" FROM technician_availability WHERE id=$1`, idStr).Scan(&techID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Record not found."})
		}
		var workingDays int
		_ = a.DB.QueryRow(c.Context(),
			`SELECT COUNT(*) FROM technician_availability WHERE "technicianId"=$1 AND "specificDate" IS NULL AND "isAvailable"=TRUE`, techID).
			Scan(&workingDays)
		if workingDays <= 5 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Cannot delete: technician must have at least 5 working days."})
		}
		_, _ = a.DB.Exec(c.Context(), `DELETE FROM technician_availability WHERE id=$1`, idStr)
		return c.SendStatus(fiber.StatusNoContent)
	}
}

func isValidTime(s string) bool {
	var h, m int
	n, _ := fmt.Sscanf(s, "%d:%d", &h, &m)
	return n == 2 && h >= 0 && h <= 23 && m >= 0 && m <= 59
}

func singaporeLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Singapore")
	if err != nil {
		return time.UTC
	}
	return loc
}

var _ = uuid.Nil // prevent unused import
