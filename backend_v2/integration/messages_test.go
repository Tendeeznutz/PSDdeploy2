//go:build integration

package integration

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessages_Create_ExplicitRecipient(t *testing.T) {
	cleanDB(t)
	senderID, senderToken := createCustomer(t, "Msg Sender", "msg.sender@test.com", "93600001", "560601")
	recipID, _ := createCustomer(t, "Msg Recip", "msg.recip@test.com", "93600002", "560602")
	resp := makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": senderID, "senderName": "Msg Sender",
		"recipientType": "customer", "recipientId": recipID, "recipientName": "Msg Recip",
		"subject": "Hello", "body": "Test message body",
	}, senderToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, true, body["success"])
	msgs := body["messages"].([]interface{})
	assert.Len(t, msgs, 1)
}

func TestMessages_Create_CustomerSpecialPath(t *testing.T) {
	cleanDB(t)
	// Create coordinator (the special path auto-sends to first coordinator)
	_, _ = createCoordinator(t, "Msg Coord", "msg.coord@test.com", "91600001")
	custID, custToken := createCustomer(t, "SP Cust", "sp.cust@test.com", "93600010", "560610")
	resp := makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": custID, "senderName": "SP Cust",
		"subject": "Customer enquiry", "body": "Please help",
		// No recipientId/recipientType — uses special path
	}, custToken)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	msgs := body["messages"].([]interface{})
	// Should have at least 1 message (to coordinator)
	assert.GreaterOrEqual(t, len(msgs), 1)
}

func TestMessages_GetInbox(t *testing.T) {
	cleanDB(t)
	senderID, senderToken := createCustomer(t, "Inbox Sender", "inbox.sender@test.com", "93600020", "560620")
	recipID, recipToken := createCustomer(t, "Inbox Recip", "inbox.recip@test.com", "93600021", "560621")
	makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": senderID, "senderName": "Inbox Sender",
		"recipientType": "customer", "recipientId": recipID, "recipientName": "Inbox Recip",
		"subject": "Inbox test", "body": "body",
	}, senderToken)
	resp := makeRequest(t, "GET", "/api/messages/inbox/?recipientId="+recipID+"&recipientType=customer", nil, recipToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.Len(t, body, 1)
	m := body[0].(map[string]interface{})
	assert.Equal(t, recipID, m["recipientId"])
}

func TestMessages_GetSent(t *testing.T) {
	cleanDB(t)
	senderID, senderToken := createCustomer(t, "Sent Sender", "sent.sender@test.com", "93600030", "560630")
	recipID, _ := createCustomer(t, "Sent Recip", "sent.recip@test.com", "93600031", "560631")
	makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": senderID, "senderName": "Sent Sender",
		"recipientType": "customer", "recipientId": recipID, "recipientName": "Sent Recip",
		"subject": "Sent test", "body": "body",
	}, senderToken)
	resp := makeRequest(t, "GET", "/api/messages/sent/?senderId="+senderID+"&senderType=customer", nil, senderToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.Len(t, body, 1)
	m := body[0].(map[string]interface{})
	assert.Equal(t, senderID, m["senderId"])
}

func TestMessages_UserQuery_BothDirections(t *testing.T) {
	cleanDB(t)
	aID, aToken := createCustomer(t, "Bidi A", "bidi.a@test.com", "93600040", "560640")
	bID, bToken := createCustomer(t, "Bidi B", "bidi.b@test.com", "93600041", "560641")
	// A → B
	makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": aID, "senderName": "Bidi A",
		"recipientType": "customer", "recipientId": bID, "recipientName": "Bidi B",
		"subject": "A to B", "body": "body",
	}, aToken)
	// B → A
	makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": bID, "senderName": "Bidi B",
		"recipientType": "customer", "recipientId": aID, "recipientName": "Bidi A",
		"subject": "B to A", "body": "body",
	}, bToken)
	// Query as A (should see both)
	resp := makeRequest(t, "GET", "/api/messages/?userId="+aID+"&userType=customer", nil, aToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	assert.Len(t, body, 2)
}

