package handlers

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// GET /api/customeraircondevices/
func listDevicesHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		customerID := c.Query("customerId")
		var rows interface {
			Close()
			Next() bool
			Scan(...interface{}) error
			Err() error
		}
		var err error
		if customerID != "" {
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"customerId","airconName","numberOfUnits","airconType","lastServiceMonth",remarks,created_at,updated_at
				 FROM customer_aircon_devices WHERE "customerId"=$1 ORDER BY created_at DESC`, customerID)
		} else {
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"customerId","airconName","numberOfUnits","airconType","lastServiceMonth",remarks,created_at,updated_at
				 FROM customer_aircon_devices ORDER BY created_at DESC`)
		}
		if err != nil {
			return err
		}
		defer rows.Close()
		var result []fiber.Map
		for rows.Next() {
			m, err := scanDevice(rows)
			if err != nil {
				return err
			}
			result = append(result, m)
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// POST /api/customeraircondevices/
func createDeviceHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			CustomerID       string `json:"customerId"`
			AirconName       string `json:"airconName"`
			NumberOfUnits    int    `json:"numberOfUnits"`
			AirconType       string `json:"airconType"`
			LastServiceMonth string `json:"lastServiceMonth"`
			Remarks          string `json:"remarks"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.CustomerID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "customerId required"})
		}
		if body.NumberOfUnits < 1 || body.NumberOfUnits > 100 {
			if body.NumberOfUnits == 0 {
				body.NumberOfUnits = 1
			} else {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "numberOfUnits must be between 1 and 100"})
			}
		}
		if body.AirconName == "" {
			body.AirconName = fmt.Sprintf("AC-%d", rand.Intn(99999))
		}
		if body.AirconType == "" {
			body.AirconType = "other"
		}
		// Validate lastServiceMonth not in future
		if body.LastServiceMonth != "" {
			if !isValidServiceMonth(body.LastServiceMonth) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "lastServiceMonth must be YYYY-MM format and not in the future"})
			}
		}

		var id string
		err := a.DB.QueryRow(c.Context(),
			`INSERT INTO customer_aircon_devices ("customerId","airconName","numberOfUnits","airconType","lastServiceMonth",remarks)
			 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
			body.CustomerID, body.AirconName, body.NumberOfUnits, body.AirconType,
			nilIfEmpty(body.LastServiceMonth), nilIfEmpty(body.Remarks),
		).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "An aircon device with that name already exists for this customer."})
			}
			return err
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
	}
}

// GET /api/customeraircondevices/:id/
func getDeviceHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rows, err := a.DB.Query(c.Context(),
			`SELECT id,"customerId","airconName","numberOfUnits","airconType","lastServiceMonth",remarks,created_at,updated_at
			 FROM customer_aircon_devices WHERE id=$1`, c.Params("id"))
		if err != nil {
			return err
		}
		defer rows.Close()
		if !rows.Next() {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Device not found."})
		}
		m, err := scanDevice(rows)
		if err != nil {
			return err
		}
		return c.JSON(m)
	}
}

// PATCH /api/customeraircondevices/:id/
func updateDeviceHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		sets := []string{"updated_at=NOW()"}
		args := []interface{}{}
		argN := 1
		for _, k := range []string{"airconName", "numberOfUnits", "airconType", "lastServiceMonth", "remarks"} {
			if v, ok := body[k]; ok {
				sets = append(sets, fmt.Sprintf(`"%s"=$%d`, k, argN))
				args = append(args, v)
				argN++
			}
		}
		args = append(args, idStr)
		query := fmt.Sprintf(`UPDATE customer_aircon_devices SET %s WHERE id=$%d RETURNING id`, strings.Join(sets, ","), argN)
		var retID string
		if err := a.DB.QueryRow(c.Context(), query, args...).Scan(&retID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Device not found."})
		}
		return getDeviceHandler(a)(c)
	}
}

// DELETE /api/customeraircondevices/:id/
func deleteDeviceHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		result, err := a.DB.Exec(c.Context(), `DELETE FROM customer_aircon_devices WHERE id=$1`, c.Params("id"))
		if err != nil {
			return err
		}
		if result.RowsAffected() == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Device not found."})
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

func scanDevice(rows interface{ Scan(...interface{}) error }) (fiber.Map, error) {
	var id, customerID, airconType string
	var airconName, lastServiceMonth, remarks *string
	var numberOfUnits int
	var createdAt, updatedAt time.Time
	err := rows.Scan(&id, &customerID, &airconName, &numberOfUnits, &airconType, &lastServiceMonth, &remarks, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	m := fiber.Map{
		"id": id, "customerId": customerID, "airconName": airconName,
		"numberOfUnits": numberOfUnits, "airconType": airconType,
		"lastServiceMonth": lastServiceMonth, "remarks": remarks,
		"created_at": createdAt, "updated_at": updatedAt,
	}
	if lastServiceMonth != nil {
		m["mood"] = moodScore(*lastServiceMonth)
	}
	return m, nil
}

func isValidServiceMonth(s string) bool {
	t, err := time.Parse("2006-01", s)
	if err != nil {
		return false
	}
	now := time.Now()
	return !t.After(time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC))
}
