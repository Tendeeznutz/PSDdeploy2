#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$REPO_DIR/.env"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_HEALTH_URL="http://localhost:${BACKEND_PORT}/api/health/"
HEALTHCHECK_ATTEMPTS=30
HEALTHCHECK_SLEEP_SECONDS=3

generate_secret() {
    python3 -c "import secrets; print(secrets.token_urlsafe($1))" 2>/dev/null || openssl rand -base64 "$1"
}

show_unhealthy_logs() {
    local has_unhealthy=0
    local container_id
    local service_name
    local status

    while IFS= read -r container_id; do
        [ -n "$container_id" ] || continue

        service_name="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$container_id" 2>/dev/null || true)"
        status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

        case "$status" in
            healthy|running)
                ;;
            *)
                has_unhealthy=1
                echo "[WARN] Service ${service_name:-unknown} status: ${status:-unknown}"
                ;;
        esac
    done < <(docker compose ps -q)

    if [ "$has_unhealthy" -eq 1 ]; then
        echo ""
        echo "[WARN] Showing last 20 log lines for troubleshooting..."
        docker compose logs --tail=20
    fi

    return "$has_unhealthy"
}

echo "==========================================="
echo "  AirServe Docker Deployment"
echo "==========================================="

echo ""
echo "[INFO] Stopping any existing process on port ${BACKEND_PORT}..."
if command -v lsof >/dev/null 2>&1; then
    if lsof -t -i:"${BACKEND_PORT}" >/dev/null 2>&1; then
        kill "$(lsof -t -i:"${BACKEND_PORT}")" 2>/dev/null || true
    fi
fi

if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "[INFO] Creating .env from template..."

    SECRET_KEY="$(generate_secret 50)"
    PG_PASS="$(generate_secret 24)"
    MINIO_PASS="$(generate_secret 24)"

    cat > "$ENV_FILE" <<ENVEOF
# ================================================================
# AirServe Docker Stack — Generated $(date +%Y-%m-%d)
# ================================================================

# ── Docker / Infrastructure ──────────────────────────────────
POSTGRES_USER=airserve
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=airserve_db

MINIO_ROOT_USER=airserve
MINIO_ROOT_PASSWORD=$MINIO_PASS
MINIO_BUCKET=airserve-media
# MINIO_ACCESS_KEY=         # Optional: create a scoped MinIO service account for the app
# MINIO_SECRET_KEY=         # Optional: create a scoped MinIO service account for the app

BACKEND_PORT=8000
DOMAIN=ay2526-tp-j.coding36.net
GHCR_REPO=tendeeznutz/airserve-backend
GHCR_REPO_FRONTEND=tendeeznutz/airserve-frontend

# ── Django Core ──────────────────────────────────────────────
SECRET_KEY=$SECRET_KEY
DEBUG=False

ALLOWED_HOSTS=ay2526-tp-j.coding36.net,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://ay2526-tp-j.coding36.net
FRONTEND_BASE_URL=https://ay2526-tp-j.coding36.net

# ── Email (Gmail SMTP) ──────────────────────────────────────
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# ── OneMap API ───────────────────────────────────────────────
ONEMAP_API_KEY=
ONEMAP_EMAIL=
ONEMAP_PASSWORD=

# ── Telegram Bot (optional) ─────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=

# ── Scheduling Algorithm ─────────────────────────────────────
WALK_SEARCH_RANGE=1000
WALK_INCREMENT=500
DRIVE_SEARCH_RANGE=5000
DRIVE_INCREMENT=2500
CYCLE_SEARCH_RANGE=3000
CYCLE_INCREMENT=1500

# ── Seed Control ─────────────────────────────────────────────
RUN_SEED=false
ENVEOF

    echo "[INFO] .env created with auto-generated secrets."
    echo "[WARN] Review .env before production use, especially email, OneMap, Telegram, and optional scoped MinIO credentials."
else
    echo "[INFO] .env already exists, skipping creation."
fi

echo ""
echo "[INFO] Building Docker images..."
cd "$REPO_DIR"
docker compose build --pull

echo ""
echo "[INFO] Starting containers..."
docker compose up -d

echo ""
echo "[INFO] Waiting for backend to become healthy..."
backend_healthy=0
for i in $(seq 1 "$HEALTHCHECK_ATTEMPTS"); do
    if curl -fsS "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
        backend_healthy=1
        echo "[OK] Backend is healthy."
        break
    fi

    echo "[INFO] Waiting... (${i}/${HEALTHCHECK_ATTEMPTS})"
    sleep "$HEALTHCHECK_SLEEP_SECONDS"
done

echo ""
echo "[INFO] Container status:"
docker compose ps

if [ "$backend_healthy" -ne 1 ]; then
    echo ""
    echo "[ERROR] Backend failed to become healthy at ${BACKEND_HEALTH_URL}"
    show_unhealthy_logs || true
    exit 1
fi

show_unhealthy_logs || true

echo ""
echo "==========================================="
echo "  Deployment complete!"
echo "  Backend:       http://localhost:${BACKEND_PORT}"
echo "  MinIO Console: http://localhost:9001 (SSH tunnel only)"
echo "  Logs:          docker compose logs -f backend"
echo "==========================================="
