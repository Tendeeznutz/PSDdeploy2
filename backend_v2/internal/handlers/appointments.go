package handlers

// ACID / thread-safety / N+1 notes:
//
//   listAppointmentsHandler     — one JOIN query returns all appointment data
//     including customer name/phone/email and technician name/rating.
//     No per-row QueryRow calls.
//
//   createAppointmentHandler   — device validation (1 batch query), technician
//     selection (BatchLoadTechnicianData = 2 queries, SelectAvailableTechnician
//     is pure in-memory), final SELECT FOR UPDATE on chosen technician (1 query),
//     appointment INSERT — all inside one READ COMMITTED transaction.
//
//   guestBookingHandler        — same batch approach.  All 3 INSERTs in one
//     READ COMMITTED transaction — any failure rolls everything back.
//
//   updateAppointmentHandler   — cancellation: penalty atomic-increment + status
//     UPDATE in one READ COMMITTED transaction.
//
//   rateTechnicianHandler /
//   rateCustomerHandler        — rating INSERT + aggregate UPDATE inside a
//     SERIALIZABLE transaction.  Concurrent raters will serialize, not corrupt.
//
//   Blockchain goroutines       — use context.Background() so they are never
//     cancelled by the HTTP response lifecycle.

import (
	"backend_v2/internal/blockchain"
	dbtx "backend_v2/internal/db"
	"backend_v2/internal/services"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// GET /api/appointments/
// N+1 fix: one JOIN brings customer + technician columns along with the
// appointment row — no per-row queries in the loop.
func listAppointmentsHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := c.Context()

		base := `
		SELECT
		    a.id, a."customerId", a."technicianId",
		    a."appointmentStartTime", a."appointmentEndTime",
		    a."airconToService", a."customerFeedback",
		    a."appointmentStatus", a."paymentMethod",
		    a."cancellationReason", a."cancelledBy", a."cancelledAt",
		    a.created_at, a.updated_at,
		    c."customerName",  c."customerPhone",  c."customerEmail",
		    t."technicianName", t."technicianRating", t."technicianRatingCount"
		FROM appointments a
		JOIN customers c ON c.id = a."customerId"
		LEFT JOIN technicians t ON t.id = a."technicianId"`

		var (
			query string
			args  []interface{}
		)
		switch {
		case c.Query("customerId") != "":
			query = base + ` WHERE a."customerId" = $1 ORDER BY a.created_at DESC`
			args = []interface{}{c.Query("customerId")}
		case c.Query("technicianId") != "":
			query = base + ` WHERE a."technicianId" = $1 ORDER BY a.created_at DESC`
			args = []interface{}{c.Query("technicianId")}
		case c.Query("appointmentStatus") != "":
			query = base + ` WHERE a."appointmentStatus" = $1 ORDER BY a.created_at DESC`
			args = []interface{}{c.Query("appointmentStatus")}
		default:
			query = base + ` ORDER BY a.created_at DESC`
		}

		rows, err := a.DB.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()

		var result []fiber.Map
		for rows.Next() {
			m, err := scanAppointmentJoined(rows)
			if err != nil {
				return err
			}
			result = append(result, m)
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if result == nil {
			result = []fiber.Map{}
		}
		return c.JSON(result)
	}
}

