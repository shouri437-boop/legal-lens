# Legal Lens Development Makefile
# Cross-language orchestration for the monorepo

.PHONY: install hooks dev-db stop-db adminer generate-types lint format migrate migrate-auth dev-backend dev-frontend check compliance

# Install all dependencies
install:
	bun install
	cd backend && uv sync --dev

# Install git hooks (requires lefthook)
hooks:
	@if command -v lefthook >/dev/null 2>&1; then \
		lefthook install; \
		echo "Lefthook hooks installed."; \
	else \
		echo "lefthook is not installed."; \
		echo "Install it, then rerun: make hooks"; \
		echo "macOS (Homebrew): brew install lefthook"; \
		echo "Linux: see https://github.com/evilmartians/lefthook#installation"; \
		exit 1; \
	fi

# Start local PostgreSQL database
dev-db:
	docker compose up -d postgres

# Stop local PostgreSQL database
stop-db:
	docker compose down

# Start Adminer database UI (http://localhost:8081)
adminer:
	docker compose up -d adminer

# Generate TypeScript types from FastAPI OpenAPI (via openapi-typescript)
generate-types:
	@tmp=$$(mktemp -t legal-lens-openapi.XXXXXX.json) ; \
	cd backend && uv run python -c 'import json; from app.main import app; print(json.dumps(app.openapi()))' > "$$tmp" ; \
	cd .. && bunx openapi-typescript "$$tmp" --output packages/types/src/generated/api.ts ; \
	rm -f "$$tmp"

# Run linting for all projects
lint:
	bun run lint:frontend || true
	cd backend && uv run ruff check .

# Run formatting for all projects
format:
	bun run format:frontend || true
	cd backend && uv run ruff format .

# Run comprehensive compliance checks (lint, format check, type generation)
check: compliance

compliance:
	@echo "Running compliance checks..."
	@echo "\n==> Checking backend formatting..."
	cd backend && uv run ruff format --check .
	@echo "\n==> Checking backend linting..."
	cd backend && uv run ruff check .
	@echo "\n==> Checking type generation..."
	@$(MAKE) generate-types
	@if [ -n "$$(git status --porcelain packages/types/)" ]; then \
		echo "\n❌ Type generation produced changes. Run 'make generate-types' and commit."; \
		git diff -- packages/types/; \
		exit 1; \
	fi
	@echo "\n✅ All compliance checks passed!"

# Run Better Auth migrations (creates auth tables)
migrate-auth:
	cd frontend && bunx @better-auth/cli migrate

# Run all database migrations (auth first, then app)
migrate: migrate-auth
	cd backend && uv run alembic upgrade head

# Start backend development server
dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8080

# Start frontend development server
dev-frontend:
	bun --cwd frontend dev
