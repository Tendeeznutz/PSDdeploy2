package handlers

import (
	"backend_v2/internal/middleware"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// POST /api/coordinators/login/
func coordinatorLoginHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		var id, name, hash string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id,"coordinatorName","coordinatorPassword" FROM coordinators WHERE "coordinatorEmail"=$1`, body.Email).
			Scan(&id, &name, &hash); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "Invalid credentials."})
		}
		if !checkPwd(hash, body.Password) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"detail": "Invalid credentials."})
		}
		access, refresh, err := middleware.IssueTokenPair(a.Cfg.JWTSecret, id, "coordinator", name)
		if err != nil {
			return fiber.ErrInternalServerError
		}
		return c.JSON(fiber.Map{
			"coordinator_id":   id,
			"coordinatorEmail": body.Email,
			"coordinatorName":  name,
			"role":             "coordinator",
			"access":           access,
			"refresh":          refresh,
		})
	}
}

// POST /api/coordinators/
func createCoordinatorHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Name     string `json:"coordinatorName"`
			Email    string `json:"coordinatorEmail"`
			Phone    string `json:"coordinatorPhone"`
			Password string `json:"coordinatorPassword"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.Name == "" || body.Email == "" || body.Phone == "" || body.Password == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "All fields required."})
		}
		hash, _ := hashPwd(body.Password)
		var id string
		err := a.DB.QueryRow(c.Context(),
			`INSERT INTO coordinators ("coordinatorName","coordinatorEmail","coordinatorPhone","coordinatorPassword")
			 VALUES ($1,$2,$3,$4) RETURNING id`, body.Name, body.Email, body.Phone, hash).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Email or phone already exists."})
			}
			return err
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "coordinatorName": body.Name})
	}
}

// GET /api/coordinators/
func listCoordinatorsHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rows, err := a.DB.Query(c.Context(),
			`SELECT id,"coordinatorName","coordinatorEmail","coordinatorPhone",created_at FROM coordinators ORDER BY created_at DESC`)
		if err != nil {
			return err
		}
		defer rows.Close()
		var result []fiber.Map
		for rows.Next() {
			var id, name, email, phone string
			var createdAt interface{}
			if err := rows.Scan(&id, &name, &email, &phone, &createdAt); err != nil {
				return err
			}
			result = append(result, fiber.Map{"id": id, "coordinatorName": name, "coordinatorEmail": email, "coordinatorPhone": phone, "created_at": createdAt})
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// GET /api/coordinators/:id/
func getCoordinatorHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var id, name, email, phone string
		var createdAt interface{}
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id,"coordinatorName","coordinatorEmail","coordinatorPhone",created_at FROM coordinators WHERE id=$1`, idStr).
			Scan(&id, &name, &email, &phone, &createdAt); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Coordinator not found."})
		}
		return c.JSON(fiber.Map{"id": id, "coordinatorName": name, "coordinatorEmail": email, "coordinatorPhone": phone, "created_at": createdAt})
	}
}

// PATCH /api/coordinators/:id/
func updateCoordinatorHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		sets := []string{"updated_at=NOW()"}
		args := []interface{}{}
		argN := 1
		for _, k := range []string{"coordinatorName", "coordinatorEmail", "coordinatorPhone"} {
			if v, ok := body[k]; ok {
				sets = append(sets, fmt.Sprintf(`"%s"=$%d`, k, argN))
				args = append(args, v)
				argN++
			}
		}
		if p, ok := body["coordinatorPassword"].(string); ok && p != "" {
			h, _ := hashPwd(p)
			sets = append(sets, fmt.Sprintf(`"coordinatorPassword"=$%d`, argN))
			args = append(args, h)
			argN++
		}
		args = append(args, idStr)
		query := fmt.Sprintf(`UPDATE coordinators SET %s WHERE id=$%d RETURNING id`, strings.Join(sets, ","), argN)
		var retID string
		if err := a.DB.QueryRow(c.Context(), query, args...).Scan(&retID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Coordinator not found."})
		}
		return getCoordinatorHandler(a)(c)
	}
}

// DELETE /api/coordinators/:id/
func deleteCoordinatorHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		result, err := a.DB.Exec(c.Context(), `DELETE FROM coordinators WHERE id=$1`, idStr)
		if err != nil {
			return err
		}
		if result.RowsAffected() == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Coordinator not found."})
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}