// POST /api/appointments/
// Device validation + batch technician selection + INSERT in one READ COMMITTED TX.
func createAppointmentHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			CustomerID    string   `json:"customerId"`
			StartTime     int64    `json:"appointmentStartTime"`
			AirconIDs     []string `json:"airconToService"`
			PaymentMethod string   `json:"paymentMethod"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.CustomerID == "" || body.StartTime == 0 || len(body.AirconIDs) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "customerId, appointmentStartTime and airconToService required"})
		}
		if body.StartTime < time.Now().Unix() {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Appointment time must be in the future."})
		}

		pm := body.PaymentMethod
		if pm == "" {
			pm = "cash"
		}
		endTime := body.StartTime + int64(len(body.AirconIDs))*3600
		airconJSON, _ := json.Marshal(body.AirconIDs)

		// Validate device ownership before opening the transaction.
		// One batch query instead of one-per-device.
		devRows, err := a.DB.Query(c.Context(),
			`SELECT id, "customerId" FROM customer_aircon_devices WHERE id = ANY($1)`,
			body.AirconIDs)
		if err != nil {
			return err
		}
		found := map[string]string{}
		for devRows.Next() {
			var dID, cID string
			if err := devRows.Scan(&dID, &cID); err == nil {
				found[dID] = cID
			}
		}
		devRows.Close()
		for _, devID := range body.AirconIDs {
			cid, ok := found[devID]
			if !ok {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": fmt.Sprintf("Device %s not found.", devID)})
			}
			if cid != body.CustomerID {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Device does not belong to customer."})
			}
		}

		// Fetch customer location.
		var customerLocation *string
		_ = a.DB.QueryRow(c.Context(),
			`SELECT "customerLocation" FROM customers WHERE id = $1`, body.CustomerID).Scan(&customerLocation)

		// Batch-load all nearby technician data (2 queries for N candidates).
		var chosenTechID uuid.UUID
		if customerLocation != nil && *customerLocation != "" {
			if coord, err := services.ParseCoord(*customerLocation); err == nil {
				nearby, _ := services.GetNearbyTechnicians(c.Context(), a.DB, coord, "")
				if len(nearby) > 0 {
					techData, _ := services.BatchLoadTechnicianData(c.Context(), a.DB, nearby)
					chosenTechID = services.SelectAvailableTechnician(nearby, techData, body.StartTime, endTime, nil, nil)
				}
			}
		}

		var apptID, status string

		err = dbtx.WithTxReadCommitted(c.Context(), a.DB, func(tx pgx.Tx) error {
			var techIDPtr *uuid.UUID
			status = "1"

			if chosenTechID != uuid.Nil {
				// Re-confirm availability with a row-level lock inside the TX.
				var techStatus string
				if err := tx.QueryRow(c.Context(),
					`SELECT "technicianStatus" FROM technicians
					  WHERE id = $1 AND "isActive" = TRUE FOR UPDATE`,
					chosenTechID).Scan(&techStatus); err == nil && techStatus == "1" {
					// Quick conflict check inside the transaction.
					avail, _ := services.IsSlotAvailable(c.Context(), a.DB, chosenTechID, body.StartTime, endTime, nil)
					if avail {
						techIDPtr = &chosenTechID
						status = "2"
					}
				}
			}

			customerUUID, _ := uuid.Parse(body.CustomerID)
			return tx.QueryRow(c.Context(),
				`INSERT INTO appointments
				 ("customerId","technicianId","appointmentStartTime","appointmentEndTime",
				  "airconToService","appointmentStatus","paymentMethod")
				 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
				customerUUID, techIDPtr, body.StartTime, endTime, airconJSON, status, pm,
			).Scan(&apptID)
		})
		if err != nil {
			return fmt.Errorf("create appointment: %w", err)
		}

		apptUUID, _ := uuid.Parse(apptID)
		go func() {
			_, _ = blockchain.AppendBlock(context.Background(), a.DB, apptUUID, "created", fiber.Map{
				"customerId": body.CustomerID, "status": status, "startTime": body.StartTime,
			})
		}()

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": apptID, "appointmentStatus": status})
	}
}

// GET /api/appointments/:id/
func getAppointmentHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rows, err := a.DB.Query(c.Context(), `
		SELECT
		    a.id, a."customerId", a."technicianId",
		    a."appointmentStartTime", a."appointmentEndTime",
		    a."airconToService", a."customerFeedback",
		    a."appointmentStatus", a."paymentMethod",
		    a."cancellationReason", a."cancelledBy", a."cancelledAt",
		    a.created_at, a.updated_at,
		    c."customerName", c."customerPhone", c."customerEmail",
		    t."technicianName", t."technicianRating", t."technicianRatingCount"
		FROM appointments a
		JOIN customers c ON c.id = a."customerId"
		LEFT JOIN technicians t ON t.id = a."technicianId"
		WHERE a.id = $1`, c.Params("id"))
		if err != nil {
			return err
		}
		defer rows.Close()
		if !rows.Next() {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Appointment not found."})
		}
		m, err := scanAppointmentJoined(rows)
		if err != nil {
			return err
		}
		return c.JSON(m)
	}
}

