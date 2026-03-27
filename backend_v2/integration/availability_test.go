//go:build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAvailability_CreateSingle(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "AV Coord", "av.coord@test.com", "91800001")
	techID, _ := createTechnician(t, "AV Tech", "92800001", "560801", "av.tech@test.com", coordToken)

	resp := makeRequest(t, "POST", "/api/technician-availability/", map[string]interface{}{
		"technicianId": techID, "dayOfWeek": "saturday",
		"startTime": "09:00", "endTime": "13:00", "isAvailable": true,
	}, coordToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["id"])
}

func TestAvailability_Create_EndBeforeStart(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "AV2 Coord", "av2.coord@test.com", "91800010")
	techID, _ := createTechnician(t, "AV2 Tech", "92800010", "560810", "av2.tech@test.com", coordToken)
	resp := makeRequest(t, "POST", "/api/technician-availability/", map[string]interface{}{
		"technicianId": techID, "dayOfWeek": "sunday",
		"startTime": "17:00", "endTime": "08:00", // end before start
	}, coordToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAvailability_BulkCreate_5Days(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "BC Coord", "bc.coord@test.com", "91800020")
	// Create tech without the helper's auto-seeding to test bulk-create directly
	resp := makeRequest(t, "POST", "/api/technicians/", map[string]interface{}{
		"technicianName": "BC Tech", "technicianPhone": "92800020",
		"technicianEmail": "bc.tech@test.com", "technicianPassword": "Tech12345",
		"technicianPostalCode": "560820", "technicianAddress": "1 BC Road",
		"technicianStatus": "1",
	}, coordToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var techBody map[string]interface{}
	decodeBody(t, resp, &techBody)
	techID := techBody["id"].(string)

	days := []string{"monday", "tuesday", "wednesday", "thursday", "friday"}
	schedules := make([]map[string]string, len(days))
	for i, d := range days {
		schedules[i] = map[string]string{"dayOfWeek": d, "startTime": "08:00", "endTime": "18:00"}
	}
	bulkResp := makeRequest(t, "POST", "/api/technician-availability/bulk-create/", map[string]interface{}{
		"technicianId": techID, "schedules": schedules,
	}, coordToken)
	require.Equal(t, http.StatusCreated, bulkResp.StatusCode)
	var bulkBody []interface{}
	decodeBody(t, bulkResp, &bulkBody)
	assert.Len(t, bulkBody, 5)
}

func TestAvailability_BulkCreate_BelowMinimum(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "BM Coord", "bm.coord@test.com", "91800030")
	techID, _ := createTechnician(t, "BM Tech", "92800030", "560830", "bm.tech@test.com", coordToken)
	resp := makeRequest(t, "POST", "/api/technician-availability/bulk-create/", map[string]interface{}{
		"technicianId": techID,
		"schedules": []map[string]string{
			{"dayOfWeek": "monday", "startTime": "09:00", "endTime": "17:00"},
			{"dayOfWeek": "tuesday", "startTime": "09:00", "endTime": "17:00"},
			{"dayOfWeek": "wednesday", "startTime": "09:00", "endTime": "17:00"},
			{"dayOfWeek": "thursday", "startTime": "09:00", "endTime": "17:00"},
			// Only 4 days
		},
	}, coordToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAvailability_Delete_WouldDropBelowMinimum(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Delmin Coord", "delmin.coord@test.com", "91800040")
	techID, _ := createTechnician(t, "Delmin Tech", "92800040", "560840", "delmin.tech@test.com", coordToken)

	// List availability to get IDs (createTechnician seeds 5 days)
	listResp := makeRequest(t, "GET", "/api/technician-availability/?technicianId="+techID, nil, coordToken)
	require.Equal(t, http.StatusOK, listResp.StatusCode)
	var avList []interface{}
	decodeBody(t, listResp, &avList)
	require.Len(t, avList, 5, "expect 5 seeded days")

	avID := avList[0].(map[string]interface{})["id"].(string)
	delResp := makeRequest(t, "DELETE", "/api/technician-availability/"+avID+"/", nil, coordToken)
	assert.Equal(t, http.StatusBadRequest, delResp.StatusCode)
}

func TestAvailability_GetAvailableSlots_WithinSchedule(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Slot Coord", "slot.coord@test.com", "91800050")
	techID, _ := createTechnician(t, "Slot Tech", "92800050", "560850", "slot.tech@test.com", coordToken)

	// Pick the next Monday
	nextMonday := nextWeekday(time.Monday)
	dateStr := nextMonday.Format("2006-01-02")
	resp := makeRequest(t, "GET",
		fmt.Sprintf("/api/technician-availability/available-slots/?technicianId=%s&date=%s&durationHours=1", techID, dateStr),
		nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	slots := body["availableSlots"].([]interface{})
	assert.Greater(t, len(slots), 0, "expected slots within working hours")
}

func TestAvailability_GetAvailableSlots_DayOff(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Off Coord", "off.coord@test.com", "91800060")
	techID, _ := createTechnician(t, "Off Tech", "92800060", "560860", "off.tech@test.com", coordToken)

	// createTechnician seeds Mon–Fri only; pick next Sunday
	nextSunday := nextWeekday(time.Sunday)
	dateStr := nextSunday.Format("2006-01-02")
	resp := makeRequest(t, "GET",
		fmt.Sprintf("/api/technician-availability/available-slots/?technicianId=%s&date=%s", techID, dateStr),
		nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	slots := body["availableSlots"].([]interface{})
	assert.Len(t, slots, 0, "no slots expected on day off")
}

func TestAvailability_GetWorkingDays(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "WD Coord", "wd.coord@test.com", "91800070")
	techID, _ := createTechnician(t, "WD Tech", "92800070", "560870", "wd.tech@test.com", coordToken)
	resp := makeRequest(t, "GET", "/api/technician-availability/working-days/?technicianId="+techID, nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	days := body["weeklyWorkingDays"].([]interface{})
	assert.Len(t, days, 5)
	assert.Equal(t, true, body["meetsMinimumRequirement"])
}

// nextWeekday returns the date of the next occurrence of the given weekday.
func nextWeekday(wd time.Weekday) time.Time {
	t := time.Now().UTC()
	for t.Weekday() != wd {
		t = t.Add(24 * time.Hour)
	}
	return t
}
