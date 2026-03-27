-- name: GetLeaderboardData :many
-- Returns all active technicians with their completed job count for ranking.
SELECT
    t.id,
    t."technicianName",
    t."technicianRating",
    t."technicianRatingCount",
    t."isActive",
    COALESCE(completed.cnt, 0)::BIGINT AS completed_jobs
FROM technicians t
LEFT JOIN (
    SELECT "technicianId", COUNT(*) AS cnt
    FROM appointments
    WHERE "appointmentStatus" = '3'
    GROUP BY "technicianId"
) completed ON completed."technicianId" = t.id
WHERE t."isActive" = TRUE
ORDER BY t."technicianRating" DESC, completed_jobs DESC;
