//go:build integration

package integration

import (
	"bytes"
	"fmt"
	"net/http"
	"testing"

	"backend_v2/integration/testdata"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func hiringFields(overrides map[string]string) map[string]string {
	base := map[string]string{
		"applicationSource":     "self_applied",
		"applicantName":         "John Tech",
		"nric":                  "S1234567A",
		"citizenship":           "Singaporean",
		"applicantAddress":      "123 Tech Street",
		"applicantPostalCode":   "560700",
		"applicantPhone":        "81234567",
		"applicantEmail":        "john.tech@test.com",
		"workExperience":        "10 years in AC repair",
		"race":                  "Chinese",
		"languagesSpoken":       "English",
		"nextOfKinName":         "Jane Tech",
		"nextOfKinContact":      "81234568",
		"nextOfKinRelationship": "Sister",
	}
	for k, v := range overrides {
		base[k] = v
	}
	return base
}

func TestHiring_Stage1_Submit_WithFiles(t *testing.T) {
	cleanDB(t)
	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalJPEG,
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	resp := makeMultipartRequest(t, "/api/hiring-applications/", hiringFields(nil), files, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.NotEmpty(t, body["id"])
	assert.Equal(t, "personal_details", body["applicationStatus"])
}

func TestHiring_Stage1_MissingNRICFront(t *testing.T) {
	cleanDB(t)
	files := map[string][]byte{
		// nricPhotoFront intentionally missing
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	resp := makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "S7654321B"}), files, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestHiring_Stage1_InvalidNRIC(t *testing.T) {
	cleanDB(t)
	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalJPEG,
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	resp := makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "INVALID"}), files, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestHiring_Stage1_DuplicateNRIC(t *testing.T) {
	cleanDB(t)
	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalJPEG,
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	// First submit
	resp := makeMultipartRequest(t, "/api/hiring-applications/", hiringFields(nil), files, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	// Duplicate
	resp = makeMultipartRequest(t, "/api/hiring-applications/", hiringFields(nil), files, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestHiring_Stage1_FileTooLarge(t *testing.T) {
	cleanDB(t)
	// Build a 5MB+1 byte file
	bigFile := bytes.Repeat(testdata.MinimalJPEG, (5*1024*1024/len(testdata.MinimalJPEG))+1)
	files := map[string][]byte{
		"nricPhotoFront": bigFile,
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	resp := makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "S2222222B"}), files, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestHiring_Stage2_ConfirmAndBankInfo(t *testing.T) {
	cleanDB(t)
	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalJPEG,
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	// Stage 1
	createResp := makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "S3333333C"}), files, "")
	require.Equal(t, http.StatusCreated, createResp.StatusCode)
	var created map[string]interface{}
	decodeBody(t, createResp, &created)
	appID := created["id"].(string)

	// Confirm personal details
	confirmResp := makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/confirm-personal-details/", appID), nil, "")
	require.Equal(t, http.StatusOK, confirmResp.StatusCode)
	var confirmed map[string]interface{}
	decodeBody(t, confirmResp, &confirmed)
	assert.Equal(t, "bank_info", confirmed["applicationStatus"])

	// Submit bank info
	bankResp := makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/submit-bank-info/", appID),
		map[string]string{
			"bankName": "DBS", "bankAccountNumber": "123-456-789", "bankAccountHolderName": "John Tech",
		}, "")
	require.Equal(t, http.StatusOK, bankResp.StatusCode)
	var banked map[string]interface{}
	decodeBody(t, bankResp, &banked)
	assert.Equal(t, "coordinator_review", banked["applicationStatus"])
}

func TestHiring_Stage3_CoordinatorApprove(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Hire Coord", "hire.coord@test.com", "91700001")
	coordID := ""
	{
		resp := makeRequest(t, "GET", "/api/coordinators/", nil, coordToken)
		var list []interface{}
		decodeBody(t, resp, &list)
		coordID = list[0].(map[string]interface{})["id"].(string)
	}

	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalPNG,
		"nricPhotoBack":  testdata.MinimalPNG,
		"drivingLicense": testdata.MinimalPNG,
	}
	cr := makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "S4444444D", "applicantPhone": "81234599"}), files, "")
	require.Equal(t, http.StatusCreated, cr.StatusCode)
	var created map[string]interface{}
	decodeBody(t, cr, &created)
	appID := created["id"].(string)

	// Move through stages
	makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/confirm-personal-details/", appID), nil, "")
	makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/submit-bank-info/", appID),
		map[string]string{"bankName": "OCBC", "bankAccountNumber": "999", "bankAccountHolderName": "John Tech"}, "")

	// Approve
	approveResp := makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/coordinator-approve/", appID),
		map[string]interface{}{
			"coordinatorId": coordID, "payRate": 25.0, "coordinatorNotes": "Excellent candidate",
		}, coordToken)
	require.Equal(t, http.StatusOK, approveResp.StatusCode)
	var approved map[string]interface{}
	decodeBody(t, approveResp, &approved)
	assert.Equal(t, "approved", approved["applicationStatus"])
	assert.NotEmpty(t, approved["technicianId"])
	assert.NotEmpty(t, approved["temporaryPassword"])
}

func TestHiring_Stage3_CoordinatorReject(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Reject Coord", "reject.coord@test.com", "91700010")
	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalJPEG,
		"nricPhotoBack":  testdata.MinimalJPEG,
		"drivingLicense": testdata.MinimalJPEG,
	}
	cr := makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "S5555555E", "applicantPhone": "81200099"}), files, "")
	require.Equal(t, http.StatusCreated, cr.StatusCode)
	var created map[string]interface{}
	decodeBody(t, cr, &created)
	appID := created["id"].(string)
	makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/confirm-personal-details/", appID), nil, "")
	makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/submit-bank-info/", appID),
		map[string]string{"bankName": "UOB", "bankAccountNumber": "000", "bankAccountHolderName": "J"}, "")

	rejectResp := makeRequest(t, "POST", fmt.Sprintf("/api/hiring-applications/%s/coordinator-reject/", appID),
		map[string]interface{}{"coordinatorId": "", "coordinatorNotes": "Not suitable"}, coordToken)
	require.Equal(t, http.StatusOK, rejectResp.StatusCode)
	var rejected map[string]interface{}
	decodeBody(t, rejectResp, &rejected)
	assert.Equal(t, "rejected", rejected["applicationStatus"])
	assert.Nil(t, rejected["technicianId"])
}

func TestHiring_List_FilterByStatus(t *testing.T) {
	cleanDB(t)
	_, coordToken := createCoordinator(t, "Filter Coord", "filter.coord@test.com", "91700020")
	files := map[string][]byte{
		"nricPhotoFront": testdata.MinimalJPEG, "nricPhotoBack": testdata.MinimalJPEG, "drivingLicense": testdata.MinimalJPEG,
	}
	makeMultipartRequest(t, "/api/hiring-applications/",
		hiringFields(map[string]string{"nric": "S6666666F", "applicantPhone": "81200088"}), files, "")
	resp := makeRequest(t, "GET", "/api/hiring-applications/?applicationStatus=personal_details", nil, coordToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	assert.GreaterOrEqual(t, len(body), 1)
}
