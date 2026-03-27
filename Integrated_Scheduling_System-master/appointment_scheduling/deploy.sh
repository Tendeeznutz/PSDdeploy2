#!/bin/bash
# =============================================================
# AirServe — VPS Deployment Script (Usermin / No Docker)
# Server: ay2526-tp-j.coding36.net
# Usage:  ./deploy.sh [backend|frontend|both|pull|status|stop]
#   pull     — git pull only (no restart)
#   backend  — pull + migrate + restart Gunicorn
#   frontend — pull + build + restart Next.js
#   both     — all of the above (default)
#   status   — show running processes
#   stop     — stop both Gunicorn and Next.js
# =============================================================

set -e  # Exit on any error

# ── Paths ──────────────────────────────────────────────────────
REPO_DIR=~/psd_airserve
APP_DIR="$REPO_DIR/Integrated_Scheduling_System-master/appointment_scheduling"
FRONTEND_DIR="$REPO_DIR/customer-frontend2"
VENV_DIR="$APP_DIR/.venv"
LOG_DIR=~/logs

# ── Config ─────────────────────────────────────────────────────
GUNICORN_BIND="127.0.0.1:8000"
GUNICORN_WORKERS=2
GUNICORN_THREADS=2
NEXT_PORT=3000

# ── Pidfiles ───────────────────────────────────────────────────
GUNICORN_PID="$APP_DIR/gunicorn.pid"
NEXT_PID="$FRONTEND_DIR/next.pid"

