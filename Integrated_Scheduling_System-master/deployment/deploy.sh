#!/bin/bash
# ==============================================================
# AirServe Deployment Script
# Server: ay2526-tp-j.coding36.net
# ==============================================================
# Run this script on the remote server to deploy the application.
#
# FIRST TIME SETUP:
#   chmod +x deploy.sh
#   ./deploy.sh --first-run
#
# SUBSEQUENT DEPLOYMENTS:
#   ./deploy.sh
# ==============================================================

set -e  # Exit on any error

# --- Configuration ---
APP_DIR="$HOME/app"
PROJECT_DIR="$APP_DIR/appointment_scheduling"
REPO_URL="https://github.com/drpeteryau/ay2526-tp-j.git"
BRANCH="server-push"
DOMAIN="ay2526-tp-j.coding36.net"

echo "=============================================="
echo "  AirServe Deployment Script"
echo "  Target: $DOMAIN"
echo "=============================================="

# --- First Run Setup ---
if [ "$1" == "--first-run" ]; then
    echo ""
    echo "[1/8] First-time setup: Installing system dependencies..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git nodejs npm

    echo ""
    echo "[2/8] Cloning repository..."
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    if [ -d ".git" ]; then
        echo "  Repository already exists, pulling latest..."
        git pull origin "$BRANCH"
    else
        git clone -b "$BRANCH" "$REPO_URL" .
    fi

    echo ""
    echo "[3/8] Setting up Python virtual environment..."
    cd "$PROJECT_DIR"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt

    echo ""
    echo "[4/8] Creating production .env..."
    if [ ! -f .env ]; then
        cp .env.server .env
        echo ""
        echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "  !! IMPORTANT: Edit .env with real values !!"
        echo "  !! Run: nano $PROJECT_DIR/.env           !!"
        echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo ""
    else
        echo "  .env already exists, skipping..."
    fi

    echo ""
    echo "[5/8] Running database migrations..."
    python manage.py migrate
    python manage.py collectstatic --noinput

    echo ""
    echo "[6/8] Building React frontend..."
    cd "$PROJECT_DIR/frontend"
    npm install
    npm run build
    cd "$PROJECT_DIR"

    echo ""
    echo "[7/8] Setting up Nginx..."
    sudo cp "$APP_DIR/deployment/nginx-airserve.conf" /etc/nginx/sites-available/airserve
    sudo ln -sf /etc/nginx/sites-available/airserve /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl reload nginx

    echo ""
    echo "[8/8] Setting up Gunicorn service..."
    sudo cp "$APP_DIR/deployment/airserve.service" /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable airserve
    sudo systemctl start airserve

    echo ""
    echo "=============================================="
    echo "  First-time deployment complete!"
    echo ""
    echo "  NEXT STEPS:"
    echo "  1. Edit .env:   nano $PROJECT_DIR/.env"
    echo "     - Set a real SECRET_KEY"
    echo "     - Set EMAIL_HOST_PASSWORD"
    echo "  2. Restart:     sudo systemctl restart airserve"
    echo "  3. SSL cert:    sudo certbot --nginx -d $DOMAIN"
    echo "  4. Seed data:   cd $PROJECT_DIR && source .venv/bin/activate && python create_test_users.py"
    echo "  5. Check:       https://$DOMAIN"
    echo "=============================================="
    exit 0
fi

# --- Regular Deployment (update existing) ---
echo ""
echo "[1/5] Pulling latest code..."
cd "$APP_DIR"
git pull origin "$BRANCH"

echo ""
echo "[2/5] Updating Python dependencies..."
cd "$PROJECT_DIR"
source .venv/bin/activate
pip install -r requirements.txt

echo ""
echo "[3/5] Running migrations and collecting static files..."
python manage.py migrate
python manage.py collectstatic --noinput

echo ""
echo "[4/5] Rebuilding React frontend..."
cd "$PROJECT_DIR/frontend"
npm install
npm run build
cd "$PROJECT_DIR"

echo ""
echo "[5/5] Restarting services..."
sudo systemctl restart airserve
sudo systemctl reload nginx

echo ""
echo "=============================================="
echo "  Deployment update complete!"
echo "  Site: https://$DOMAIN"
echo "=============================================="
