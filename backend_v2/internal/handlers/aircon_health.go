package handlers

import (
	"backend_v2/internal/services"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

// GET /api/aircon-health-check/ — public endpoint, no auth
func airconHealthCheckHandler(c *fiber.Ctx) error {
	lastServiceDate := c.Query("lastServiceDate")
	if lastServiceDate == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "lastServiceDate is required (YYYY-MM format)"})
	}

	t, err := time.Parse("2006-01", lastServiceDate)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": fmt.Sprintf("invalid lastServiceDate format: %s (expected YYYY-MM)", lastServiceDate)})
	}
	if t.After(time.Now()) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "lastServiceDate cannot be in the future"})
	}

	units := c.QueryInt("units", 1)
	if units < 1 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "units must be at least 1"})
	}

	now := time.Now()
	monthsSince := (now.Year()-t.Year())*12 + int(now.Month()) - int(t.Month())

	result := services.ComputeAirconHealth(monthsSince, units)
	return c.JSON(result)
}
