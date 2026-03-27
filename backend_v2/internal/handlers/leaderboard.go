package handlers

import (
	"backend_v2/internal/blockchain"
	"backend_v2/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/leaderboard/
func leaderboardHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rows, err := a.DB.Query(c.Context(),
			`SELECT t.id::text, t."technicianName", t."technicianRating", t."technicianRatingCount",
			        COALESCE(completed.cnt,0)::bigint AS completed_jobs
			 FROM technicians t
			 LEFT JOIN (
			     SELECT "technicianId", COUNT(*) AS cnt FROM appointments
			     WHERE "appointmentStatus"='3' GROUP BY "technicianId"
			 ) completed ON completed."technicianId" = t.id
			 WHERE t."isActive"=TRUE
			 ORDER BY t."technicianRating" DESC, completed_jobs DESC`)
		if err != nil {
			return err
		}
		defer rows.Close()

		type entry struct {
			Rank           int              `json:"rank"`
			TechnicianID   string           `json:"technicianId"`
			TechnicianName string           `json:"technicianName"`
			Rating         float64          `json:"rating"`
			RatingCount    int64            `json:"ratingCount"`
			CompletedJobs  int64            `json:"completedJobs"`
			Score          float64          `json:"score"`
			Badges         []services.Badge `json:"badges"`
		}

		var result []entry
		rank := 1
		for rows.Next() {
			var id, name string
			var rating float64
			var ratingCount, completedJobs int64
			if err := rows.Scan(&id, &name, &rating, &ratingCount, &completedJobs); err != nil {
				return err
			}
			stats := services.TechnicianStats{
				TechnicianID:   id,
				TechnicianName: name,
				Rating:         rating,
				RatingCount:    ratingCount,
				CompletedJobs:  completedJobs,
			}
			result = append(result, entry{
				Rank:           rank,
				TechnicianID:   id,
				TechnicianName: name,
				Rating:         rating,
				RatingCount:    ratingCount,
				CompletedJobs:  completedJobs,
				Score:          services.ComputeScore(stats),
				Badges:         services.ComputeBadges(stats),
			})
			rank++
		}
		if result == nil {
			result = []entry{}
		}
		return c.JSON(result)
	}
}

// GET /api/blockchain/verify/:appointment_id/
func blockchainVerifyHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("appointment_id")
		apptUUID, err := uuid.Parse(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid appointment_id"})
		}
		result, err := blockchain.VerifyChain(c.Context(), a.DB, apptUUID)
		if err != nil {
			return err
		}
		return c.JSON(result)
	}
}

// GET /api/blockchain/history/:appointment_id/
func blockchainHistoryHandler(a *App) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("appointment_id")
		apptUUID, err := uuid.Parse(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"detail": "invalid appointment_id"})
		}
		blocks, err := blockchain.GetHistory(c.Context(), a.DB, apptUUID)
		if err != nil {
			return err
		}
		if blocks == nil {
			blocks = []blockchain.Block{}
		}
		return c.JSON(blocks)
	}
}
