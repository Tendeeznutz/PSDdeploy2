//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLeaderboard_ReturnsRankedList(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "LB Coord", "lb.coord@test.com", "91002001")
	createTechnician(t, "LB Tech1", "92002001", "560001", "lb.tech1@test.com", coordToken)
	createTechnician(t, "LB Tech2", "92002002", "560002", "lb.tech2@test.com", coordToken)

	resp := makeRequest(t, "GET", "/api/leaderboard/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	assert.GreaterOrEqual(t, len(body), 2)

	// Ranks must be sequential starting from 1
	for i, item := range body {
		m := item.(map[string]interface{})
		assert.Equal(t, float64(i+1), m["rank"])
	}
}

func TestLeaderboard_RookieBadge_ZeroJobs(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Rook Coord", "rook.coord@test.com", "91002010")
	createTechnician(t, "Rook Tech", "92002010", "560010", "rook.tech@test.com", coordToken)

	resp := makeRequest(t, "GET", "/api/leaderboard/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.Len(t, body, 1)
	m := body[0].(map[string]interface{})
	badges := m["badges"].([]interface{})
	found := false
	for _, b := range badges {
		badge := b.(map[string]interface{})
		if badge["key"] == "rookie" {
			found = true
		}
	}
	assert.True(t, found, "expected Rookie badge for technician with 0 jobs")
}

func TestLeaderboard_ColdKingBadge_100Jobs(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "CK Coord", "ck.coord@test.com", "91002020")
	techID, _ := createTechnician(t, "CK Tech", "92002020", "560020", "ck.tech@test.com", coordToken)

	// Directly inject 100 completed appointments to trigger Cold King badge
	custID, _ := createCustomer(t, "CK Cust", "ck.cust@test.com", "93002020", "560020")
	// Insert 100 completed appointments using generate_series — no PL/pgSQL needed.
	_, err := testPool.Exec(context.Background(), `
		INSERT INTO appointments
			("customerId","technicianId","appointmentStartTime","appointmentEndTime","airconToService","appointmentStatus","paymentMethod")
		SELECT $1, $2,
		       EXTRACT(EPOCH FROM NOW())::BIGINT + gs*3600,
		       EXTRACT(EPOCH FROM NOW())::BIGINT + gs*3600 + 3600,
		       '[]'::jsonb, '3', 'cash'
		FROM generate_series(1, 100) AS gs
	`, custID, techID)
	require.NoError(t, err, "inject 100 appointments")

	resp := makeRequest(t, "GET", "/api/leaderboard/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.GreaterOrEqual(t, len(body), 1)
	m := body[0].(map[string]interface{})
	badges := m["badges"].([]interface{})
	found := false
	for _, b := range badges {
		badge := b.(map[string]interface{})
		if badge["key"] == "cold_king" {
			found = true
		}
	}
	assert.True(t, found, "expected Cold King badge for technician with 100 completed jobs")
}

func TestLeaderboard_ResponseShape(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Shape Coord", "shape.coord@test.com", "91002030")
	createTechnician(t, "Shape Tech", "92002030", "560030", "shape.tech@test.com", coordToken)

	resp := makeRequest(t, "GET", "/api/leaderboard/", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.Len(t, body, 1)
	m := body[0].(map[string]interface{})
	assert.Contains(t, m, "score")
	assert.Contains(t, m, "rank")
	assert.Contains(t, m, "badges")
	assert.Contains(t, m, "technicianName")
	assert.Contains(t, m, "completedJobs")
}
