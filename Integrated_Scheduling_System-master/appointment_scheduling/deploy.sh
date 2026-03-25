#!/bin/bash
# =============================================================
# AirServe — VPS Deployment Script
# Server: ay2526-tp-j.coding36.net
# Usage:  ./deploy.sh [backend|frontend|both|pull]
#   pull     — git pull only (no restart)
#   backend  — pull + migrate + restart Gunicorn
#   frontend — pull + rebuild React + copy to public_html
#   both     — all of the above (default)
# =============================================================

set -e  # Exit on any error

REPO_DIR=~/psd_airserve
APP_DIR="$REPO_DIR/Integrated_Scheduling_System-master/appointment_scheduling"
FRONTEND_DIR="$APP_DIR/frontend"
VENV_DIR="$APP_DIR/.venv"
PUBLIC_HTML=~/public_html
GUNICORN_BIND="0.0.0.0:8000"
GUNICORN_WORKERS=3

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No color

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Git Pull ─────────────────────────────────────────────────
do_pull() {
    info "Pulling latest from origin/server-push..."
    cd "$REPO_DIR"
    git pull origin server-push
    info "Pull complete."
}

# ── Backend ──────────────────────────────────────────────────
do_backend() {
    info "Activating virtual environment..."
    cd "$APP_DIR"
    source "$VENV_DIR/bin/activate"

    info "Installing Python dependencies..."
    pip install -q -r requirements.txt

    info "Running database migrations..."
    python manage.py migrate

    info "Collecting static files..."
    python manage.py collectstatic --noinput 2>/dev/null || true

    info "Stopping existing Gunicorn (port 8000)..."
    kill $(lsof -t -i:8000) 2>/dev/null || warn "No existing process on port 8000"
    sleep 1

    info "Starting Gunicorn ($GUNICORN_WORKERS workers)..."
    nohup gunicorn \
        --bind "$GUNICORN_BIND" \
        --workers "$GUNICORN_WORKERS" \
        --timeout 120 \
        --access-logfile - \
        --error-logfile - \
        appointment_scheduling.wsgi:application \
        > /tmp/gunicorn.log 2>&1 &

    sleep 2
    if lsof -i:8000 > /dev/null 2>&1; then
        info "Gunicorn is running on $GUNICORN_BIND"
    else
        error "Gunicorn failed to start! Check /tmp/gunicorn.log"
    fi
}

# ── Frontend ─────────────────────────────────────────────────
do_frontend() {
    info "Building React frontend..."
    cd "$FRONTEND_DIR"
    npm run build

    info "Deploying build to $PUBLIC_HTML..."
    cp -r build/* "$PUBLIC_HTML/"

    info "Frontend deployed."
}

# ── Main ─────────────────────────────────────────────────────
MODE="${1:-both}"

echo ""
echo "========================================="
echo "  AirServe Deployment — mode: $MODE"
echo "========================================="
echo ""

case "$MODE" in
    pull)
        do_pull
        ;;
    backend)
        do_pull
        do_backend
        ;;
    frontend)
        do_pull
        do_frontend
        ;;
    both)
        do_pull
        do_backend
        do_frontend
        ;;
    *)
        echo "Usage: $0 [pull|backend|frontend|both]"
        exit 1
        ;;
esac

echo ""
info "Deployment complete!"
echo ""
