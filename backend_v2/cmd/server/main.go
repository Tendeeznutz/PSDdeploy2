package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"backend_v2/internal/config"
	migrations "backend_v2/internal/db/migrations"
	"backend_v2/internal/handlers"
	"backend_v2/internal/seeder"
	"backend_v2/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func main() {
	seedFlag := flag.Bool("seed", false, "Seed the database with test data then exit")
	migrateFlag := flag.Bool("migrate", false, "Run SQL migrations then exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()

	// ── PostgreSQL connection (retry 30s) ─────────────────────────────────────
	pool, err := connectDB(ctx, cfg)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	log.Println("db: connected")

	// ── Run migrations (always, idempotent) ───────────────────────────────────
	if err := runMigrations(ctx, pool); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	log.Println("db: migrations applied")

	if *migrateFlag {
		log.Println("--migrate flag: exiting after migrations")
		os.Exit(0)
	}

	// ── Seed if requested ─────────────────────────────────────────────────────
	if *seedFlag || cfg.RunSeed {
		if err := seeder.Seed(ctx, pool); err != nil {
			log.Fatalf("seed: %v", err)
		}
		if *seedFlag {
			log.Println("--seed flag: exiting after seed")
			os.Exit(0)
		}
	}

	// ── Valkey / Redis connection ──────────────────────────────────────────────
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.ValkeyAddr,
		Password: cfg.ValkeyPassword,
	})
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Printf("valkey: could not connect (%v) — rate limiting disabled", err)
	} else {
		log.Println("valkey: connected")
	}
	defer rdb.Close()

	// ── Services ──────────────────────────────────────────────────────────────
	geo := services.NewGeoService(cfg.OneMapEmail, cfg.OneMapPassword)
	notif := services.NewNotificationService(
		cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword,
		cfg.TelegramBotToken, cfg.FrontendURL,
	)

	// ── Fiber app ─────────────────────────────────────────────────────────────
	app := handlers.NewFiberApp(&handlers.App{
		DB:     pool,
		Valkey: rdb,
		Cfg:    cfg,
		Geo:    geo,
		Notif:  notif,
	})

	// ── Start goroutine: appointment reminders every 15 min ───────────────────
	go reminderScheduler(ctx, pool, notif)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server: listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// connectDB retries connecting to Postgres for up to 30 seconds.
func connectDB(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error
	for i := 0; i < 30; i++ {
		pool, err = pgxpool.New(ctx, cfg.DSN())
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				return pool, nil
			}
			pool.Close()
		}
		log.Printf("db: waiting for postgres (%d/30)...", i+1)
		time.Sleep(time.Second)
	}
	return nil, fmt.Errorf("could not connect to postgres after 30s: %w", err)
}

// runMigrations applies all SQL migration files in order (idempotent).
func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrationsData := []struct {
		name string
		sql  string
	}{
		{"001_initial_schema", migrations.Schema001},
		{"002_blockchain", migrations.Schema002},
		{"003_audit_logs", migrations.Schema003},
	}

	// Ensure migrations tracking table exists
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS _migrations (
		    name       TEXT PRIMARY KEY,
		    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		return fmt.Errorf("create _migrations table: %w", err)
	}

	for _, m := range migrationsData {
		var exists bool
		_ = pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM _migrations WHERE name=$1)`, m.name).Scan(&exists)
		if exists {
			continue
		}
		if _, err := pool.Exec(ctx, m.sql); err != nil {
			return fmt.Errorf("migration %s: %w", m.name, err)
		}
		_, _ = pool.Exec(ctx, `INSERT INTO _migrations (name) VALUES ($1)`, m.name)
		log.Printf("db: applied migration %s", m.name)
	}
	return nil
}

// reminderScheduler sends appointment reminders every 15 minutes.
func reminderScheduler(ctx context.Context, pool *pgxpool.Pool, notif *services.NotificationService) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sendReminders(ctx, pool, notif)
		}
	}
}

func sendReminders(ctx context.Context, pool *pgxpool.Pool, notif *services.NotificationService) {
	now := time.Now().Unix()
	in24h := now + 86400
	in1h := now + 3600

	rows, err := pool.Query(ctx,
		`SELECT a.id, a."appointmentStartTime", c."customerEmail", c."customerName", c."telegramChatId"
		 FROM appointments a
		 JOIN customers c ON c.id = a."customerId"
		 WHERE a."appointmentStatus" IN ('1','2')
		   AND (a."appointmentStartTime" BETWEEN $1 AND $2 OR a."appointmentStartTime" BETWEEN $3 AND $4)`,
		now, in24h, now, in1h)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var startTime int64
		var email, name string
		var chatID *int64
		if err := rows.Scan(&id, &startTime, &email, &name, &chatID); err != nil {
			continue
		}
		msg := fmt.Sprintf("Reminder: Your AirServe appointment is at %s.",
			time.Unix(startTime, 0).UTC().Format("02 Jan 2006 3:04 PM"))
		_ = notif.SendEmail(email, "Appointment Reminder", msg)
		if chatID != nil {
			_ = notif.SendTelegram(*chatID, "⏰ "+msg)
		}
	}
}
