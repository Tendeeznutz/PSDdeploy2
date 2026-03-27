# Python backend image — used only with docker-compose.python.yml override.
# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libjpeg-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Integrated_Scheduling_System-master/appointment_scheduling/requirements.txt .
RUN pip install --user --no-warn-script-location -r requirements.txt

COPY Integrated_Scheduling_System-master/appointment_scheduling/ .
RUN python manage.py collectstatic --no-input 2>/dev/null || true

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && adduser --disabled-password --gecos "" --uid 1001 airserve

WORKDIR /app
COPY --from=builder /root/.local /home/airserve/.local
COPY --from=builder /app .
COPY infra/python/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PATH="/home/airserve/.local/bin:$PATH"
USER airserve
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -sf http://localhost:8000/api/health/ || exit 1

CMD ["/entrypoint.sh"]
