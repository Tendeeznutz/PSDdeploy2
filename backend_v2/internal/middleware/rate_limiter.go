package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// RateLimiter tiers
const (
	TierAnon  = "anon"
	TierUser  = "user"
	TierLogin = "login"
)

var tierLimits = map[string]int{
	TierAnon:  30,
	TierUser:  120,
	TierLogin: 5,
}

// RateLimit returns a Fiber middleware that enforces a sliding-window rate limit
// backed by Valkey.  windowSecs is typically 60 (1 minute).
func RateLimit(rdb *redis.Client, tier string, windowSecs int) fiber.Handler {
	limit, ok := tierLimits[tier]
	if !ok {
		limit = 30
	}
	window := time.Duration(windowSecs) * time.Second

	return func(c *fiber.Ctx) error {
		// Build key: prefer user_id from JWT (already parsed by JWTProtected if present)
		var key string
		if uid, ok := c.Locals("userID").(string); ok && uid != "" && tier == TierUser {
			key = fmt.Sprintf("rl:%s:%s", tier, uid)
		} else {
			key = fmt.Sprintf("rl:%s:%s", tier, c.IP())
		}

		ctx := context.Background()
		pipe := rdb.Pipeline()
		incr := pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, window)
		_, err := pipe.Exec(ctx)
		if err != nil {
			// Fail open — don't block requests if Valkey is temporarily unavailable.
			return c.Next()
		}

		count := incr.Val()
		if count > int64(limit) {
			c.Set("Retry-After", fmt.Sprintf("%d", windowSecs))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"detail":      "Too many requests. Please slow down.",
				"retry_after": windowSecs,
			})
		}
		return c.Next()
	}
}
