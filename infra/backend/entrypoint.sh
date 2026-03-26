#!/bin/bash
set -euo pipefail

echo "=== AirServe Backend Entrypoint ==="

# ── Wait for database (belt-and-suspenders, compose healthcheck handles this) ──
echo "Waiting for database..."
python -c "
import time, os, sys
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'appointment_scheduling.settings')
django.setup()
from django.db import connections
for attempt in range(30):
    try:
        connections['default'].ensure_connection()
        print('Database ready.')
        sys.exit(0)
    except Exception:
        time.sleep(1)
print('Database not available after 30s', file=sys.stderr)
sys.exit(1)
"

# ── Run migrations ──
echo "Running migrations..."
python manage.py migrate --no-input

# ── Create MinIO bucket if it does not exist ──
if [ -n "${AWS_S3_ENDPOINT_URL:-}" ]; then
    echo "Ensuring MinIO bucket exists..."
    python -c "
import boto3, os
from botocore.exceptions import ClientError
s3 = boto3.client('s3',
    endpoint_url=os.environ['AWS_S3_ENDPOINT_URL'],
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name='us-east-1')
bucket = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'airserve-media')
try:
    s3.head_bucket(Bucket=bucket)
    print(f'Bucket {bucket} already exists.')
except ClientError:
    s3.create_bucket(Bucket=bucket)
    print(f'Created bucket {bucket}.')
"
fi

# ── Seed test data (only when RUN_SEED=true) ──
if [ "${RUN_SEED:-false}" = "true" ]; then
    echo "Seeding test data..."
    python create_test_users.py || echo "Seeding skipped or already done."
fi

echo "=== Starting Gunicorn ==="
exec "$@"
