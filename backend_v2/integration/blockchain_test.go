//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// waitForBlockchainBlock retries until the expected number of blocks exist.
// Blockchain appends happen in background goroutines, so we poll briefly.
// waitForBlock polls the DB until expectedCount blocks exist for the appointment.
// The blockchain append runs in a background goroutine so we need real sleeps.
func waitForBlock(t *testing.T, apptID string, expectedCount int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		var count int
		_ = testPool.QueryRow(context.Background(),
			`SELECT COUNT(*) FROM blockchain_service_records WHERE appointment_id=$1`, apptID).Scan(&count)
		if count >= expectedCount {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Logf("waitForBlock: timed out waiting for %d blocks on appointment %s", expectedCount, apptID)
}

func TestBlockchain_CreateAppointment_GenesisBlock(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "BC Alice", "bc.alice@test.com", "93001001", "560001")
	devID := createDevice(t, custID, "BC AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)

	// Wait for the background goroutine to write the genesis block
	waitForBlock(t, apptID, 1)

	var blockIndex int64
	var prevHash string
	err := testPool.QueryRow(context.Background(),
		`SELECT block_index, previous_hash FROM blockchain_service_records
		  WHERE appointment_id=$1 ORDER BY block_index LIMIT 1`, apptID).
		Scan(&blockIndex, &prevHash)
	require.NoError(t, err)
	assert.Equal(t, int64(0), blockIndex)
	assert.Equal(t, "0000000000000000000000000000000000000000000000000000000000000000", prevHash)
}

func TestBlockchain_UpdateAppointment_AppendsBlock(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "BC Coord", "bc.coord@test.com", "91001001")
	_, _ = createTechnician(t, "BC Tech", "92001001", "560001", "bc.tech@test.com", coordToken)
	custID, custToken := createCustomer(t, "BC Bob", "bc.bob@test.com", "93001002", "560001")
	devID := createDevice(t, custID, "BC AC2", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	waitForBlock(t, apptID, 1)

	// Complete the appointment (triggers a blockchain block)
	makeRequest(t, "PATCH", "/api/appointments/"+apptID+"/", map[string]interface{}{
		"appointmentStatus": "3",
	}, coordToken)
	waitForBlock(t, apptID, 2)

	var count int
	_ = testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM blockchain_service_records WHERE appointment_id=$1`, apptID).Scan(&count)
	assert.GreaterOrEqual(t, count, 2)
}

func TestBlockchain_VerifyChain_Untampered(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "VV Alice", "vv.alice@test.com", "93001010", "560010")
	devID := createDevice(t, custID, "VV AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	waitForBlock(t, apptID, 1)

	resp := makeRequest(t, "GET", "/api/blockchain/verify/"+apptID+"/", nil, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, true, body["valid"])
	assert.GreaterOrEqual(t, body["blocks"].(float64), float64(1))
}

func TestBlockchain_VerifyChain_TamperedBlock(t *testing.T) {
	cleanDB(t)
	custID, custToken := createCustomer(t, "Tamp Alice", "tamp.alice@test.com", "93001020", "560020")
	devID := createDevice(t, custID, "Tamp AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	waitForBlock(t, apptID, 1)

	// Tamper with the block's data (direct SQL — only allowed in tests)
	_, err := testPool.Exec(context.Background(),
		`UPDATE blockchain_service_records SET data_json='{"tampered":true}'
		  WHERE appointment_id=$1`, apptID)
	require.NoError(t, err)

	resp := makeRequest(t, "GET", "/api/blockchain/verify/"+apptID+"/", nil, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, false, body["valid"])
	assert.NotNil(t, body["tampered_at_block"])
}

func TestBlockchain_History_EventOrder(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Hist Coord", "hist.coord@test.com", "91001010")
	custID, custToken := createCustomer(t, "Hist Alice", "hist.alice@test.com", "93001030", "560030")
	devID := createDevice(t, custID, "Hist AC", custToken)
	apptID := createAppointment(t, custID, devID, futureUnix(5), custToken)
	waitForBlock(t, apptID, 1)

	// Cancel to add a second block
	makeRequest(t, "PATCH", "/api/appointments/"+apptID+"/", map[string]interface{}{
		"appointmentStatus": "4", "cancellationReason": "Test cancel",
	}, coordToken)
	waitForBlock(t, apptID, 2)

	resp := makeRequest(t, "GET", "/api/blockchain/history/"+apptID+"/", nil, custToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var blocks []interface{}
	decodeBody(t, resp, &blocks)
	require.GreaterOrEqual(t, len(blocks), 1)
	first := blocks[0].(map[string]interface{})
	assert.Equal(t, "created", first["event_type"])
}

func TestBlockchain_ConcurrentAppends_NoDataRace(t *testing.T) {
	// Verifies that two simultaneous appointments don't corrupt each other's chain.
	cleanDB(t)
	c1ID, c1Token := createCustomer(t, "Conc1", "conc1@test.com", "93001040", "560040")
	c2ID, c2Token := createCustomer(t, "Conc2", "conc2@test.com", "93001041", "560041")
	d1 := createDevice(t, c1ID, "C1 AC", c1Token)
	d2 := createDevice(t, c2ID, "C2 AC", c2Token)

	appt1 := createAppointment(t, c1ID, d1, futureUnix(3), c1Token)
	appt2 := createAppointment(t, c2ID, d2, futureUnix(4), c2Token)

	waitForBlock(t, appt1, 1)
	waitForBlock(t, appt2, 1)

	// Both chains should be valid independently
	for _, apptID := range []string{appt1, appt2} {
		resp := makeRequest(t, "GET", "/api/blockchain/verify/"+apptID+"/", nil, c1Token)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var body map[string]interface{}
		decodeBody(t, resp, &body)
		assert.Equal(t, true, body["valid"], "chain invalid for appointment "+apptID)
	}
}