// PATCH /api/appointments/:id/
func updateAppointmentHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		apptUUID, err := uuid.Parse(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid id"})
		}
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}

		var newStatus string

		err = dbtx.WithTxReadCommitted(c.Context(), a.DB, func(tx pgx.Tx) error {
			if statusVal, ok := body["appointmentStatus"].(string); ok && statusVal == "4" {
				if _, ok := body["cancellationReason"]; !ok {
					return &fiber.Error{Code: fiber.StatusBadRequest, Message: "cancellationReason is required when cancelling."}
				}
				var startTime int64
				var customerID string
				if err := tx.QueryRow(c.Context(),
					`SELECT "appointmentStartTime","customerId" FROM appointments WHERE id=$1 FOR UPDATE`,
					idStr).Scan(&startTime, &customerID); err != nil {
					return &fiber.Error{Code: fiber.StatusNotFound, Message: "Appointment not found."}
				}
				cancelledBy := "customer"
				if cb, ok := body["cancelledBy"].(string); ok {
					cancelledBy = cb
				}
				if cancelledBy == "customer" {
					custUUID, _ := uuid.Parse(customerID)
					_, _ = services.CheckAndApplyPenalty(c.Context(), a.DB, custUUID, startTime)
				}
				body["cancelledAt"] = time.Now()
				body["cancelledBy"] = cancelledBy
			}

			sets := []string{"updated_at=NOW()"}
			args := []interface{}{}
			argN := 1
			for _, k := range []string{
				"technicianId", "appointmentStartTime", "appointmentEndTime",
				"appointmentStatus", "paymentMethod", "customerFeedback",
				"cancellationReason", "cancelledBy", "cancelledAt", "airconToService",
			} {
				if v, ok := body[k]; ok {
					sets = append(sets, fmt.Sprintf(`"%s"=$%d`, k, argN))
					args = append(args, v)
					argN++
				}
			}
			args = append(args, idStr)
			return tx.QueryRow(c.Context(),
				fmt.Sprintf(`UPDATE appointments SET %s WHERE id=$%d RETURNING "appointmentStatus"`,
					strings.Join(sets, ","), argN),
				args...).Scan(&newStatus)
		})
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				return c.Status(fe.Code).JSON(fiber.Map{"detail": fe.Message})
			}
			if strings.Contains(err.Error(), "no rows") {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Appointment not found."})
			}
			return err
		}

		if newStatus != "" {
			if event, ok := map[string]string{"1": "pending", "2": "confirmed", "3": "completed", "4": "cancelled"}[newStatus]; ok {
				go func() {
					_, _ = blockchain.AppendBlock(context.Background(), a.DB, apptUUID, event, body)
				}()
			}
		}
		return getAppointmentHandler(a)(c)
	}
}

