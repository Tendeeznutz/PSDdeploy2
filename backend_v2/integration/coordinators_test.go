//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCoordinators_Create(t *testing.T) {
	cleanDB(t)
	resp := makeRequest(t, "POST", "/api/coordinators/", map[string]string{
		"coordinatorName": "New Coord", "coordinatorEmail": "new.coord@test.com",
		"coordinatorPhone": "91300001", "coordinatorPassword": "Admin12345",
	}, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["id"])
}

func TestCoordinators_Login_Valid(t *testing.T) {
	cleanDB(t)
	_, _ = createCoordinator(t, "Login Coord", "login.coord@test.com", "91300010")
	resp := makeRequest(t, "POST", "/api/coordinators/login/", map[string]string{
		"email": "login.coord@test.com", "password": "Admin12345",
	}, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "coordinator", body["role"])
	assert.NotEmpty(t, body["access"])
}

func TestCoordinators_GetByID(t *testing.T) {
	cleanDB(t)
	id, token := createCoordinator(t, "Get Coord", "get.coord@test.com", "91300020")
	resp := makeRequest(t, "GET", "/api/coordinators/"+id+"/", nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "Get Coord", body["coordinatorName"])
}

func TestCoordinators_Patch_UpdateName(t *testing.T) {
	cleanDB(t)
	id, token := createCoordinator(t, "Patch Coord", "patch.coord@test.com", "91300030")
	resp := makeRequest(t, "PATCH", "/api/coordinators/"+id+"/", map[string]string{
		"coordinatorName": "Patched Coord",
	}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "Patched Coord", body["coordinatorName"])
}

func TestCoordinators_Delete(t *testing.T) {
	cleanDB(t)
	id, token := createCoordinator(t, "Del Coord", "del.coord@test.com", "91300040")
	resp := makeRequest(t, "DELETE", "/api/coordinators/"+id+"/", nil, token)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
}

func TestCoordinators_GetDeleted_NotFound(t *testing.T) {
	cleanDB(t)
	_, token := createCoordinator(t, "Other Coord", "other.coord@test.com", "91300050")
	resp := makeRequest(t, "GET", "/api/coordinators/00000000-0000-0000-0000-000000000000/", nil, token)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
