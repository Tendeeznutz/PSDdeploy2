// Package services contains business logic ported from the Python backend.
// scheduling.go is a port of scheduling_algo.py.
//
// N+1 / query efficiency notes:
//
//	GetNearbyTechnicians   — 1 query regardless of candidate count.
//
//	GetTechnicianToAssign  — callers must first call BatchLoadTechnicianData
//	  (2 queries for any number of candidates), then call
//	  SelectAvailableTechnician which does pure in-memory work.
//	  The handler then issues ONE locked SELECT … FOR UPDATE on the chosen
//	  candidate inside the transaction.
//
//	GetAvailableTimeSlots  — 3 queries total (schedule lookup ×2, then one
//	  appointments batch load) regardless of how many 30-min slots exist in
//	  the working day.
package services

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// TimeBufferSeconds is the 2.5-hour buffer kept after each appointment.
	TimeBufferSeconds = 9000
	// MaxSearchRadiusKm — maximum distance to search for technicians.
	MaxSearchRadiusKm = 30.0
)

// ApptInterval is a half-open appointment window [Start, End).
type ApptInterval struct {
	ID    uuid.UUID
	Start int64
	End   int64
}

// DateOverride holds a specific-date availability record.
type DateOverride struct {
	IsAvailable bool
	StartTime   string
	EndTime     string
}

// TechAvailInfo holds all pre-fetched scheduling data for one technician.
// Built once by BatchLoadTechnicianData; used for O(1) in-memory slot checks.
type TechAvailInfo struct {
	// WeeklySchedule maps dayOfWeek (e.g. "monday") to [startTime, endTime].
	WeeklySchedule map[string][2]string
	// DateOverrides maps "YYYY-MM-DD" to a specific-date override.
	DateOverrides map[string]*DateOverride
	// Appointments holds all active (Pending/Confirmed) bookings.
	Appointments []ApptInterval
}

// ─── Public API ──────────────────────────────────────────────────────────────

// techCandidate is an intermediate struct used during technician selection.
type techCandidate struct {
	ID           uuid.UUID
	Location     Coord
	Specs        []string
	DistanceKm   float64
	IsSpecialist bool
}

