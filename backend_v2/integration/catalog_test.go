//go:build integration

package integration

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCatalog_CreateSingle(t *testing.T) {
	cleanDB(t)
	_, token := createCoordinator(t, "Cat Coord", "cat.coord@test.com", "91900001")
	resp := makeRequest(t, "POST", "/api/aircon-catalogs/", map[string]string{
		"airconBrand": "Daikin", "airconModel": "System 4",
	}, token)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, "Daikin", body["airconBrand"])
}

func TestCatalog_Create_Duplicate(t *testing.T) {
	cleanDB(t)
	_, token := createCoordinator(t, "CatD Coord", "catd.coord@test.com", "91900010")
	makeRequest(t, "POST", "/api/aircon-catalogs/", map[string]string{
		"airconBrand": "Panasonic", "airconModel": "CS-Z Series",
	}, token)
	resp := makeRequest(t, "POST", "/api/aircon-catalogs/", map[string]string{
		"airconBrand": "Panasonic", "airconModel": "CS-Z Series",
	}, token)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCatalog_BulkCSV_Valid(t *testing.T) {
	cleanDB(t)
	_, token := createCoordinator(t, "CSV Coord", "csv.coord@test.com", "91900020")

	csvData := "airconBrand,airconModel\nMitsubishi,Starmex\nMitsubishi,Kirigamine\nLG,ArtCool\n"
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("csvFile", "catalog.csv")
	_, _ = fw.Write([]byte(csvData))
	_ = mw.Close()

	req := httptest.NewRequest("POST", "/api/aircon-catalogs/bulkCreate/", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := testApp.Test(req, 30000)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, float64(3), body["count"])
}

func TestCatalog_BulkCSV_Malformed(t *testing.T) {
	cleanDB(t)
	_, token := createCoordinator(t, "Mal Coord", "mal.coord@test.com", "91900030")

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("csvFile", "bad.csv")
	_, _ = fw.Write([]byte("not,a,valid,csv\nrow\n"))
	_ = mw.Close()

	req := httptest.NewRequest("POST", "/api/aircon-catalogs/bulkCreate/", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := testApp.Test(req, 30000)
	// Returns 201 with 0 entries (header row parsed, data rows skipped)
	// OR 400 if completely malformed. Either is acceptable.
	assert.True(t, resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusBadRequest)
}

func TestCatalog_FilterByBrand(t *testing.T) {
	cleanDB(t)
	_, token := createCoordinator(t, "Filt Coord", "filt.coord@test.com", "91900040")
	makeRequest(t, "POST", "/api/aircon-catalogs/", map[string]string{"airconBrand": "Samsung", "airconModel": "WindFree"}, token)
	makeRequest(t, "POST", "/api/aircon-catalogs/", map[string]string{"airconBrand": "Samsung", "airconModel": "Boracay"}, token)
	makeRequest(t, "POST", "/api/aircon-catalogs/", map[string]string{"airconBrand": "Daikin", "airconModel": "System 1"}, token)
	resp := makeRequest(t, "GET", "/api/aircon-catalogs/?airconBrand=Samsung", nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	assert.Len(t, body, 2)
	for _, item := range body {
		m := item.(map[string]interface{})
		assert.Equal(t, "Samsung", m["airconBrand"])
	}
}
