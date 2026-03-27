package handlers

import (
	"backend_v2/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

// POST /api/token/refresh/
func refreshTokenHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Refresh string `json:"refresh"`
		}
		if err := c.BodyParser(&body); err != nil || body.Refresh == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"detail": "refresh token is required",
			})
		}
		claims, err := middleware.ParseClaims(body.Refresh, a.Cfg.JWTSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"detail": "Invalid or expired refresh token.",
			})
		}
		access, _, err := middleware.IssueTokenPair(a.Cfg.JWTSecret, claims.UserID, claims.Role, claims.UserName)
		if err != nil {
			return fiber.ErrInternalServerError
		}
		return c.JSON(fiber.Map{"access": access})
	}
}
