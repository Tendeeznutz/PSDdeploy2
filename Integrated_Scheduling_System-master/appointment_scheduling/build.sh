#!/usr/bin/env bash
# Render build script for AirServe Django backend
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# Seed test data if database is empty
python create_test_users.py || echo "Seeding skipped or already done."
