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

func TestAirconHealth_OldService_HighProbability(t *testing.T) {
	// No auth required on this endpoint
	resp := makeRequest(t, "GET", "/api/aircon-health-check/?lastServiceDate=2020-01&units=1", nil, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	prob := body["probability_of_breakdown"].(float64)
	assert.Greater(t, prob, float64(90), "expected probability > 90 for 5-year-old service")
	assert.NotEmpty(t, body["verdict"])
	assert.NotEmpty(t, body["recommendation"])
	assert.NotEmpty(t, body["fun_fact"])
	assert.NotEmpty(t, body["disclaimer"])
}

func TestAirconHealth_RecentService_LowProbability(t *testing.T) {
	lastMonth := time.Now().AddDate(0, -1, 0).Format("2006-01")
	resp := makeRequest(t, "GET", fmt.Sprintf("/api/aircon-health-check/?lastServiceDate=%s&units=1", lastMonth), nil, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	prob := body["probability_of_breakdown"].(float64)
	assert.Less(t, prob, float64(20), "expected probability < 20 for recent service")
}

func TestAirconHealth_MissingLastServiceDate(t *testing.T) {
	resp := makeRequest(t, "GET", "/api/aircon-health-check/?units=1", nil, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAirconHealth_InvalidDateFormat(t *testing.T) {
	resp := makeRequest(t, "GET", "/api/aircon-health-check/?lastServiceDate=not-a-date&units=1", nil, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAirconHealth_ZeroUnits(t *testing.T) {
	resp := makeRequest(t, "GET", "/api/aircon-health-check/?lastServiceDate=2022-01&units=0", nil, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