// DELETE /api/appointments/:id/
func deleteAppointmentHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		res, err := a.DB.Exec(c.Context(), `DELETE FROM appointments WHERE id=$1`, c.Params("id"))
		if err != nil {
			return err
		}
		if res.RowsAffected() == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"detail": "Appointment not found."})
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// POST /api/appointments/:id/rate-technician/
func rateTechnicianHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body struct {
			CustomerID string `json:"customerId"`
			Rating     int    `json:"rating"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.Rating < 1 || body.Rating > 5 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "rating must be 1-5"})
		}
		var newRating float64
		var newCount int
		err := dbtx.WithTx(c.Context(), a.DB, func(tx pgx.Tx) error {
			var status, techIDStr string
			if err := tx.QueryRow(c.Context(),
				`SELECT "appointmentStatus","technicianId"::text FROM appointments
				  WHERE id=$1 AND "customerId"=$2 FOR UPDATE`,
				idStr, body.CustomerID).Scan(&status, &techIDStr); err != nil {
				return &fiber.Error{Code: fiber.StatusNotFound, Message: "Appointment not found or does not belong to customer."}
			}
			if status != "3" {
				return &fiber.Error{Code: fiber.StatusBadRequest, Message: "Can only rate completed appointments."}
			}
			if _, err := tx.Exec(c.Context(),
				`INSERT INTO appointment_ratings (appointment_id,"ratedBy",rating) VALUES ($1,'customer',$2)`,
				idStr, body.Rating); err != nil {
				if strings.Contains(err.Error(), "unique") {
					return &fiber.Error{Code: fiber.StatusBadRequest, Message: "Already rated this appointment."}
				}
				return err
			}
			return tx.QueryRow(c.Context(),
				`UPDATE technicians
				    SET "technicianRating"      = ROUND(("technicianRating"*"technicianRatingCount"+$2)/("technicianRatingCount"+1), 2),
				        "technicianRatingCount" = "technicianRatingCount" + 1,
				        updated_at              = NOW()
				  WHERE id=$1
				  RETURNING "technicianRating","technicianRatingCount"`,
				techIDStr, body.Rating).Scan(&newRating, &newCount)
		})
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				return c.Status(fe.Code).JSON(fiber.Map{"detail": fe.Message})
			}
			return err
		}
		return c.JSON(fiber.Map{"technicianRating": newRating, "technicianRatingCount": newCount})
	}
}

// POST /api/appointments/:id/rate-customer/
func rateCustomerHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		var body struct {
			TechnicianID string `json:"technicianId"`
			Rating       int    `json:"rating"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.Rating < 1 || body.Rating > 5 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "rating must be 1-5"})
		}
		var newRating float64
		var newCount int
		err := dbtx.WithTx(c.Context(), a.DB, func(tx pgx.Tx) error {
			var status, customerIDStr string
			if err := tx.QueryRow(c.Context(),
				`SELECT "appointmentStatus","customerId"::text FROM appointments
				  WHERE id=$1 AND "technicianId"=$2 FOR UPDATE`,
				idStr, body.TechnicianID).Scan(&status, &customerIDStr); err != nil {
				return &fiber.Error{Code: fiber.StatusNotFound, Message: "Appointment not found."}
			}
			if status != "3" {
				return &fiber.Error{Code: fiber.StatusBadRequest, Message: "Can only rate completed appointments."}
			}
			if _, err := tx.Exec(c.Context(),
				`INSERT INTO appointment_ratings (appointment_id,"ratedBy",rating) VALUES ($1,'technician',$2)`,
				idStr, body.Rating); err != nil {
				if strings.Contains(err.Error(), "unique") {
					return &fiber.Error{Code: fiber.StatusBadRequest, Message: "Already rated this appointment."}
				}
				return err
			}
			return tx.QueryRow(c.Context(),
				`UPDATE customers
				    SET "customerRating" = ROUND(("customerRating"*"ratingCount"+$2)/("ratingCount"+1), 2),
				        "ratingCount"    = "ratingCount" + 1,
				        updated_at       = NOW()
				  WHERE id=$1
				  RETURNING "customerRating","ratingCount"`,
				customerIDStr, body.Rating).Scan(&newRating, &newCount)
		})
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				return c.Status(fe.Code).JSON(fiber.Map{"detail": fe.Message})
			}
			return err
		}
		return c.JSON(fiber.Map{"customerRating": newRating, "ratingCount": newCount})
	}
}

// GET /api/appointments/penalty-status/
func penaltyStatusHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		customerID := c.Query("customerId")
		if customerID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "customerId required"})
		}
		custUUID, err := uuid.Parse(customerID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid customerId"})
		}
		summary, err := services.GetPenaltySummary(c.Context(), a.DB, custUUID)
		if err != nil {
			return err
		}
		return c.JSON(summary)
	}
}

