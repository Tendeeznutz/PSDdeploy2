# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app
COPY customer-frontend2/package.json customer-frontend2/package-lock.json ./
RUN npm ci

# ============================================================
# Stage 2: Build the Next.js app
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY customer-frontend2/ .

# API URL is baked into the client bundle at build time.
# Default /api means requests go to the same origin (proxied by Caddy).
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ============================================================
# Stage 3: Production runtime (standalone output — no node_modules)
# ============================================================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S airserve && \
    adduser -S airserve -u 1001

# Standalone output: only the files needed to run the server (~30MB vs ~300MB)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER airserve

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
