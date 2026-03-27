package middleware

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// tokenExpiry returns a time.Time offset by the given number of minutes.
func tokenExpiry(minutes int) time.Time {
	return time.Now().Add(time.Duration(minutes) * time.Minute)
}

// Claims is the JWT payload shape — mirrors Django SimpleJWT's USER_ID_CLAIM.
type Claims struct {
	UserID   string `json:"user_id"`
	Role     string `json:"role"`     // customer | technician | coordinator
	UserName string `json:"username"` // display name
	jwt.RegisteredClaims
}

// JWTProtected returns a Fiber middleware that validates Bearer tokens.
func JWTProtected(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"detail": "Authentication credentials were not provided.",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"detail": "Authorization header must be: Bearer <token>",
			})
		}

		tokenStr := parts[1]
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.ErrUnauthorized
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"detail": "Token is invalid or expired.",
			})
		}

		c.Locals("userID", claims.UserID)
		c.Locals("role", claims.Role)
		c.Locals("userName", claims.UserName)
		return c.Next()
	}
}

// IssueTokenPair generates an access + refresh JWT pair.
func IssueTokenPair(secret, userID, role, userName string) (access, refresh string, err error) {
	accessClaims := Claims{
		UserID:   userID,
		Role:     role,
		UserName: userName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(tokenExpiry(30)),
			ID:        uuid.New().String(),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	access, err = accessToken.SignedString([]byte(secret))
	if err != nil {
		return
	}

	refreshClaims := Claims{
		UserID:   userID,
		Role:     role,
		UserName: userName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(tokenExpiry(60 * 24)),
			ID:        uuid.New().String(),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refresh, err = refreshToken.SignedString([]byte(secret))
	return
}

// ParseClaims parses a token string without a Fiber context (used in token refresh).
func ParseClaims(tokenStr, secret string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, fiber.ErrUnauthorized
	}
	return claims, nil
}