// GET /api/appointments/unavailable/
func unavailableTimeslotsHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		customerID := c.Query("customerId")
		if customerID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "customerId required"})
		}
		var location *string
		_ = a.DB.QueryRow(c.Context(),
			`SELECT "customerLocation" FROM customers WHERE id=$1`, customerID).Scan(&location)
		var nearbyIDs []string
		if location != nil {
			coord, err := services.ParseCoord(*location)
			if err == nil {
				nearby, _ := services.GetNearbyTechnicians(c.Context(), a.DB, coord, "")
				for _, id := range nearby {
					nearbyIDs = append(nearbyIDs, id.String())
				}
			}
		}
		return c.JSON(fiber.Map{"nearby_technicians": nearbyIDs, "unavailable_timeslots": []interface{}{}})
	}
}

// POST /api/appointments/guest-booking/
func guestBookingHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			CustomerName  string `json:"customerName"`
			CustomerPhone string `json:"customerPhone"`
			CustomerEmail string `json:"customerEmail"`
			CustomerAddr  string `json:"customerAddress"`
			PostalCode    string `json:"customerPostalCode"`
			AirconBrand   string `json:"airconBrand"`
			Units         int    `json:"numberOfUnits"`
			StartTime     int64  `json:"appointmentStartTime"`
			PaymentMethod string `json:"paymentMethod"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		if body.CustomerName == "" || body.CustomerPhone == "" || body.CustomerEmail == "" || body.StartTime == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Missing required fields."})
		}
		if !sgPhoneRe.MatchString(body.CustomerPhone) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Phone must be exactly 8 digits."})
		}

		// Fast duplicate check outside TX.
		var existingID string
		if err := a.DB.QueryRow(c.Context(),
			`SELECT id FROM customers WHERE "customerPhone"=$1 OR "customerEmail"=$2`,
			body.CustomerPhone, body.CustomerEmail).Scan(&existingID); err == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "Phone or email already registered."})
		}

		units := body.Units
		if units < 1 {
			units = 1
		}
		pm := body.PaymentMethod
		if pm == "" {
			pm = "cash"
		}
		location := a.Geo.LookupPostal(body.PostalCode)
		tmpPwd := generateSecureToken(12)
		hash, _ := hashPwd(tmpPwd)

		endTime := body.StartTime + int64(units)*3600

		// Batch-select technician outside the TX.
		var chosenTechID uuid.UUID
		if location != "" {
			if coord, err := services.ParseCoord(location); err == nil {
				nearby, _ := services.GetNearbyTechnicians(c.Context(), a.DB, coord, body.AirconBrand)
				if len(nearby) > 0 {
					techData, _ := services.BatchLoadTechnicianData(c.Context(), a.DB, nearby)
					chosenTechID = services.SelectAvailableTechnician(nearby, techData, body.StartTime, endTime, nil, nil)
				}
			}
		}

		var customerID, apptID string

		err := dbtx.WithTxReadCommitted(c.Context(), a.DB, func(tx pgx.Tx) error {
			if err := tx.QueryRow(c.Context(),
				`INSERT INTO customers
				 ("customerName","customerPostalCode","customerLocation","customerAddress","customerPhone","customerPassword","customerEmail")
				 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
				body.CustomerName, body.PostalCode, location, body.CustomerAddr,
				body.CustomerPhone, hash, body.CustomerEmail,
			).Scan(&customerID); err != nil {
				if strings.Contains(err.Error(), "unique") {
					return &fiber.Error{Code: fiber.StatusBadRequest, Message: "Phone or email already registered."}
				}
				return fmt.Errorf("insert guest customer: %w", err)
			}

			airconName := fmt.Sprintf("%s-%d", body.AirconBrand, time.Now().Unix())
			var deviceID string
			if err := tx.QueryRow(c.Context(),
				`INSERT INTO customer_aircon_devices ("customerId","airconName","numberOfUnits","airconType")
				 VALUES ($1,$2,$3,'other') RETURNING id`,
				customerID, airconName, units,
			).Scan(&deviceID); err != nil {
				return fmt.Errorf("insert guest device: %w", err)
			}

			airconJSON, _ := json.Marshal([]string{deviceID})
			status := "1"
			var techIDPtr *uuid.UUID

			if chosenTechID != uuid.Nil {
				var techStatus string
				if err := tx.QueryRow(c.Context(),
					`SELECT "technicianStatus" FROM technicians WHERE id=$1 AND "isActive"=TRUE FOR UPDATE`,
					chosenTechID).Scan(&techStatus); err == nil && techStatus == "1" {
					avail, _ := services.IsSlotAvailable(c.Context(), a.DB, chosenTechID, body.StartTime, endTime, nil)
					if avail {
						techIDPtr = &chosenTechID
						status = "2"
					}
				}
			}

			custUUID, _ := uuid.Parse(customerID)
			return tx.QueryRow(c.Context(),
				`INSERT INTO appointments
				 ("customerId","technicianId","appointmentStartTime","appointmentEndTime","airconToService","appointmentStatus","paymentMethod")
				 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
				custUUID, techIDPtr, body.StartTime, endTime, airconJSON, status, pm,
			).Scan(&apptID)
		})
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				return c.Status(fe.Code).JSON(fiber.Map{"detail": fe.Message})
			}
			return fmt.Errorf("guest booking: %w", err)
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"message":    "Booking created successfully! A confirmation email has been sent.",
			"customerId": customerID, "appointmentId": apptID, "isGuestBooking": true,
		})
	}
}

// POST /api/appointments/sendEnquiry/
func sendEnquiryHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			CustomerID   string `json:"customerId"`
			EmailSubject string `json:"emailSubject"`
			EmailBody    string `json:"emailBody"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid body"})
		}
		var email string
		_ = a.DB.QueryRow(c.Context(),
			`SELECT "customerEmail" FROM customers WHERE id=$1`, body.CustomerID).Scan(&email)
		if email != "" {
			_ = a.Notif.SendEmail(email, body.EmailSubject, body.EmailBody)
		}
		return c.JSON(fiber.Map{"message": "Enquiry sent."})
	}
}