# ── Colors ─────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Ensure log directory exists ────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Helper: kill process by pidfile or pattern ─────────────────
stop_process() {
    local name="$1"
    local pidfile="$2"
    local pattern="$3"

    # Try pidfile first
    if [ -f "$pidfile" ]; then
        local pid
        pid=$(cat "$pidfile" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            sleep 1
            # Force kill if still alive
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
            info "$name stopped (PID $pid)"
        fi
        rm -f "$pidfile"
    fi

    # Fallback: kill by pattern
    if [ -n "$pattern" ]; then
        pkill -f "$pattern" 2>/dev/null || true
    fi
}

# ── Git Pull ───────────────────────────────────────────────────
do_pull() {
    local branch
    branch=$(cd "$REPO_DIR" && git rev-parse --abbrev-ref HEAD)
    info "Pulling latest from origin/$branch..."
    cd "$REPO_DIR"
    git pull origin "$branch" || {
        warn "Normal pull failed (history may have been rewritten). Force-resetting..."
        git fetch origin "$branch"
        git reset --hard "origin/$branch"
    }
    info "Pull complete."
}

# ── Backend ────────────────────────────────────────────────────
do_backend() {
    info "=== Backend Deployment ==="
    cd "$APP_DIR"

    # Activate venv
    if [ ! -d "$VENV_DIR" ]; then
        info "Creating virtual environment..."
        python3 -m venv "$VENV_DIR"
    fi
    source "$VENV_DIR/bin/activate"

    # Install deps
    info "Installing Python dependencies..."
    pip install -q -r requirements.txt 2>&1 | tail -3

    # Check .env exists
    if [ ! -f "$APP_DIR/.env" ]; then
        error ".env file missing! Create it first (see .env.example)"
    fi

    # Migrate
    info "Running database migrations..."
    python manage.py migrate 2>&1 | grep -E "^(  Applying|No migrations)" || true

    # Static files
    info "Collecting static files..."
    python manage.py collectstatic --noinput 2>/dev/null | tail -1

    # Stop existing gunicorn
    info "Stopping existing Gunicorn..."
    stop_process "Gunicorn" "$GUNICORN_PID" "gunicorn.*appointment_scheduling"
    sleep 1

    # Start gunicorn
    info "Starting Gunicorn ($GUNICORN_WORKERS workers, $GUNICORN_THREADS threads)..."
    nohup "$VENV_DIR/bin/gunicorn" \
        --bind "$GUNICORN_BIND" \
        --workers "$GUNICORN_WORKERS" \
        --threads "$GUNICORN_THREADS" \
        --timeout 120 \
        --pid "$GUNICORN_PID" \
        --access-logfile "$LOG_DIR/gunicorn-access.log" \
        --error-logfile "$LOG_DIR/gunicorn-error.log" \
        appointment_scheduling.wsgi:application \
        > /dev/null 2>&1 &

    # Verify
    sleep 2
    if curl -sf "http://127.0.0.1:8000/api/health/" > /dev/null 2>&1; then
        info "Gunicorn is running on $GUNICORN_BIND"
    else
        error "Gunicorn failed to start! Check $LOG_DIR/gunicorn-error.log"
    fi
}

# ── Frontend ───────────────────────────────────────────────────
do_frontend() {
    info "=== Frontend Deployment ==="
    cd "$FRONTEND_DIR"

    # Check Node.js
    if ! command -v node &>/dev/null; then
        error "Node.js is not installed. Ask your server admin to install it."
    fi
    info "Node.js $(node -v) found"

    # Install deps
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
        info "Installing npm dependencies..."
        npm install --production=false 2>&1 | tail -3
    else
        info "npm dependencies up to date."
    fi

    # Build Next.js
    info "Building Next.js (this may take a minute)..."
    NEXT_PUBLIC_API_URL="https://ay2526-tp-j.coding36.net/api" \
        npm run build 2>&1 | tail -5

    # Stop existing Next.js
    info "Stopping existing Next.js server..."
    stop_process "Next.js" "$NEXT_PID" "next-server.*$NEXT_PORT"

    # Start Next.js in production mode
    info "Starting Next.js on port $NEXT_PORT..."
    nohup npx next start -p "$NEXT_PORT" \
        > "$LOG_DIR/nextjs.log" 2>&1 &
    echo $! > "$NEXT_PID"

    # Verify
    sleep 3
    if curl -sf "http://127.0.0.1:$NEXT_PORT/" > /dev/null 2>&1; then
        info "Next.js is running on port $NEXT_PORT"
    else
        warn "Next.js may still be starting. Check $LOG_DIR/nextjs.log"
    fi
}

# ── Status ─────────────────────────────────────────────────────
do_status() {
    echo ""
    echo "=== AirServe Process Status ==="
    echo ""

    # Gunicorn
    if [ -f "$GUNICORN_PID" ] && kill -0 "$(cat "$GUNICORN_PID")" 2>/dev/null; then
        info "Gunicorn:  RUNNING (PID $(cat "$GUNICORN_PID")) on $GUNICORN_BIND"
    else
        warn "Gunicorn:  NOT RUNNING"
    fi

    # Next.js
    if [ -f "$NEXT_PID" ] && kill -0 "$(cat "$NEXT_PID")" 2>/dev/null; then
        info "Next.js:   RUNNING (PID $(cat "$NEXT_PID")) on port $NEXT_PORT"
    else
        warn "Next.js:   NOT RUNNING"
    fi

    # Health check
    echo ""
    if curl -sf "http://127.0.0.1:8000/api/health/" > /dev/null 2>&1; then
        info "Backend health: OK"
    else
        warn "Backend health: UNREACHABLE"
    fi

    if curl -sf "http://127.0.0.1:$NEXT_PORT/" > /dev/null 2>&1; then
        info "Frontend health: OK"
    else
        warn "Frontend health: UNREACHABLE"
    fi
    echo ""
}

# ── Stop ───────────────────────────────────────────────────────
do_stop() {
    info "Stopping all AirServe processes..."
    stop_process "Gunicorn" "$GUNICORN_PID" "gunicorn.*appointment_scheduling"
    stop_process "Next.js" "$NEXT_PID" "next-server"
    info "All processes stopped."
}

# ── Main ───────────────────────────────────────────────────────
MODE="${1:-both}"

echo ""
echo "==========================================="
echo "  AirServe Deployment — mode: $MODE"
echo "==========================================="
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
    status)
        do_status
        ;;
    stop)
        do_stop
        ;;
    *)
        echo "Usage: $0 [pull|backend|frontend|both|status|stop]"
        exit 1
        ;;
esac

echo ""
info "Done! Logs are in $LOG_DIR/"
echo "  - Gunicorn: $LOG_DIR/gunicorn-access.log, $LOG_DIR/gunicorn-error.log"
echo "  - Next.js:  $LOG_DIR/nextjs.log"
echo ""
