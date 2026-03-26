# ============================================================
# Stage 1: Builder — install Python deps, collect static files
# ============================================================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install system deps needed to compile wheels (Pillow, psycopg2)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc libc6-dev libpq-dev libjpeg62-turbo-dev zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

COPY Integrated_Scheduling_System-master/appointment_scheduling/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Copy app source for collectstatic
COPY Integrated_Scheduling_System-master/appointment_scheduling/ /build/app/

# collectstatic needs SECRET_KEY but we don't want a real one baked in
ENV SECRET_KEY="build-only-not-a-real-key" \
    DEBUG="True" \
    PYTHONPATH="/install/lib/python3.11/site-packages"
RUN python /build/app/manage.py collectstatic --no-input


# ============================================================
# Stage 2: Runtime — slim image, no compilers
# ============================================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Runtime-only system deps (libpq for psycopg2, libjpeg for Pillow)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 libjpeg62-turbo curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r airserve && useradd -r -g airserve -d /app -s /sbin/nologin airserve

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY Integrated_Scheduling_System-master/appointment_scheduling/ /app/

# Copy pre-built static files
COPY --from=builder /build/app/staticfiles /app/staticfiles

# Copy entrypoint
COPY infra/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Don't run as root
RUN chown -R airserve:airserve /app
USER airserve

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "appointment_scheduling.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--threads", "2", \
     "--timeout", "120", \
     "--access-logfile", "-"]