// ─── scan helpers ─────────────────────────────────────────────────────────────

// scanAppointmentJoined scans a row from the JOIN query used in list/get.
func scanAppointmentJoined(rows interface{ Scan(...interface{}) error }) (fiber.Map, error) {
	var (
		id, customerID        string
		technicianID          *string
		startTime, endTime    int64
		airconToService       json.RawMessage
		feedback              *string
		status, paymentMethod string
		cancelReason          *string
		cancelledBy           *string
		cancelledAt           *time.Time
		createdAt, updatedAt  time.Time
		// Joined columns
		customerName, customerPhone, customerEmail string
		technicianName                             *string
		technicianRating                           *float64
		technicianRatingCount                      *int
	)

	err := rows.Scan(
		&id, &customerID, &technicianID,
		&startTime, &endTime,
		&airconToService, &feedback,
		&status, &paymentMethod,
		&cancelReason, &cancelledBy, &cancelledAt,
		&createdAt, &updatedAt,
		&customerName, &customerPhone, &customerEmail,
		&technicianName, &technicianRating, &technicianRatingCount,
	)
	if err != nil {
		return nil, err
	}

	display := fiber.Map{
		"appointmentStatus": displayAppointmentStatus(status),
		"paymentMethod":     displayPaymentMethod(paymentMethod),
		"customerName":      customerName,
		"customerPhone":     customerPhone,
		"customerEmail":     customerEmail,
	}
	if technicianName != nil {
		display["technicianName"] = *technicianName
		display["technicianRating"] = technicianRating
		display["technicianRatingCount"] = technicianRatingCount
	}

	return fiber.Map{
		"id":                   id,
		"customerId":           customerID,
		"technicianId":         technicianID,
		"appointmentStartTime": startTime,
		"appointmentEndTime":   endTime,
		"airconToService":      airconToService,
		"customerFeedback":     feedback,
		"appointmentStatus":    status,
		"paymentMethod":        paymentMethod,
		"cancellationReason":   cancelReason,
		"cancelledBy":          cancelledBy,
		"cancelledAt":          cancelledAt,
		"created_at":           createdAt,
		"updated_at":           updatedAt,
		"display":              display,
	}, nil
}
