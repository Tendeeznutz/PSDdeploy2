package middleware

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditLogger writes one audit_log row for every mutating request.
//
// It runs AFTER the handler (via c.Next()) so it can capture the response body
// for resource-ID extraction.  The DB write is fire-and-forget in a goroutine
// using context.Background() — the request context is already done by the time
// the goroutine executes.
func AuditLogger(pool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		method := c.Method()
		if method != "POST" && method != "PATCH" && method != "DELETE" {
			return c.Next()
		}

		// Run the actual handler first.
		handlerErr := c.Next()

		// Extract actor from JWT locals (populated by JWTProtected middleware).
		actorType, _ := c.Locals("role").(string)
		actorIDStr, _ := c.Locals("userID").(string)
		var actorIDPtr *uuid.UUID
		if actorIDStr != "" {
			if id, err := uuid.Parse(actorIDStr); err == nil {
				actorIDPtr = &id
			}
		}

		// Force heap copies of all strings derived from fasthttp's zero-copy
		// buffers BEFORE launching the goroutine.  fasthttp reuses its internal
		// connection buffers for the next request immediately after the handler
		// returns; any zero-copy string that still points into those buffers
		// will have stale (or garbage) content by the time the goroutine reads it.
		resourceType := strings.Clone(extractResourceType(c.Path()))
		methodCopy := strings.Clone(method)
		ipAddr := strings.Clone(c.IP())

		// Best-effort: parse the response body synchronously (still within the
		// request lifecycle) and marshal into a fresh byte slice owned by Go's heap.
		var resourceIDPtr *uuid.UUID
		var afterJSON []byte
		{
			respBody := c.Response().Body()
			// Take a snapshot so we don't hold a reference to fasthttp's buffer.
			bodySnap := make([]byte, len(respBody))
			copy(bodySnap, respBody)
			var respMap map[string]interface{}
			if json.Unmarshal(bodySnap, &respMap) == nil {
				if idStr, ok := respMap["id"].(string); ok {
					if id, err := uuid.Parse(idStr); err == nil {
						resourceIDPtr = &id
					}
				}
				afterJSON, _ = json.Marshal(respMap)
			}
		}

		// All captured values are now heap-owned Go values — safe to close over.
		go func() {
			_, _ = pool.Exec(context.Background(),
				`INSERT INTO audit_logs
				 (actor_type, actor_id, action, resource_type, resource_id, after_json, ip_address)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				nilStrIfEmpty(actorType),
				actorIDPtr,
				methodCopy,
				resourceType,
				resourceIDPtr,
				json.RawMessage(afterJSON),
				ipAddr,
			)
		}()

		return handlerErr
	}
}

func extractResourceType(path string) string {
	for _, segment := range splitPath(path) {
		switch segment {
		case "appointments", "customers", "technicians", "coordinators",
			"customeraircondevices", "messages", "hiring-applications",
			"technician-availability", "aircon-catalogs":
			return segment
		}
	}
	return "unknown"
}

func splitPath(path string) []string {
	var parts []string
	cur := ""
	for _, ch := range path {
		if ch == '/' {
			if cur != "" {
				parts = append(parts, cur)
				cur = ""
			}
		} else {
			cur += string(ch)
		}
	}
	if cur != "" {
		parts = append(parts, cur)
	}
	return parts
}

func nilStrIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
