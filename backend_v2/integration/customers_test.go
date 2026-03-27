//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCustomers_Register_Valid(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/customers/", map[string]string{
		"customerName": "Reg Alice", "customerEmail": "reg.alice@test.com",
		"customerPhone": "93000001", "customerPassword": "Test1234",
		"customerAddress": "1 Register Road", "customerPostalCode": "560001",
	}, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["id"])
}

func TestCustomers_Register_DuplicateEmail(t *testing.T) {
	cleanDB(t)
	_, _ = createCustomer(t, "Alice Dup", "dup.alice@test.com", "93000010", "560010")
	resp := makeRequest(t, "POST", "/api/customers/", map[string]string{
		"customerName": "Alice2", "customerEmail": "dup.alice@test.com",
		"customerPhone": "93000011", "customerPassword": "Test1234",
		"customerAddress": "1 Dup Road", "customerPostalCode": "560011",
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCustomers_Register_DuplicatePhone(t *testing.T) {
	cleanDB(t)
	_, _ = createCustomer(t, "Phone Dup", "phonedup@test.com", "93000020", "560020")
	resp := makeRequest(t, "POST", "/api/customers/", map[string]string{
		"customerName": "Phone2", "customerEmail": "other@test.com",
		"customerPhone": "93000020", "customerPassword": "Test1234",
		"customerAddress": "1 Phone Road", "customerPostalCode": "560021",
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCustomers_Register_InvalidPostal(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/customers/", map[string]string{
		"customerName": "Bad Postal", "customerEmail": "bad.postal@test.com",
		"customerPhone": "93000030", "customerPassword": "Test1234",
		"customerAddress": "1 Bad Road", "customerPostalCode": "12345", // 5 digits
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCustomers_Register_InvalidPhone(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/customers/", map[string]string{
		"customerName": "Bad Phone", "customerEmail": "bad.phone@test.com",
		"customerPhone":    "9300040", // 7 digits
		"customerPassword": "Test1234",
		"customerAddress":  "1 Phone Road", "customerPostalCode": "560040",
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCustomers_GetByID(t *testing.T) {
	cleanDB(t)
	id, token := createCustomer(t, "Get Alice", "get.alice@test.com", "93000050", "560050")
	resp := makeRequest(t, "GET", "/api/customers/"+id+"/", nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "get.alice@test.com", body["customerEmail"])
	// Password must never appear in response
	_, hasPassword := body["customerPassword"]
	assert.False(t, hasPassword, "customerPassword must not be in response")
}

func TestCustomers_GetByID_NotFound(t *testing.T) {
	cleanDB(t)
	_, token := createCustomer(t, "NF Alice", "nf.alice@test.com", "93000060", "560060")
	resp := makeRequest(t, "GET", "/api/customers/00000000-0000-0000-0000-000000000000/", nil, token)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestCustomers_FilterByEmail(t *testing.T) {
	cleanDB(t)
	_, token := createCustomer(t, "Filter Alice", "filter.alice@test.com", "93000070", "560070")
	_, _ = createCustomer(t, "Filter Bob", "filter.bob@test.com", "93000071", "560071")
	resp := makeRequest(t, "GET", "/api/customers/?customerEmail=filter.alice@test.com", nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	assert.Len(t, body, 1)
}

func TestCustomers_Patch_UpdateName(t *testing.T) {
	cleanDB(t)
	id, token := createCustomer(t, "Patch Alice", "patch.alice@test.com", "93000080", "560080")
	resp := makeRequest(t, "PATCH", "/api/customers/"+id+"/", map[string]string{
		"customerName": "Patched Alice",
	}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "Patched Alice", body["customerName"])
}

func TestCustomers_Patch_UpdatePostalUpdatesLocation(t *testing.T) {
	cleanDB(t)
	id, token := createCustomer(t, "Loc Alice", "loc.alice@test.com", "93000090", "560090")
	resp := makeRequest(t, "PATCH", "/api/customers/"+id+"/", map[string]string{
		"customerPostalCode": "178957",
	}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	// Geo stub returns "1.3521,103.8198" for any postal — location should be set
	assert.NotEmpty(t, body["customerLocation"])
}

func TestCustomers_CoordinatorResetPassword(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Reset Coord", "reset.coord@test.com", "91120001")
	custID, _ := createCustomer(t, "Reset Alice", "reset.alice@test.com", "93000100", "560100")
	resp := makeRequest(t, "POST", "/api/customers/"+custID+"/coordinator-reset-password/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Login with default password should now work
	resp = makeRequest(t, "POST", "/api/customers/login/", map[string]string{
		"email": "reset.alice@test.com", "password": "password123",
	}, "")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
