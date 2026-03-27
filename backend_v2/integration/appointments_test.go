//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// helper: mark appointment completed directly in DB for rating tests
func completeAppointment(t *testing.T, apptID string) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`UPDATE appointments SET "appointmentStatus"='3', updated_at=NOW() WHERE id=$1`, apptID)
	require.NoError(t, err)
}

func TestAppointments_Create_TechAvailable(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "AP Coord", "ap.coord@test.com", "91400001")
	_, _ = createTechnician(t, "AP Tech", "92400001", "560401", "ap.tech@test.com", coordToken)
	custID, custToken := createCustomer(t, "AP Cust", "ap.cust@test.com", "93400001", "560401")
	devID := createDevice(t, custID, "AP AC", custToken)

	resp := makeRequest(t, "POST", "/api/appointments/", map[string]interface{}{
		"customerId": custID, "appointmentStartTime": futureUnix(5),
		"airconToService": []string{devID}, "paymentMethod": "cash",
	}, custToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["id"])
	// With a tech seeded at the same location as the customer, it should be Confirmed.
	assert.Equal(t, "2", body["appointmentStatus"])
}

func TestAppointments_Create_NoTechAvailable(t *testing.T) {
	cleanDB(t)
	// No technicians seeded — should create as Pending.
	custID, custToken := createCustomer(t, "NTA Cust", "nta.cust@test.com", "93400010", "560410")
	devID := createDevice(t, custID, "NTA AC", custToken)
	resp := makeRequest(t, "POST", "/api/appointments/", map[string]interface{}{
		"customerId": custID, "appointmentStartTime": futureUnix(5),
		"airconToService": []string{devID}, "paymentMethod": "cash",
	}, custToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "1", body["appointmentStatus"])
}

