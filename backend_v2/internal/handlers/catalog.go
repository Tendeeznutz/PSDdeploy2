package handlers

import (
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// GET /api/aircon-catalogs/
func listCatalogHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		brand := c.Query("airconBrand")
		model := c.Query("airconModel")
		var rows interface {
			Close()
			Next() bool
			Scan(...interface{}) error
			Err() error
		}
		var err error
		switch {
		case brand != "":
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"airconBrand","airconModel" FROM aircon_catalogs WHERE "airconBrand" ILIKE $1 ORDER BY "airconModel"`, "%"+brand+"%")
		case model != "":
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"airconBrand","airconModel" FROM aircon_catalogs WHERE "airconModel" ILIKE $1 ORDER BY "airconBrand"`, "%"+model+"%")
		default:
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"airconBrand","airconModel" FROM aircon_catalogs ORDER BY "airconBrand","airconModel"`)
		}
		if err != nil {
			return err
		}
		defer rows.Close()
		var result []fiber.Map
		for rows.Next() {
			var id, b, m string
			if err := rows.Scan(&id, &b, &m); err != nil {
				return err
			}
			result = append(result, fiber.Map{"id": id, "airconBrand": b, "airconModel": m})
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// POST /api/aircon-catalogs/
func createCatalogHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Brand string `json:"airconBrand"`
			Model string `json:"airconModel"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.Brand == "" || body.Model == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "airconBrand and airconModel required"})
		}
		var id string
		err := a.DB.QueryRow(c.Context(),
			`INSERT INTO aircon_catalogs ("airconBrand","airconModel") VALUES ($1,$2) RETURNING id`,
			body.Brand, body.Model).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Brand+model combination already exists."})
			}
			return err
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "airconBrand": body.Brand, "airconModel": body.Model})
	}
}

// POST /api/aircon-catalogs/bulkCreate/
func bulkCreateCatalogHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		file, err := c.FormFile("csvFile")
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "csvFile required"})
		}
		f, err := file.Open()
		if err != nil {
			return err
		}
		defer f.Close()

		reader := csv.NewReader(f)
		records, err := reader.ReadAll()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "malformed CSV"})
		}
		if len(records) < 2 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "CSV must have header row and at least one data row"})
		}

		var created []fiber.Map
		var errs []string
		for i, row := range records[1:] {
			if len(row) < 2 {
				errs = append(errs, fmt.Sprintf("row %d: insufficient columns", i+2))
				continue
			}
			brand, model := strings.TrimSpace(row[0]), strings.TrimSpace(row[1])
			if brand == "" || model == "" {
				errs = append(errs, fmt.Sprintf("row %d: empty brand or model", i+2))
				continue
			}
			var id string
			err := a.DB.QueryRow(c.Context(),
				`INSERT INTO aircon_catalogs ("airconBrand","airconModel") VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id`,
				brand, model).Scan(&id)
			if err == nil && id != "" {
				created = append(created, fiber.Map{"id": id, "airconBrand": brand, "airconModel": model})
			}
		}
		if created == nil {
			created = []fiber.Map{}
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"created": created, "count": len(created), "errors": errs})
	}
}
