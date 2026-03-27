package handlers

// ACID note:
//   coordinatorApproveHandler wraps the technician INSERT and the hiring
//   application UPDATE in one READ COMMITTED transaction so no orphaned
//   technician row is left behind if the second statement fails.

import (
	dbtx "backend_v2/internal/db"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

const maxFileSize = 5 * 1024 * 1024 // 5 MB

// POST /api/hiring-applications/
func createHiringApplicationHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		form, err := c.MultipartForm()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "multipart form required"})
		}
		field := func(k string) string {
			if v, ok := form.Value[k]; ok && len(v) > 0 {
				return v[0]
			}
			return ""
		}

		nric := field("nric")
		if nric == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "nric required"})
		}
		if !isValidNRIC(nric) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Invalid NRIC format (e.g. S1234567A)"})
		}

		// Duplicate NRIC — DB UNIQUE constraint is the real guard; this is a
		// friendly early-exit before file processing.
		var existingID string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id FROM technician_hiring_applications WHERE nric=$1`, nric).Scan(&existingID); err == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "NRIC already submitted."})
		}

		required := []string{"nricPhotoFront", "nricPhotoBack", "drivingLicense"}
		for _, fileKey := range required {
			files := form.File[fileKey]
			if len(files) == 0 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": fmt.Sprintf("%s is required", fileKey)})
			}
			if files[0].Size > maxFileSize {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": fmt.Sprintf("%s exceeds 5MB limit", fileKey)})
			}
		}

		saveFile := func(key string) string {
			files := form.File[key]
			if len(files) == 0 {
				return ""
			}
			fh := files[0]
			f, err := fh.Open()
			if err != nil {
				return ""
			}
			defer f.Close()
			b, _ := io.ReadAll(f)
			_ = b
			return fmt.Sprintf("uploads/%s/%s", key, fh.Filename)
		}

		nricFront := saveFile("nricPhotoFront")
		nricBack := saveFile("nricPhotoBack")
		drivingLic := saveFile("drivingLicense")
		profilePhoto := saveFile("profilePhoto")
		resumeFile := saveFile("resumeFile")

		specsRaw := field("specializations")
		specsJSON := json.RawMessage("[]")
		if specsRaw != "" {
			if strings.HasPrefix(specsRaw, "[") {
				specsJSON = json.RawMessage(specsRaw)
			} else {
				parts := strings.Split(specsRaw, ",")
				b, _ := json.Marshal(parts)
				specsJSON = b
			}
		}

		var id string
		err = a.DB.QueryRow(c.Context(),
			`INSERT INTO technician_hiring_applications (
				"applicationSource","applicantName",nric,citizenship,
				"applicantAddress","applicantPostalCode","applicantPhone","applicantEmail",
				"workExperience","resumeFile","hasCriminalRecord",race,"languagesSpoken",
				"nextOfKinName","nextOfKinContact","nextOfKinRelationship",
				"profilePhoto","nricPhotoFront","nricPhotoBack","drivingLicense",
				specializations,"applicationStatus"
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
			 RETURNING id`,
			field("applicationSource"), field("applicantName"), nric, field("citizenship"),
			field("applicantAddress"), field("applicantPostalCode"), field("applicantPhone"), field("applicantEmail"),
			field("workExperience"), nilIfEmpty(resumeFile), field("hasCriminalRecord") == "true",
			field("race"), field("languagesSpoken"),
			field("nextOfKinName"), field("nextOfKinContact"), field("nextOfKinRelationship"),
			nilIfEmpty(profilePhoto), nilIfEmpty(nricFront), nilIfEmpty(nricBack), nilIfEmpty(drivingLic),
			specsJSON, "personal_details",
		).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "NRIC already submitted."})
			}
			return fmt.Errorf("create hiring application: %w", err)
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "applicationStatus": "personal_details"})
	}
}

// POST /api/hiring-applications/:id/confirm-personal-details/
func confirmPersonalDetailsHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var id, status string
		if err := a.DB.QueryRow(c.Context(),
			`UPDATE technician_hiring_applications
			    SET "personalDetailsConfirmed"=TRUE,"personalDetailsConfirmedAt"=NOW(),
			        "applicationStatus"='bank_info',updated_at=NOW()
			  WHERE id=$1 RETURNING id,"applicationStatus"`, idStr).Scan(&id, &status); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Application not found."})
		}
		return c.JSON(fiber.Map{"id": id, "applicationStatus": status, "personalDetailsConfirmed": true})
	}
}

// POST /api/hiring-applications/:id/submit-bank-info/
func submitBankInfoHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body struct {
			BankName              string `json:"bankName"`
			BankAccountNumber     string `json:"bankAccountNumber"`
			BankAccountHolderName string `json:"bankAccountHolderName"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		var id, status string
		if err := a.DB.QueryRow(c.Context(),
			`UPDATE technician_hiring_applications
			    SET "bankName"=$2,"bankAccountNumber"=$3,"bankAccountHolderName"=$4,
			        "bankInfoConfirmed"=TRUE,"bankInfoConfirmedAt"=NOW(),
			        "applicationStatus"='coordinator_review',updated_at=NOW()
			  WHERE id=$1 RETURNING id,"applicationStatus"`,
			idStr, body.BankName, body.BankAccountNumber, body.BankAccountHolderName,
		).Scan(&id, &status); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Application not found."})
		}
		return c.JSON(fiber.Map{"id": id, "applicationStatus": status, "bankInfoConfirmed": true})
	}
}

