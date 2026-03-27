#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$REPO_DIR/.env"

echo "==========================================="
echo "  AirServe Docker Deployment"
echo "==========================================="

# ── Step 1: Kill any existing Gunicorn on port 8000 ──
echo ""
echo "[INFO] Stopping any existing process on port 8000..."
if command -v lsof &>/dev/null; then
    kill "$(lsof -t -i:${BACKEND_PORT:-8000})" 2>/dev/null || true
fi

# ── Step 2: Create .env if it doesn't exist ──
if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "[INFO] Creating .env from template..."

    # Generate secrets
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))" 2>/dev/null || openssl rand -base64 50)
    PG_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))" 2>/dev/null || openssl rand -base64 24)
    MINIO_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))" 2>/dev/null || openssl rand -base64 24)

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

BACKEND_PORT=8000
GHCR_REPO=Tendeeznutz/airserve-backend

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
    echo "[WARN] Edit .env to fill in EMAIL, ONEMAP, and TELEGRAM values if needed."
    echo ""
else
    echo "[INFO] .env already exists, skipping creation."
fi

# ── Step 3: Build and start ──
echo ""
echo "[INFO] Building Docker images..."
cd "$REPO_DIR"
docker compose build

echo ""
echo "[INFO] Starting containers..."
docker compose up -d

# ── Step 4: Wait and verify ──
echo ""
echo "[INFO] Waiting for backend to become healthy..."
for i in $(seq 1 30); do
    if curl -sf "http://localhost:${BACKEND_PORT:-8000}/api/health/" > /dev/null 2>&1; then
        echo "[OK] Backend is healthy!"
        break
    fi
    echo "[INFO] Waiting... ($i/30)"
    sleep 3
done

echo ""
echo "[INFO] Container status:"
docker compose ps

echo ""
echo "==========================================="
echo "  Deployment complete!"
echo "  Backend:       http://localhost:8000"
echo "  MinIO Console: http://localhost:9001 (SSH tunnel only)"
echo "  Logs:          docker compose logs -f backend"
echo "==========================================="