// GetNearbyTechnicians returns active, available technician IDs sorted by
// (specialist-first, then distance).  One query, no loop queries.
func GetNearbyTechnicians(
	ctx context.Context,
	pool *pgxpool.Pool,
	customerLocation Coord,
	airconBrand string,
) ([]uuid.UUID, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, "technicianLocation", specializations
		 FROM technicians
		 WHERE "isActive" = TRUE AND "technicianStatus" = '1' AND "technicianLocation" IS NOT NULL`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []techCandidate
	for rows.Next() {
		var id uuid.UUID
		var locationStr *string
		var specJSON json.RawMessage
		if err := rows.Scan(&id, &locationStr, &specJSON); err != nil {
			continue
		}
		if locationStr == nil || *locationStr == "" {
			continue
		}
		coord, err := ParseCoord(*locationStr)
		if err != nil {
			continue
		}
		dist := HaversineKm(customerLocation, coord)
		if dist > MaxSearchRadiusKm {
			continue
		}
		var specs []string
		_ = json.Unmarshal(specJSON, &specs)
		isSpec := false
		if airconBrand != "" {
			for _, s := range specs {
				if s == airconBrand {
					isSpec = true
					break
				}
			}
		}
		candidates = append(candidates, techCandidate{
			ID: id, Location: coord, Specs: specs,
			DistanceKm: dist, IsSpecialist: isSpec,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].IsSpecialist != candidates[j].IsSpecialist {
			return candidates[i].IsSpecialist
		}
		return candidates[i].DistanceKm < candidates[j].DistanceKm
	})

	ids := make([]uuid.UUID, len(candidates))
	for i, c := range candidates {
		ids[i] = c.ID
	}
	return ids, nil
}

// BatchLoadTechnicianData fetches availability records and active appointments
// for a slice of technician IDs using exactly 2 queries, regardless of N.
// Returns a map keyed by technician ID for O(1) subsequent lookups.
func BatchLoadTechnicianData(
	ctx context.Context,
	pool *pgxpool.Pool,
	techIDs []uuid.UUID,
) (map[uuid.UUID]*TechAvailInfo, error) {
	result := make(map[uuid.UUID]*TechAvailInfo, len(techIDs))
	for _, id := range techIDs {
		result[id] = &TechAvailInfo{
			WeeklySchedule: make(map[string][2]string),
			DateOverrides:  make(map[string]*DateOverride),
		}
	}
	if len(techIDs) == 0 {
		return result, nil
	}

	// ── Query 1: all availability records ─────────────────────────────────
	avRows, err := pool.Query(ctx,
		`SELECT "technicianId", "dayOfWeek", "startTime", "endTime", "specificDate", "isAvailable"
		   FROM technician_availability
		  WHERE "technicianId" = ANY($1)`,
		techIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("batch availability: %w", err)
	}
	defer avRows.Close()
	for avRows.Next() {
		var techID uuid.UUID
		var dow, startT, endT string
		var specificDate *string
		var isAvail bool
		if err := avRows.Scan(&techID, &dow, &startT, &endT, &specificDate, &isAvail); err != nil {
			continue
		}
		info, ok := result[techID]
		if !ok {
			continue
		}
		if specificDate != nil {
			info.DateOverrides[*specificDate] = &DateOverride{
				IsAvailable: isAvail,
				StartTime:   startT,
				EndTime:     endT,
			}
		} else if isAvail {
			info.WeeklySchedule[dow] = [2]string{startT, endT}
		}
	}
	if err := avRows.Err(); err != nil {
		return nil, err
	}

	// ── Query 2: all active appointments ──────────────────────────────────
	apptRows, err := pool.Query(ctx,
		`SELECT id, "technicianId", "appointmentStartTime", "appointmentEndTime"
		   FROM appointments
		  WHERE "technicianId" = ANY($1)
		    AND "appointmentStatus" IN ('1','2')`,
		techIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("batch appointments: %w", err)
	}
	defer apptRows.Close()
	for apptRows.Next() {
		var apptID, techID uuid.UUID
		var start, end int64
		if err := apptRows.Scan(&apptID, &techID, &start, &end); err != nil {
			continue
		}
		if info, ok := result[techID]; ok {
			info.Appointments = append(info.Appointments, ApptInterval{ID: apptID, Start: start, End: end})
		}
	}
	if err := apptRows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

// IsAvailableInMemory checks whether a technician is available for
// [startUnix, endUnix) using only pre-fetched data — zero DB queries.
func (info *TechAvailInfo) IsAvailableInMemory(
	startUnix, endUnix int64,
	excludeApptID *uuid.UUID,
) bool {
	t := time.Unix(startUnix, 0).UTC()
	dayOfWeek := dayName(t.Weekday())
	dateStr := t.Format("2006-01-02")

	// Determine working window.
	var workStart, workEnd string
	if override, ok := info.DateOverrides[dateStr]; ok {
		if !override.IsAvailable {
			return false
		}
		workStart, workEnd = override.StartTime, override.EndTime
	} else if sched, ok := info.WeeklySchedule[dayOfWeek]; ok {
		workStart, workEnd = sched[0], sched[1]
	}
	// If we have a schedule entry, verify the slot falls within the window.
	if workStart != "" && !isWithinWindow(t, workStart, workEnd) {
		return false
	}

	// Check appointment conflicts — buffered by TimeBufferSeconds.
	bufferedEnd := endUnix + TimeBufferSeconds
	for _, a := range info.Appointments {
		if excludeApptID != nil && a.ID == *excludeApptID {
			continue
		}
		// Conflict: existing [a.Start, a.End+buffer) overlaps [startUnix, bufferedEnd).
		if a.Start < bufferedEnd && (a.End+TimeBufferSeconds) > startUnix {
			return false
		}
	}
	return true
}

// SelectAvailableTechnician iterates the sorted candidate list and returns the
// first technician whose pre-fetched data indicates availability.
// Pure in-memory — no DB queries.
func SelectAvailableTechnician(
	candidates []uuid.UUID,
	data map[uuid.UUID]*TechAvailInfo,
	startUnix, endUnix int64,
	excludeApptID *uuid.UUID,
	currentTechID *uuid.UUID,
) uuid.UUID {
	// Prefer keeping the current technician.
	if currentTechID != nil {
		if info, ok := data[*currentTechID]; ok {
			if info.IsAvailableInMemory(startUnix, endUnix, excludeApptID) {
				return *currentTechID
			}
		}
	}
	for _, id := range candidates {
		if currentTechID != nil && id == *currentTechID {
			continue
		}
		info, ok := data[id]
		if !ok {
			continue
		}
		if info.IsAvailableInMemory(startUnix, endUnix, excludeApptID) {
			return id
		}
	}
	return uuid.Nil
}

// IsTechnicianAvailableOnDay checks the technician's schedule against a
// Unix timestamp.  Used for single-technician lookups (not batch path).
func IsTechnicianAvailableOnDay(ctx context.Context, pool *pgxpool.Pool, techID uuid.UUID, startUnix int64) (bool, error) {
	t := time.Unix(startUnix, 0).UTC()
	date := t.Format("2006-01-02")
	dayOfWeek := dayName(t.Weekday())

	var isAvail bool
	var startT, endT string

	// Specific-date override first.
	err := pool.QueryRow(ctx,
		`SELECT "isAvailable","startTime","endTime" FROM technician_availability
		  WHERE "technicianId" = $1 AND "specificDate" = $2`,
		techID, date,
	).Scan(&isAvail, &startT, &endT)
	if err == nil {
		if !isAvail {
			return false, nil
		}
		return isWithinWindow(t, startT, endT), nil
	}

	// Weekly schedule fallback.
	err = pool.QueryRow(ctx,
		`SELECT "isAvailable","startTime","endTime" FROM technician_availability
		  WHERE "technicianId" = $1 AND "dayOfWeek" = $2 AND "specificDate" IS NULL`,
		techID, dayOfWeek,
	).Scan(&isAvail, &startT, &endT)
	if err != nil {
		return true, nil // No schedule → default available.
	}
	if !isAvail {
		return false, nil
	}
	return isWithinWindow(t, startT, endT), nil
}

// IsSlotAvailable checks whether a technician has no overlapping appointments
// in the given window.  Used for single-technician spot-checks; batch callers
// should prefer IsAvailableInMemory.
func IsSlotAvailable(
	ctx context.Context,
	pool *pgxpool.Pool,
	techID uuid.UUID,
	startUnix, endUnix int64,
	excludeAppointmentID *uuid.UUID,
) (bool, error) {
	avail, err := IsTechnicianAvailableOnDay(ctx, pool, techID, startUnix)
	if err != nil || !avail {
		return false, err
	}

	bufferedEnd := endUnix + TimeBufferSeconds
	query := `SELECT COUNT(*) FROM appointments
	           WHERE "technicianId" = $1
	             AND "appointmentStatus" IN ('1','2')
	             AND "appointmentStartTime" < $2
	             AND ("appointmentEndTime" + $3) > $4`
	args := []interface{}{techID, bufferedEnd, TimeBufferSeconds, startUnix}

	if excludeAppointmentID != nil {
		query += ` AND id != $5`
		args = append(args, *excludeAppointmentID)
	}
	var count int64
	if err := pool.QueryRow(ctx, query, args...).Scan(&count); err != nil {
		return false, err
	}
	return count == 0, nil
}

// GetAvailableTimeSlots returns available (start, end) unix pairs for a
// technician on a date, in 30-minute increments.
//
// N+1 fix: loads the technician's appointments for that day in ONE query,
// then checks each slot in-memory.  Total: 3 queries (2 schedule + 1 appts).
func GetAvailableTimeSlots(
	ctx context.Context,
	pool *pgxpool.Pool,
	techID uuid.UUID,
	dateStr string,
	durationHours float64,
) ([][2]int64, error) {
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, err
	}
	dayOfWeek := dayName(date.Weekday())

	// Load working window (up to 2 queries — same as before).
	var isAvail bool
	var startT, endT string
	err = pool.QueryRow(ctx,
		`SELECT "isAvailable","startTime","endTime" FROM technician_availability
		  WHERE "technicianId" = $1 AND "specificDate" = $2`,
		techID, dateStr,
	).Scan(&isAvail, &startT, &endT)
	if err != nil {
		err = pool.QueryRow(ctx,
			`SELECT "isAvailable","startTime","endTime" FROM technician_availability
			  WHERE "technicianId" = $1 AND "dayOfWeek" = $2 AND "specificDate" IS NULL`,
			techID, dayOfWeek,
		).Scan(&isAvail, &startT, &endT)
		if err != nil {
			return nil, nil
		}
	}
	if !isAvail {
		return nil, nil
	}

	workStart := parseHHMM(date, startT)
	workEnd := parseHHMM(date, endT)

	// ONE query: load all active appointments for this technician that could
	// overlap with any slot in the working window (buffered).
	apptRows, err := pool.Query(ctx,
		`SELECT "appointmentStartTime", "appointmentEndTime"
		   FROM appointments
		  WHERE "technicianId" = $1
		    AND "appointmentStatus" IN ('1','2')
		    AND "appointmentStartTime" < $2
		    AND "appointmentEndTime"   > $3`,
		techID,
		workEnd+TimeBufferSeconds,
		workStart-TimeBufferSeconds,
	)
	if err != nil {
		return nil, err
	}
	defer apptRows.Close()

	var appts []ApptInterval
	for apptRows.Next() {
		var s, e int64
		if err := apptRows.Scan(&s, &e); err == nil {
			appts = append(appts, ApptInterval{Start: s, End: e})
		}
	}
	if err := apptRows.Err(); err != nil {
		return nil, err
	}

	// Generate slots — all overlap checks are pure in-memory.
	durationSec := int64(durationHours * 3600)
	var slots [][2]int64
	current := workStart
	for current+durationSec <= workEnd {
		end := current + durationSec
		if isSlotFreeInMemory(appts, current, end, nil) {
			slots = append(slots, [2]int64{current, end})
		}
		current += 1800
	}
	return slots, nil
}

// isSlotFreeInMemory returns true when no pre-loaded appointment conflicts
// with [startUnix, endUnix) (including the 2.5-hour buffer).
func isSlotFreeInMemory(appts []ApptInterval, startUnix, endUnix int64, excludeID *uuid.UUID) bool {
	bufferedEnd := endUnix + TimeBufferSeconds
	for _, a := range appts {
		if excludeID != nil && a.ID == *excludeID {
			continue
		}
		if a.Start < bufferedEnd && (a.End+TimeBufferSeconds) > startUnix {
			return false
		}
	}
	return true
}

// ─── private helpers ─────────────────────────────────────────────────────────

func dayName(w time.Weekday) string {
	return [7]string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}[w]
}

func isWithinWindow(t time.Time, startStr, endStr string) bool {
	sh, sm := parseTime(startStr)
	eh, em := parseTime(endStr)
	start := time.Date(t.Year(), t.Month(), t.Day(), sh, sm, 0, 0, time.UTC)
	end := time.Date(t.Year(), t.Month(), t.Day(), eh, em, 0, 0, time.UTC)
	return !t.Before(start) && t.Before(end)
}

func parseHHMM(date time.Time, s string) int64 {
	h, m := parseTime(s)
	return time.Date(date.Year(), date.Month(), date.Day(), h, m, 0, 0, time.UTC).Unix()
}

func parseTime(s string) (int, int) {
	var h, m int
	fmt.Sscanf(s, "%d:%d", &h, &m)
	return h, m
}
