.PHONY: dev down logs migrate seed test clean help

# Default target
help:
	@echo "Mo-Ride Makefile commands:"
	@echo "  make dev        - Start all services with docker compose"
	@echo "  make down       - Stop and remove containers"
	@echo "  make logs       - Follow logs from all services"
	@echo "  make migrate    - Apply DB migrations (runs automatically on first start)"
	@echo "  make seed       - Seed sample data into the database"
	@echo "  make test       - Run all backend tests"
	@echo "  make clean      - Remove all containers + volumes (destructive!)"
	@echo "  make setup-env  - Copy .env.example to .env (first time setup)"

setup-env:
	@if [ ! -f .env ]; then cp infra/.env.example .env && echo "Created .env from template. Edit it before continuing."; else echo ".env already exists."; fi

dev: setup-env
	docker compose -f infra/docker-compose.yml --env-file .env up --build

down:
	docker compose -f infra/docker-compose.yml down

logs:
	docker compose -f infra/docker-compose.yml logs -f

migrate:
	docker compose -f infra/docker-compose.yml exec postgres psql -U moride -d moride -f /migrations/001_initial_schema.sql
	docker compose -f infra/docker-compose.yml exec postgres psql -U moride -d moride -f /migrations/002_rls_policies.sql

seed:
	docker compose -f infra/docker-compose.yml exec postgres psql -U moride -d moride -f /migrations/003_seed.sql

test:
	@echo "Running ride-matching tests..."
	docker compose -f infra/docker-compose.yml run --rm ride-matching pytest tests/ -v
	@echo "Running payments tests..."
	docker compose -f infra/docker-compose.yml run --rm payments pytest tests/ -v

clean:
	@echo "WARNING: This will delete all data volumes!"
	@read -p "Are you sure? [y/N] " confirm && [ $$confirm = y ] && \
	docker compose -f infra/docker-compose.yml down -v --remove-orphans && \
	echo "Cleaned." || echo "Aborted."