func TestMessages_MarkRead(t *testing.T) {
	cleanDB(t)
	senderID, senderToken := createCustomer(t, "Mark Sender", "mark.sender@test.com", "93600050", "560650")
	recipID, recipToken := createCustomer(t, "Mark Recip", "mark.recip@test.com", "93600051", "560651")
	createResp := makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
		"senderType": "customer", "senderId": senderID, "senderName": "Mark Sender",
		"recipientType": "customer", "recipientId": recipID, "recipientName": "Mark Recip",
		"subject": "Mark", "body": "body",
	}, senderToken)
	var createBody map[string]interface{}
	decodeBody(t, createResp, &createBody)
	msgID := createBody["messages"].([]interface{})[0].(map[string]interface{})["id"].(string)

	resp := makeRequest(t, "PATCH", "/api/messages/"+msgID+"/mark-read/", nil, recipToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body map[string]interface{}
	decodeBody(t, resp, &body)
	assert.Equal(t, true, body["isRead"])
	assert.NotNil(t, body["readAt"])
}

func TestMessages_UnreadCount_DecrementsAfterMarkRead(t *testing.T) {
	cleanDB(t)
	senderID, senderToken := createCustomer(t, "UC Sender", "uc.sender@test.com", "93600060", "560660")
	recipID, recipToken := createCustomer(t, "UC Recip", "uc.recip@test.com", "93600061", "560661")
	// Send 2 messages
	for i := 0; i < 2; i++ {
		makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
			"senderType": "customer", "senderId": senderID, "senderName": "UC Sender",
			"recipientType": "customer", "recipientId": recipID, "recipientName": "UC Recip",
			"subject": "UC", "body": "body",
		}, senderToken)
	}
	// Check unread = 2
	resp := makeRequest(t, "GET", "/api/messages/unread-count/?recipientId="+recipID+"&recipientType=customer", nil, recipToken)
	var countBody map[string]interface{}
	decodeBody(t, resp, &countBody)
	assert.Equal(t, float64(2), countBody["unreadCount"])

	// Get inbox to find message IDs
	inboxResp := makeRequest(t, "GET", "/api/messages/inbox/?recipientId="+recipID+"&recipientType=customer", nil, recipToken)
	var msgs []interface{}
	decodeBody(t, inboxResp, &msgs)
	msgID := msgs[0].(map[string]interface{})["id"].(string)

	// Mark one read
	makeRequest(t, "PATCH", "/api/messages/"+msgID+"/mark-read/", nil, recipToken)

	// Unread should now be 1
	resp = makeRequest(t, "GET", "/api/messages/unread-count/?recipientId="+recipID+"&recipientType=customer", nil, recipToken)
	var countBody2 map[string]interface{}
	decodeBody(t, resp, &countBody2)
	assert.Equal(t, float64(1), countBody2["unreadCount"])
}

func TestMessages_OrderedNewestFirst(t *testing.T) {
	cleanDB(t)
	senderID, senderToken := createCustomer(t, "Order Sender", "order.sender@test.com", "93600070", "560670")
	recipID, _ := createCustomer(t, "Order Recip", "order.recip@test.com", "93600071", "560671")
	for i := 0; i < 3; i++ {
		makeRequest(t, "POST", "/api/messages/", map[string]interface{}{
			"senderType": "customer", "senderId": senderID, "senderName": "Order Sender",
			"recipientType": "customer", "recipientId": recipID, "recipientName": "Order Recip",
			"subject": "Order " + string(rune('A'+i)), "body": "body",
		}, senderToken)
		time.Sleep(5 * time.Millisecond)
	}
	resp := makeRequest(t, "GET", "/api/messages/sent/?senderId="+senderID+"&senderType=customer", nil, senderToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body []interface{}
	decodeBody(t, resp, &body)
	require.Len(t, body, 3)
	first := body[0].(map[string]interface{})["created_at"].(string)
	last := body[2].(map[string]interface{})["created_at"].(string)
	assert.Greater(t, first, last) // newest first
}
