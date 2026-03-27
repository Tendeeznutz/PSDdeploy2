//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTechnicians_Create_CoordAuth(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "TC Coord", "tc.coord@test.com", "91200001")
	resp := makeRequest(t, "POST", "/api/technicians/", map[string]interface{}{
		"technicianName": "TC Tech", "technicianPhone": "92200001",
		"technicianEmail": "tc.tech@test.com", "technicianPassword": "Tech12345",
		"technicianPostalCode": "560200", "technicianAddress": "1 TC Road",
		"technicianStatus": "1", "technicianTravelType": "own_vehicle",
	}, coordToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["id"])
}

func TestTechnicians_Create_NoAuth(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/technicians/", map[string]interface{}{
		"technicianName": "No Auth Tech", "technicianPhone": "92200002",
		"technicianPassword": "Tech12345", "technicianPostalCode": "560201",
		"technicianAddress": "2 Road",
	}, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestTechnicians_Login_Active(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "TL Coord", "tl.coord@test.com", "91200010")
	_, token := createTechnician(t, "TL Tech", "92200010", "560210", "tl.tech@test.com", coordToken)
	assert.NotEmpty(t, token)
}

func TestTechnicians_Login_Inactive(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "TI Coord", "ti.coord@test.com", "91200020")
	techID, _ := createTechnician(t, "TI Tech", "92200020", "560220", "ti.tech@test.com", coordToken)
	// Deactivate
	resp := makeRequest(t, "POST", "/api/technicians/"+techID+"/toggle-active-status/", map[string]string{"reason": "test"}, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	// Login must fail
	resp = makeRequest(t, "POST", "/api/technicians/login/", map[string]string{
		"email": "92200020", "password": "Tech12345",
	}, "")
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestTechnicians_FilterByStatus(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "TF Coord", "tf.coord@test.com", "91200030")
	createTechnician(t, "TF Avail", "92200030", "560230", "tf.avail@test.com", coordToken)
	// Create a second technician then set unavailable
	techID2, _ := createTechnician(t, "TF Unavail", "92200031", "560231", "tf.unavail@test.com", coordToken)
	makeRequest(t, "POST", "/api/technicians/"+techID2+"/toggle-status/", nil, coordToken)

	resp := makeRequest(t, "GET", "/api/technicians/?technicianStatus=1", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	for _, item := range body {
		m := item.(map[string]interface{})
		assert.Equal(t, "1", m["technicianStatus"])
	}
}

func TestTechnicians_ForgotPassword_CreatesToken(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "FP Coord", "fp.coord@test.com", "91200040")
	createTechnician(t, "FP Tech", "92200040", "560240", "fp.tech@test.com", coordToken)
	resp := makeRequest(t, "POST", "/api/technicians/forgot-password/", map[string]string{
		"phone": "92200040",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	// Verify token row exists
	var count int
	err := testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM technician_password_reset_tokens
		  WHERE "isUsed"=FALSE AND "expiresAt" > NOW()`).Scan(&count)
	require.NoError(t, err)
	assert.Greater(t, count, 0)
}

func TestTechnicians_ValidateResetToken_Valid(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "VT Coord", "vt.coord@test.com", "91200050")
	techID, _ := createTechnician(t, "VT Tech", "92200050", "560250", "vt.tech@test.com", coordToken)
	// Seed a token directly
	token := "test-valid-token-12345"
	_, err := testPool.Exec(context.Background(),
		`INSERT INTO technician_password_reset_tokens (technician_id,token,"expiresAt")
		 VALUES ($1,$2,NOW()+INTERVAL '24 hours')`, techID, token)
	require.NoError(t, err)
	resp := makeRequest(t, "GET", "/api/technicians/validate-reset-token/?token="+token, nil, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, true, body["valid"])
}

func TestTechnicians_ValidateResetToken_Expired(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "EX Coord", "ex.coord@test.com", "91200060")
	techID, _ := createTechnician(t, "EX Tech", "92200060", "560260", "ex.tech@test.com", coordToken)
	token := "expired-token-99999"
	_, _ = testPool.Exec(context.Background(),
		`INSERT INTO technician_password_reset_tokens (technician_id,token,"expiresAt")
		 VALUES ($1,$2,NOW()-INTERVAL '1 hour')`, techID, token)
	resp := makeRequest(t, "GET", "/api/technicians/validate-reset-token/?token="+token, nil, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, false, body["valid"])
}

func TestTechnicians_ResetPassword_Success(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "RP Coord", "rp.coord@test.com", "91200070")
	_, _ = createTechnician(t, "RP Tech", "92200070", "560270", "rp.tech@test.com", coordToken)
	// Request reset
	makeRequest(t, "POST", "/api/technicians/forgot-password/", map[string]string{"phone": "92200070"}, "")
	var token string
	_ = testPool.QueryRow(context.Background(),
		`SELECT token FROM technician_password_reset_tokens WHERE "isUsed"=FALSE ORDER BY created_at DESC LIMIT 1`).Scan(&token)
	require.NotEmpty(t, token)
	// Reset password
	resp := makeRequest(t, "POST", "/api/technicians/reset-password/", map[string]string{
		"token": token, "newPassword": "NewPass123",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	// Login with new password
	resp = makeRequest(t, "POST", "/api/technicians/login/", map[string]string{
		"email": "92200070", "password": "NewPass123",
	}, "")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestTechnicians_ResetPassword_WeakPassword(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/technicians/reset-password/", map[string]string{
		"token": "sometoken", "newPassword": "short",
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestTechnicians_ToggleActiveStatus_Deactivate_Reactivate(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "TA Coord", "ta.coord@test.com", "91200080")
	techID, _ := createTechnician(t, "TA Tech", "92200080", "560280", "ta.tech@test.com", coordToken)

	// Deactivate
	resp := makeRequest(t, "POST", "/api/technicians/"+techID+"/toggle-active-status/", map[string]string{"reason": "test"}, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, false, body["isActive"])
	// Login must fail
	loginResp := makeRequest(t, "POST", "/api/technicians/login/", map[string]string{"email": "92200080", "password": "Tech12345"}, "")
	assert.Equal(t, http.StatusForbidden, loginResp.StatusCode)

	// Reactivate
	resp = makeRequest(t, "POST", "/api/technicians/"+techID+"/toggle-active-status/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body2 map[string]interface{}
	decodeBody(t, resp, &body2)
	assert.Equal(t, true, body2["isActive"])
	// Login must now work
	loginResp = makeRequest(t, "POST", "/api/technicians/login/", map[string]string{"email": "92200080", "password": "Tech12345"}, "")
	assert.Equal(t, http.StatusOK, loginResp.StatusCode)
}

func TestTechnicians_ToggleAvailabilityStatus(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "TS Coord", "ts.coord@test.com", "91200090")
	techID, _ := createTechnician(t, "TS Tech", "92200090", "560290", "ts.tech@test.com", coordToken)
	resp := makeRequest(t, "POST", "/api/technicians/"+techID+"/toggle-status/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "2", body["technicianStatus"])
	// Toggle back
	resp = makeRequest(t, "POST", "/api/technicians/"+techID+"/toggle-status/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body2 map[string]interface{}
	decodeBody(t, resp, &body2)
	assert.Equal(t, "1", body2["technicianStatus"])
}
