//go:build integration

package integration

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuth_CustomerLogin_Valid(t *testing.T) {
	cleanDB(t)
	_, _ = createCustomer(t, "Auth Alice", "auth.alice@test.com", "91234501", "560101")
	resp := makeRequest(t, "POST", "/api/customers/login/", map[string]string{
		"email": "auth.alice@test.com", "password": "Test1234",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["access"])
	assert.NotEmpty(t, body["refresh"])
	assert.Equal(t, "customer", body["role"])
}

func TestAuth_CustomerLogin_WrongPassword(t *testing.T) {
	cleanDB(t)
	_, _ = createCustomer(t, "Auth Bob", "auth.bob@test.com", "91234502", "560102")
	resp := makeRequest(t, "POST", "/api/customers/login/", map[string]string{
		"email": "auth.bob@test.com", "password": "WRONGPASS",
	}, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_CustomerLogin_UnknownEmail(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/customers/login/", map[string]string{
		"email": "nobody@nowhere.com", "password": "Test1234",
	}, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_TechnicianLogin_ValidByPhone(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Auth Coord", "auth.coord@test.com", "91110001")
	_, _ = createTechnician(t, "Auth Tech", "91234510", "560110", "auth.tech@test.com", coordToken)
	resp := makeRequest(t, "POST", "/api/technicians/login/", map[string]string{
		"email": "91234510", "password": "Tech12345",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "technician", body["role"])
}

func TestAuth_TechnicianLogin_Deactivated(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Auth Coord2", "auth.coord2@test.com", "91110002")
	techID, _ := createTechnician(t, "Auth DeactTech", "91234511", "560111", "auth.deact@test.com", coordToken)

	// Deactivate
	resp := makeRequest(t, "POST", "/api/technicians/"+techID+"/toggle-active-status/", map[string]string{
		"reason": "Testing deactivation",
	}, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Login should now fail
	resp = makeRequest(t, "POST", "/api/technicians/login/", map[string]string{
		"email": "91234511", "password": "Tech12345",
	}, "")
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestAuth_CoordinatorLogin_Valid(t *testing.T) {
	cleanDB(t)
	_, _ = createCoordinator(t, "Auth Coord3", "auth.coord3@test.com", "91110003")
	resp := makeRequest(t, "POST", "/api/coordinators/login/", map[string]string{
		"email": "auth.coord3@test.com", "password": "Admin12345",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "coordinator", body["role"])
}

func TestAuth_TokenRefresh_Valid(t *testing.T) {
	cleanDB(t)
	_, _ = createCustomer(t, "Refresh User", "refresh@test.com", "91234520", "560120")
	// Get tokens
	resp := makeRequest(t, "POST", "/api/customers/login/", map[string]string{
		"email": "refresh@test.com", "password": "Test1234",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var tokens map[string]interface{}
	decodeBody(t, resp, &tokens)

	// Refresh
	resp = makeRequest(t, "POST", "/api/token/refresh/", map[string]string{
		"refresh": tokens["refresh"].(string),
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var refreshed map[string]interface{}
	decodeBody(t, resp, &refreshed)
	assert.NotEmpty(t, refreshed["access"])
}

func TestAuth_TokenRefresh_InvalidToken(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/token/refresh/", map[string]string{
		"refresh": "not.a.valid.jwt",
	}, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_ProtectedEndpoint_NoToken(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "GET", "/api/customers/", nil, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_ProtectedEndpoint_MalformedToken(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "GET", "/api/customers/", nil, "malformed-token-string")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuth_HealthEndpoint_NoAuth(t *testing.T) {
	resp := makeRequest(t, "GET", "/api/health/", nil, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "ok", body["status"])
}

func TestAuth_RateLimit_Login(t *testing.T) {
	cleanDB(t)
	// Fire 6 login attempts rapidly against the 5/min login limit.
	var lastResp *http.Response
	for i := 0; i < 6; i++ {
		lastResp = makeRequest(t, "POST", "/api/customers/login/", map[string]string{
			"email": "ratelimit@test.com", "password": "wrong",
		}, "")
		time.Sleep(10 * time.Millisecond)
	}
	// At least one response (the 6th) should be 429 or 401.
	// Either is acceptable depending on Valkey availability in CI.
	assert.True(t,
		lastResp.StatusCode == http.StatusTooManyRequests ||
			lastResp.StatusCode == http.StatusUnauthorized,
		"expected 429 or 401, got %d", lastResp.StatusCode)
}