func TestAppointments_Create_DeviceNotFound(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "DNF Cust", "dnf.cust@test.com", "93400020", "560420")
	resp := makeRequest(t, "POST", "/api/appointments/", map[string]interface{}{
		"customerId": custID, "appointmentStartTime": futureUnix(5),
		"airconToService": []string{"00000000-0000-0000-0000-000000000000"},
	}, custToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_Create_DeviceWrongCustomer(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "WC Cust1", "wc.cust1@test.com", "93400030", "560430")
	othID, _ := createCustomer(t, "WC Cust2", "wc.cust2@test.com", "93400031", "560431")
	// Create device for other customer
	_, othToken := loginCustomer(t, "wc.cust2@test.com", "Test1234"), ""
	_ = othToken
	othToken = loginCustomer(t, "wc.cust2@test.com", "Test1234")
	devID := createDevice(t, othID, "Other AC", othToken)
	resp := makeRequest(t, "POST", "/api/appointments/", map[string]interface{}{
		"customerId": custID, "appointmentStartTime": futureUnix(5),
		"airconToService": []string{devID},
	}, custToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_Create_PastTime(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "PT Cust", "pt.cust@test.com", "93400040", "560440")
	devID := createDevice(t, custID, "PT AC", custToken)
	resp := makeRequest(t, "POST", "/api/appointments/", map[string]interface{}{
		"customerId": custID, "appointmentStartTime": futureUnix(-1), // yesterday
		"airconToService": []string{devID},
	}, custToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_GuestBooking_Valid(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/appointments/guest-booking/", map[string]interface{}{
		"customerName": "Guest Joe", "customerPhone": "93400050",
		"customerEmail": "guest.joe@test.com", "customerAddress": "50 Guest St",
		"customerPostalCode": "560450", "airconBrand": "Daikin",
		"numberOfUnits": 1, "appointmentStartTime": futureUnix(3), "paymentMethod": "cash",
	}, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["customerId"])
	assert.NotEmpty(t, body["appointmentId"])
	assert.Equal(t, true, body["isGuestBooking"])
}

func TestAppointments_GuestBooking_DuplicatePhone(t *testing.T) {
	cleanDB(t)
	_, _ = createCustomer(t, "Dup Guest", "dup.guest@test.com", "93400060", "560460")
	resp := makeRequest(t, "POST", "/api/appointments/guest-booking/", map[string]interface{}{
		"customerName": "Dup Guest2", "customerPhone": "93400060",
		"customerEmail": "other.guest@test.com", "customerAddress": "60 Guest St",
		"customerPostalCode": "560461", "appointmentStartTime": futureUnix(3),
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_List_FilterByCustomer(t *testing.T) {
	cleanDB(t)
	cust1ID, cust1Token := createCustomer(t, "List C1", "list.c1@test.com", "93400070", "560470")
	_, cust2Token := createCustomer(t, "List C2", "list.c2@test.com", "93400071", "560471")
	dev1 := createDevice(t, cust1ID, "List AC", cust1Token)
	createAppointment(t, cust1ID, dev1, futureUnix(5), cust1Token)

	resp := makeRequest(t, "GET", "/api/appointments/?customerId="+cust1ID, nil, cust2Token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	for _, item := range body {
		m := item.(map[string]interface{})
		assert.Equal(t, cust1ID, m["customerId"])
	}
}

func TestAppointments_List_HasDisplayBlock(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "Disp Cust", "disp.cust@test.com", "93400080", "560480")
	devID := createDevice(t, custID, "Disp AC", custToken)
	createAppointment(t, custID, devID, futureUnix(5), custToken)
	resp := makeRequest(t, "GET", "/api/appointments/?customerId="+custID, nil, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.Len(t, body, 1)
	appt := body[0].(map[string]interface{})
	display, ok := appt["display"].(map[string]interface{})
	require.True(t, ok, "display block missing")
	assert.Equal(t, "Disp Cust", display["customerName"])
}

func TestAppointments_Cancel_Valid(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "Cancel Cust", "cancel.cust@test.com", "93400090", "560490")
	devID := createDevice(t, custID, "Cancel AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	resp := makeRequest(t, "PATCH", "/api/appointments/"+apptID+"/", map[string]interface{}{
		"appointmentStatus": "4", "cancellationReason": "Changed plans",
	}, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "4", body["appointmentStatus"])
}

func TestAppointments_Cancel_NoReason(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "NR Cust", "nr.cust@test.com", "93400100", "560500")
	devID := createDevice(t, custID, "NR AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	resp := makeRequest(t, "PATCH", "/api/appointments/"+apptID+"/", map[string]interface{}{
		"appointmentStatus": "4",
	}, custToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_Cancel_ShortNotice_AppliesPenalty(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "SN Cust", "sn.cust@test.com", "93400110", "560510")
	devID := createDevice(t, custID, "SN AC", custToken)
	// Appointment in 10 minutes (within 30-min short-notice window)
	apptID := createAppointment(t, custID, devID, futureUnix(0)+600, custToken)
	makeRequest(t, "PATCH", "/api/appointments/"+apptID+"/", map[string]interface{}{
		"appointmentStatus": "4", "cancellationReason": "Short notice cancel",
	}, custToken)
	// Check penalty fee updated
	var fee float64
	_ = testPool.QueryRow(context.Background(),
		`SELECT "pendingPenaltyFee" FROM customers WHERE id=$1`, custID).Scan(&fee)
	assert.Greater(t, fee, 0.0)
}

func TestAppointments_RateTechnician_Valid(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "RT Coord", "rt.coord@test.com", "91400020")
	techID, _ := createTechnician(t, "RT Tech", "92400020", "560420", "rt.tech@test.com", coordToken)
	custID, custToken := createCustomer(t, "RT Cust", "rt.cust@test.com", "93400120", "560420")
	devID := createDevice(t, custID, "RT AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)

	// Force assign tech and complete
	_, _ = testPool.Exec(context.Background(),
		`UPDATE appointments SET "technicianId"=$2,"appointmentStatus"='3' WHERE id=$1`, apptID, techID)

	resp := makeRequest(t, "POST", "/api/appointments/"+apptID+"/rate-technician/", map[string]interface{}{
		"customerId": custID, "rating": 5,
	}, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotNil(t, body["technicianRating"])
}

func TestAppointments_RateTechnician_Duplicate(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "RD Coord", "rd.coord@test.com", "91400030")
	techID, _ := createTechnician(t, "RD Tech", "92400030", "560430", "rd.tech@test.com", coordToken)
	custID, custToken := createCustomer(t, "RD Cust", "rd.cust@test.com", "93400130", "560430")
	devID := createDevice(t, custID, "RD AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	_, _ = testPool.Exec(context.Background(),
		`UPDATE appointments SET "technicianId"=$2,"appointmentStatus"='3' WHERE id=$1`, apptID, techID)
	// First rating
	makeRequest(t, "POST", "/api/appointments/"+apptID+"/rate-technician/", map[string]interface{}{
		"customerId": custID, "rating": 4,
	}, custToken)
	// Duplicate
	resp := makeRequest(t, "POST", "/api/appointments/"+apptID+"/rate-technician/", map[string]interface{}{
		"customerId": custID, "rating": 5,
	}, custToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_RateTechnician_NotCompleted(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "RNC Coord", "rnc.coord@test.com", "91400040")
	techID, _ := createTechnician(t, "RNC Tech", "92400040", "560440", "rnc.tech@test.com", coordToken)
	custID, custToken := createCustomer(t, "RNC Cust", "rnc.cust@test.com", "93400140", "560440")
	devID := createDevice(t, custID, "RNC AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	// Assign tech but leave status as Confirmed (not completed)
	_, _ = testPool.Exec(context.Background(),
		`UPDATE appointments SET "technicianId"=$2 WHERE id=$1`, apptID, techID)
	resp := makeRequest(t, "POST", "/api/appointments/"+apptID+"/rate-technician/", map[string]interface{}{
		"customerId": custID, "rating": 5,
	}, custToken)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAppointments_RateCustomer_Valid(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "RC Coord", "rc.coord@test.com", "91400050")
	techID, techToken := createTechnician(t, "RC Tech", "92400050", "560450", "rc.tech@test.com", coordToken)
	custID, custToken := createCustomer(t, "RC Cust", "rc.cust@test.com", "93400150", "560450")
	devID := createDevice(t, custID, "RC AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	_, _ = testPool.Exec(context.Background(),
		`UPDATE appointments SET "technicianId"=$2,"appointmentStatus"='3' WHERE id=$1`, apptID, techID)
	resp := makeRequest(t, "POST", "/api/appointments/"+apptID+"/rate-customer/", map[string]interface{}{
		"technicianId": techID, "rating": 4,
	}, techToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotNil(t, body["customerRating"])
}

func TestAppointments_PenaltyStatus(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "PS Cust", "ps.cust@test.com", "93400160", "560460")
	resp := makeRequest(t, "GET", "/api/appointments/penalty-status/?customerId="+custID, nil, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, float64(0), body["current_month_cancellations"])
	assert.NotNil(t, body["penalty_threshold"])
}
