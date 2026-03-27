// Package handlers wires all Fiber routes and returns the app instance.
package handlers

import (
	"backend_v2/internal/config"
	"backend_v2/internal/middleware"
	"backend_v2/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// GeoLookup is satisfied by both *services.GeoService (production) and
// the in-process stub used in integration tests.
type GeoLookup interface {
	LookupPostal(postalCode string) string
}

// App holds shared dependencies injected into all handlers.
type App struct {
	DB     *pgxpool.Pool
	Valkey *redis.Client
	Cfg    *config.Config
	Geo    GeoLookup
	Notif  *services.NotificationService
}

// NewFiberApp constructs and returns the Fiber application with all routes registered.
func NewFiberApp(a *App) *fiber.App {
	app := fiber.New(fiber.Config{
		// 10 MB — matches Django's DATA_UPLOAD_MAX_MEMORY_SIZE and covers the
		// hiring-application multipart forms with NRIC/driving-licence images.
		BodyLimit: 10 * 1024 * 1024,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"detail": err.Error()})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(middleware.AuditLogger(a.DB))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PATCH, DELETE, OPTIONS",
		AllowCredentials: false,
	}))

	api := app.Group("/api")

	// ── Public ──────────────────────────────────────────────────────────────
	api.Get("/health/", healthHandler)

	loginRL := middleware.RateLimit(a.Valkey, middleware.TierLogin, 60)
	anonRL := middleware.RateLimit(a.Valkey, middleware.TierAnon, 60)
	userRL := middleware.RateLimit(a.Valkey, middleware.TierUser, 60)
	jwtAuth := middleware.JWTProtected(a.Cfg.JWTSecret)

	// ── Auth ─────────────────────────────────────────────────────────────────
	api.Post("/token/refresh/", refreshTokenHandler(a))

	// ── Customers ────────────────────────────────────────────────────────────
	c := api.Group("/customers")
	c.Post("/login/", loginRL, customerLoginHandler(a))
	c.Post("/", anonRL, createCustomerHandler(a))
	c.Get("/", jwtAuth, userRL, listCustomersHandler(a))
	c.Get("/:id/", jwtAuth, userRL, getCustomerHandler(a))
	c.Patch("/:id/", jwtAuth, userRL, updateCustomerHandler(a))
	c.Post("/:id/coordinator-reset-password/", jwtAuth, userRL, coordinatorResetCustomerPasswordHandler(a))

	// ── Technicians ──────────────────────────────────────────────────────────
	t := api.Group("/technicians")
	t.Post("/login/", loginRL, technicianLoginHandler(a))
	t.Post("/forgot-password/", anonRL, forgotPasswordHandler(a))
	t.Get("/validate-reset-token/", anonRL, validateResetTokenHandler(a))
	t.Post("/reset-password/", anonRL, resetPasswordHandler(a))
	t.Post("/", jwtAuth, userRL, createTechnicianHandler(a))
	t.Get("/", jwtAuth, userRL, listTechniciansHandler(a))
	t.Get("/:id/", jwtAuth, userRL, getTechnicianHandler(a))
	t.Patch("/:id/", jwtAuth, userRL, updateTechnicianHandler(a))
	t.Post("/:id/toggle-active-status/", jwtAuth, userRL, toggleActiveStatusHandler(a))
	t.Post("/:id/toggle-status/", jwtAuth, userRL, toggleStatusHandler(a))
	t.Post("/:id/coordinator-reset-password/", jwtAuth, userRL, coordinatorResetTechnicianPasswordHandler(a))

	// ── Coordinators ─────────────────────────────────────────────────────────
	co := api.Group("/coordinators")
	co.Post("/login/", loginRL, coordinatorLoginHandler(a))
	co.Post("/", anonRL, createCoordinatorHandler(a))
	co.Get("/", jwtAuth, userRL, listCoordinatorsHandler(a))
	co.Get("/:id/", jwtAuth, userRL, getCoordinatorHandler(a))
	co.Patch("/:id/", jwtAuth, userRL, updateCoordinatorHandler(a))
	co.Delete("/:id/", jwtAuth, userRL, deleteCoordinatorHandler(a))

	// ── Appointments ─────────────────────────────────────────────────────────
	ap := api.Group("/appointments")
	ap.Get("/penalty-status/", jwtAuth, userRL, penaltyStatusHandler(a))
	ap.Get("/unavailable/", jwtAuth, userRL, unavailableTimeslotsHandler(a))
	ap.Post("/guest-booking/", anonRL, guestBookingHandler(a))
	ap.Post("/sendEnquiry/", jwtAuth, userRL, sendEnquiryHandler(a))
	ap.Get("/", jwtAuth, userRL, listAppointmentsHandler(a))
	ap.Post("/", jwtAuth, userRL, createAppointmentHandler(a))
	ap.Get("/:id/", jwtAuth, userRL, getAppointmentHandler(a))
	ap.Patch("/:id/", jwtAuth, userRL, updateAppointmentHandler(a))
	ap.Delete("/:id/", jwtAuth, userRL, deleteAppointmentHandler(a))
	ap.Post("/:id/rate-technician/", jwtAuth, userRL, rateTechnicianHandler(a))
	ap.Post("/:id/rate-customer/", jwtAuth, userRL, rateCustomerHandler(a))

	// ── Customer Aircon Devices ───────────────────────────────────────────────
	d := api.Group("/customeraircondevices")
	d.Get("/", jwtAuth, userRL, listDevicesHandler(a))
	d.Post("/", jwtAuth, userRL, createDeviceHandler(a))
	d.Get("/:id/", jwtAuth, userRL, getDeviceHandler(a))
	d.Patch("/:id/", jwtAuth, userRL, updateDeviceHandler(a))
	d.Delete("/:id/", jwtAuth, userRL, deleteDeviceHandler(a))

	// ── Messages ─────────────────────────────────────────────────────────────
	m := api.Group("/messages")
	m.Get("/inbox/", jwtAuth, userRL, inboxHandler(a))
	m.Get("/sent/", jwtAuth, userRL, sentHandler(a))
	m.Get("/unread-count/", jwtAuth, userRL, unreadCountHandler(a))
	m.Get("/", jwtAuth, userRL, listMessagesHandler(a))
	m.Post("/", jwtAuth, userRL, createMessageHandler(a))
	m.Patch("/:id/mark-read/", jwtAuth, userRL, markReadHandler(a))

	// ── Hiring Applications ───────────────────────────────────────────────────
	h := api.Group("/hiring-applications")
	h.Get("/", jwtAuth, userRL, listHiringApplicationsHandler(a))
	h.Post("/", anonRL, createHiringApplicationHandler(a))
	h.Get("/:id/", jwtAuth, userRL, getHiringApplicationHandler(a))
	h.Post("/:id/confirm-personal-details/", anonRL, confirmPersonalDetailsHandler(a))
	h.Post("/:id/submit-bank-info/", anonRL, submitBankInfoHandler(a))
	h.Post("/:id/coordinator-approve/", jwtAuth, userRL, coordinatorApproveHandler(a))
	h.Post("/:id/coordinator-reject/", jwtAuth, userRL, coordinatorRejectHandler(a))

	// ── Technician Availability ───────────────────────────────────────────────
	av := api.Group("/technician-availability")
	av.Get("/available-slots/", jwtAuth, userRL, availableSlotsHandler(a))
	av.Get("/working-days/", jwtAuth, userRL, workingDaysHandler(a))
	av.Post("/bulk-create/", jwtAuth, userRL, bulkCreateAvailabilityHandler(a))
	av.Get("/", jwtAuth, userRL, listAvailabilityHandler(a))
	av.Post("/", jwtAuth, userRL, createAvailabilityHandler(a))
	av.Get("/:id/", jwtAuth, userRL, getAvailabilityHandler(a))
	av.Patch("/:id/", jwtAuth, userRL, updateAvailabilityHandler(a))
	av.Delete("/:id/", jwtAuth, userRL, deleteAvailabilityHandler(a))

	// ── Aircon Catalogs ───────────────────────────────────────────────────────
	ac := api.Group("/aircon-catalogs")
	ac.Get("/", jwtAuth, userRL, listCatalogHandler(a))
	ac.Post("/", jwtAuth, userRL, createCatalogHandler(a))
	ac.Post("/bulkCreate/", jwtAuth, userRL, bulkCreateCatalogHandler(a))

	// ── Telegram ─────────────────────────────────────────────────────────────
	tg := api.Group("/telegram")
	tg.Post("/webhook/", telegramWebhookHandler(a))
	tg.Post("/generate-link/", jwtAuth, userRL, generateTelegramLinkHandler(a))
	tg.Get("/status/", jwtAuth, userRL, telegramStatusHandler(a))
	tg.Post("/unlink/", jwtAuth, userRL, telegramUnlinkHandler(a))

	// ── Novel features ────────────────────────────────────────────────────────
	api.Get("/leaderboard/", jwtAuth, userRL, leaderboardHandler(a))
	api.Get("/aircon-health-check/", anonRL, airconHealthCheckHandler)

	// Blockchain (read-only endpoints, any authenticated user)
	api.Get("/blockchain/verify/:appointment_id/", jwtAuth, userRL, blockchainVerifyHandler(a))
	api.Get("/blockchain/history/:appointment_id/", jwtAuth, userRL, blockchainHistoryHandler(a))

	return app
}

func healthHandler(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok"})
}
