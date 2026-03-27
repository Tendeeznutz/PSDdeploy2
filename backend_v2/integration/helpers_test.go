//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// makeRequest sends a JSON request through the Fiber test transport.
func makeRequest(t *testing.T, method, path string, body interface{}, token string) *http.Response {
	t.Helper()
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		reqBody = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := testApp.Test(req, 30000)
	require.NoError(t, err)
	return resp
}

// decodeBody decodes JSON response body into v and closes the body.
func decodeBody(t *testing.T, resp *http.Response, v interface{}) {
	t.Helper()
	defer resp.Body.Close()
	require.NoError(t, json.NewDecoder(resp.Body).Decode(v))
}

// bodyString reads the full response body as a string.
func bodyString(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return string(b)
}

// ─── Login helpers ────────────────────────────────────────────────────────────

func loginCustomer(t *testing.T, email, password string) string {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/customers/login/", map[string]string{
		"email": email, "password": password,
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode, "loginCustomer: unexpected status for "+email)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	token, ok := body["access"].(string)
	require.True(t, ok, "loginCustomer: access token missing")
	return token
}

func loginTechnician(t *testing.T, phone, password string) string {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/technicians/login/", map[string]string{
		"email": phone, "password": password,
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode, "loginTechnician: unexpected status for "+phone)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	token, ok := body["access"].(string)
	require.True(t, ok, "loginTechnician: access token missing")
	return token
}

func loginCoordinator(t *testing.T, email, password string) string {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/coordinators/login/", map[string]string{
		"email": email, "password": password,
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode, "loginCoordinator: unexpected status for "+email)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	token, ok := body["access"].(string)
	require.True(t, ok, "loginCoordinator: access token missing")
	return token
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

func createCustomer(t *testing.T, name, email, phone, postal string) (id, token string) {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/customers/", map[string]string{
		"customerName": name, "customerEmail": email, "customerPhone": phone,
		"customerPassword": "Test1234", "customerAddress": "123 Test Street",
		"customerPostalCode": postal,
	}, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode, "createCustomer: "+email)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	id = body["id"].(string)
	token = loginCustomer(t, email, "Test1234")
	return
}

func createTechnician(t *testing.T, name, phone, postal, email, coordToken string) (id, token string) {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/technicians/", map[string]interface{}{
		"technicianName": name, "technicianPhone": phone, "technicianEmail": email,
		"technicianPassword": "Tech12345", "technicianPostalCode": postal,
		"technicianAddress": "1 Tech Road", "technicianStatus": "1",
		"technicianTravelType": "own_vehicle",
	}, coordToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "createTechnician: "+name)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	id = body["id"].(string)

	// Pre-seed location directly in DB so scheduling geo-math works without OneMap.
	_, err := testPool.Exec(context.Background(),
		`UPDATE technicians SET "technicianLocation"='1.3521,103.8198' WHERE id=$1`, id)
	require.NoError(t, err)

	// Seed a 5-day weekly availability schedule.
	seedAvailability(t, id, coordToken)

	token = loginTechnician(t, phone, "Tech12345")
	return
}

func createCoordinator(t *testing.T, name, email, phone string) (id, token string) {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/coordinators/", map[string]string{
		"coordinatorName": name, "coordinatorEmail": email,
		"coordinatorPhone": phone, "coordinatorPassword": "Admin12345",
	}, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode, "createCoordinator: "+email)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	id = body["id"].(string)
	token = loginCoordinator(t, email, "Admin12345")
	return
}

func createDevice(t *testing.T, customerID, airconName, token string) string {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/customeraircondevices/", map[string]interface{}{
		"customerId": customerID, "airconName": airconName,
		"numberOfUnits": 1, "airconType": "daikin",
	}, token)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "createDevice: "+airconName)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	return body["id"].(string)
}

func createAppointment(t *testing.T, customerID, deviceID string, startUnix int64, token string) string {
	t.Helper()
	resp := makeRequest(t, "POST", "/api/appointments/", map[string]interface{}{
		"customerId": customerID, "appointmentStartTime": startUnix,
		"airconToService": []string{deviceID}, "paymentMethod": "cash",
	}, token)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "createAppointment")
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	return body["id"].(string)
}

func seedAvailability(t *testing.T, technicianID, coordToken string) {
	t.Helper()
	days := []string{"monday", "tuesday", "wednesday", "thursday", "friday"}
	schedules := make([]map[string]string, len(days))
	for i, d := range days {
		schedules[i] = map[string]string{"dayOfWeek": d, "startTime": "08:00", "endTime": "18:00"}
	}
	resp := makeRequest(t, "POST", "/api/technician-availability/bulk-create/", map[string]interface{}{
		"technicianId": technicianID, "schedules": schedules,
	}, coordToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "seedAvailability")
}

// futureUnix returns a Unix timestamp N days from now.
func futureUnix(days int) int64 {
	return time.Now().Add(time.Duration(days) * 24 * time.Hour).Unix()
}

// jsonField extracts a string field from a decoded JSON map.
func jsonField(t *testing.T, m map[string]interface{}, key string) string {
	t.Helper()
	v, ok := m[key]
	require.True(t, ok, fmt.Sprintf("expected field %q in response", key))
	s, ok := v.(string)
	require.True(t, ok, fmt.Sprintf("field %q is not a string: %T", key, v))
	return s
}

// makeMultipartRequest builds a multipart/form-data POST request.
func makeMultipartRequest(t *testing.T, path string, fields map[string]string, files map[string][]byte, token string) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	for k, v := range fields {
		fw, err := mw.CreateFormField(k)
		require.NoError(t, err)
		_, _ = fw.Write([]byte(v))
	}
	for k, data := range files {
		fw, err := mw.CreateFormFile(k, k+".jpg")
		require.NoError(t, err)
		_, _ = fw.Write(data)
	}
	require.NoError(t, mw.Close())

	req := httptest.NewRequest("POST", path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := testApp.Test(req, 30000)
	require.NoError(t, err)
	return resp
}

// containsString checks if a slice of interface{} contains a value matching s.
func containsString(slice []interface{}, s string) bool {
	for _, v := range slice {
		if str, ok := v.(string); ok && strings.Contains(str, s) {
			return true
		}
	}
	return false
}