// POST /api/hiring-applications/:id/coordinator-approve/
// Technician INSERT + hiring application UPDATE in one READ COMMITTED TX so
// there is never a technician row without a linked hiring application update.
func coordinatorApproveHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body struct {
			CoordinatorID    string  `json:"coordinatorId"`
			PayRate          float64 `json:"payRate"`
			CoordinatorNotes string  `json:"coordinatorNotes"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}

		// Fetch applicant data outside the TX (read-only, no contention).
		var name, phone, email, postal, address string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT "applicantName","applicantPhone","applicantEmail","applicantPostalCode","applicantAddress"
			   FROM technician_hiring_applications WHERE id=$1`, idStr).
			Scan(&name, &phone, &email, &postal, &address); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Application not found."})
		}

		tmpPwd := generateSecureToken(12)
		hash, _ := hashPwd(tmpPwd)
		location := a.Geo.LookupPostal(postal)

		var techID, appID, appStatus string

		err := dbtx.WithTxReadCommitted(c.Context(), a.DB, func(tx pgx.Tx) error {
			// 1. Create technician account.
			if err := tx.QueryRow(c.Context(),
				`INSERT INTO technicians
				 ("technicianName","technicianPhone","technicianEmail","technicianPassword",
				  "technicianPostalCode","technicianAddress","technicianLocation","technicianStatus","isActive")
				 VALUES ($1,$2,$3,$4,$5,$6,$7,'1',TRUE) RETURNING id`,
				name, phone, nilIfEmpty(email), hash, postal, address, location,
			).Scan(&techID); err != nil {
				if strings.Contains(err.Error(), "unique") {
					return &fiber.Error{Code: fiber.StatusBadRequest, Message: "A technician with this phone or email already exists."}
				}
				return fmt.Errorf("create technician: %w", err)
			}

			// 2. Update hiring application — links to the new technician ID.
			return tx.QueryRow(c.Context(),
				`UPDATE technician_hiring_applications
				    SET "coordinatorId"=$2,"payRate"=$3,"coordinatorNotes"=$4,
				        "coordinatorApproved"=TRUE,"coordinatorApprovedAt"=NOW(),
				        "applicationStatus"='approved',"createdTechnician"=$5,updated_at=NOW()
				  WHERE id=$1
				  RETURNING id,"applicationStatus"`,
				idStr, nilIfEmpty(body.CoordinatorID), body.PayRate, body.CoordinatorNotes, techID,
			).Scan(&appID, &appStatus)
		})
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				return c.Status(fe.Code).JSON(fiber.Map{"detail": fe.Message})
			}
			return err
		}
		return c.JSON(fiber.Map{
			"id": appID, "applicationStatus": appStatus,
			"coordinatorApproved": true, "technicianId": techID,
			"temporaryPassword": tmpPwd,
		})
	}
}

// POST /api/hiring-applications/:id/coordinator-reject/
func coordinatorRejectHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body struct {
			CoordinatorID    string `json:"coordinatorId"`
			CoordinatorNotes string `json:"coordinatorNotes"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		var id, status string
		if err := a.DB.QueryRow(c.Context(),
			`UPDATE technician_hiring_applications
			    SET "coordinatorId"=$2,"coordinatorNotes"=$3,"coordinatorApproved"=FALSE,
			        "coordinatorApprovedAt"=NOW(),"applicationStatus"='rejected',updated_at=NOW()
			  WHERE id=$1 RETURNING id,"applicationStatus"`,
			idStr, nilIfEmpty(body.CoordinatorID), body.CoordinatorNotes,
		).Scan(&id, &status); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Application not found."})
		}
		return c.JSON(fiber.Map{"id": id, "applicationStatus": status, "coordinatorApproved": false})
	}
}

// GET /api/hiring-applications/
func listHiringApplicationsHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		status := c.Query("applicationStatus")
		var rows interface {
			Close()
			Next() bool
			Scan(...interface{}) error
			Err() error
		}
		var err error
		if status != "" {
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"applicantName","applicationStatus","applicationSource",created_at
				   FROM technician_hiring_applications
				  WHERE "applicationStatus"=$1 ORDER BY created_at DESC`, status)
		} else {
			rows, err = a.DB.Query(c.Context(),
				`SELECT id,"applicantName","applicationStatus","applicationSource",created_at
				   FROM technician_hiring_applications ORDER BY created_at DESC`)
		}
		if err != nil {
			return err
		}
		defer rows.Close()
		var result []fiber.Map
		for rows.Next() {
			var id, name, appStatus, source string
			var createdAt time.Time
			if err := rows.Scan(&id, &name, &appStatus, &source, &createdAt); err != nil {
				return err
			}
			result = append(result, fiber.Map{
				"id": id, "applicantName": name,
				"applicationStatus": appStatus, "applicationSource": source,
				"created_at": createdAt,
			})
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// GET /api/hiring-applications/:id/
func getHiringApplicationHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var id, name, appStatus string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id,"applicantName","applicationStatus"
			   FROM technician_hiring_applications WHERE id=$1`, idStr).
			Scan(&id, &name, &appStatus); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Application not found."})
		}
		return c.JSON(fiber.Map{"id": id, "applicantName": name, "applicationStatus": appStatus})
	}
}

func isValidNRIC(s string) bool {
	if len(s) != 9 {
		return false
	}
	first := s[0]
	if first != 'S' && first != 'T' && first != 'F' && first != 'G' {
		return false
	}
	for i := 1; i <= 7; i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return s[8] >= 'A' && s[8] <= 'Z'
}
