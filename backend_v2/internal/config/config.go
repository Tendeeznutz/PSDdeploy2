package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string

	// PostgreSQL
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// Valkey / Redis
	ValkeyAddr     string
	ValkeyPassword string

	// JWT
	JWTSecret string

	// MinIO / S3
	MinIOEndpoint  string
	MinIOAccessKey string
	MinIOSecretKey string
	MinioBucket    string
	MinIOUseSSL    bool

	// OneMap
	OneMapEmail    string
	OneMapPassword string

	// Geo search ranges (metres)
	WalkSearchRange  int
	DriveSearchRange int

	// SMTP
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string

	// Telegram
	TelegramBotToken      string
	TelegramBotUsername   string
	TelegramWebhookSecret string

	// App
	Debug       bool
	FrontendURL string
	RunSeed     bool
}

func Load() (*Config, error) {
	// Load .env file if present (silently ignored if missing in containers)
	_ = godotenv.Load()

	c := &Config{
		Port:                  getEnv("PORT", "8000"),
		DBHost:                getEnv("POSTGRES_HOST", getEnv("DB_HOST", "localhost")),
		DBPort:                getEnv("POSTGRES_PORT", getEnv("DB_PORT", "5432")),
		DBUser:                getEnv("POSTGRES_USER", getEnv("DB_USER", "airserve")),
		DBPassword:            getEnv("POSTGRES_PASSWORD", getEnv("DB_PASSWORD", "")),
		DBName:                getEnv("POSTGRES_DB", getEnv("DB_NAME", "airserve_db")),
		ValkeyAddr:            getEnv("VALKEY_ADDR", "localhost:6379"),
		ValkeyPassword:        getEnv("VALKEY_PASSWORD", ""),
		JWTSecret:             getEnv("JWT_SECRET", "change-me-in-production"),
		MinIOEndpoint:         getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinIOAccessKey:        getEnv("MINIO_ROOT_USER", ""),
		MinIOSecretKey:        getEnv("MINIO_ROOT_PASSWORD", ""),
		MinioBucket:           getEnv("MINIO_BUCKET", "airserve-media"),
		MinIOUseSSL:           getEnvBool("MINIO_USE_SSL", false),
		OneMapEmail:           getEnv("ONEMAP_API_EMAIL", ""),
		OneMapPassword:        getEnv("ONEMAP_API_PASSWORD", ""),
		WalkSearchRange:       getEnvInt("WALK_SEARCH_RANGE", 1000),
		DriveSearchRange:      getEnvInt("DRIVE_SEARCH_RANGE", 5000),
		SMTPHost:              getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:              getEnvInt("SMTP_PORT", 587),
		SMTPUser:              getEnv("SMTP_USER", ""),
		SMTPPassword:          getEnv("SMTP_PASSWORD", ""),
		TelegramBotToken:      getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramBotUsername:   getEnv("TELEGRAM_BOT_USERNAME", ""),
		TelegramWebhookSecret: getEnv("TELEGRAM_WEBHOOK_SECRET", ""),
		Debug:                 getEnvBool("DEBUG", false),
		FrontendURL:           getEnv("FRONTEND_BASE_URL", "http://localhost:3000"),
		RunSeed:               getEnvBool("RUN_SEED", false),
	}
	return c, nil
}

// DSN builds a pgx-compatible connection string.
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return i
}
