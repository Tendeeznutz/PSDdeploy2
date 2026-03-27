#!/bin/sh
set -e

# Wait for PostgreSQL
echo "Waiting for postgres..."
until python -c "import psycopg2; psycopg2.connect(host='$DB_HOST', port='$DB_PORT', dbname='$DB_NAME', user='$DB_USER', password='$DB_PASSWORD')" 2>/dev/null; do
    sleep 1
done
echo "Postgres ready."

# Run migrations
python manage.py migrate --no-input

# Seed if requested
if [ "$RUN_SEED" = "true" ]; then
    python manage.py shell < create_test_users.py || true
fi

# Start Gunicorn
exec gunicorn appointment_scheduling.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
