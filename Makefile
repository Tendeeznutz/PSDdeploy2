.DEFAULT_GOAL := help

# ── Stack management ──────────────────────────────────────────────────────────

.PHONY: up
up: ## Start the full stack with the Go backend (default)
	docker compose up -d

.PHONY: py
py: ## Hotswap: start the Python backend instead of Go
	docker compose -f docker-compose.yml -f docker-compose.python.yml up -d

.PHONY: down
down: ## Stop all services and remove containers
	docker compose down

.PHONY: build
build: ## Rebuild all images (no cache)
	docker compose build --no-cache

.PHONY: restart
restart: down up ## Stop then start

.PHONY: logs
logs: ## Follow logs from all services
	docker compose logs -f

.PHONY: logs-backend
logs-backend: ## Follow logs from backend only
	docker compose logs -f backend

# ── Testing ───────────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run integration tests inside Docker (requires running Docker daemon)
	docker compose --profile test run --rm test

.PHONY: test-local
test-local: ## Run integration tests directly on host (faster, no DinD)
	cd backend_v2 && go test -tags integration -v -count=1 -race -timeout=300s ./integration/...

.PHONY: test-unit
test-unit: ## Run unit tests only (no containers needed)
	cd backend_v2 && go test -v ./...

# ── Development utilities ─────────────────────────────────────────────────────

.PHONY: seed
seed: ## Run the seeder inside the running Go backend container
	docker compose exec backend /app/server --seed

.PHONY: psql
psql: ## Open a psql shell against the running Postgres container
	docker compose exec postgres psql -U $${POSTGRES_USER:-airserve} $${POSTGRES_DB:-airserve_db}

.PHONY: health
health: ## Check the backend health endpoint
	curl -sf http://localhost/api/health/ | python3 -m json.tool

.PHONY: sqlc
sqlc: ## Regenerate sqlc Go code from query files
	cd backend_v2 && sqlc generate

.PHONY: tidy
tidy: ## Run go mod tidy inside backend_v2
	cd backend_v2 && go mod tidy

.PHONY: vet
vet: ## Run go vet + integration build check
	cd backend_v2 && go vet ./... && go build -tags integration ./integration/...

# ── Environment ───────────────────────────────────────────────────────────────

.PHONY: env
env: ## Copy .env.example to .env if .env does not exist
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example — please fill in secrets")

# ── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
