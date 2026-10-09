# ABOUTME: Production Dockerfile for Legal Lens backend API.
# ABOUTME: Uses uv for dependency management and uvicorn for serving.

FROM ghcr.io/astral-sh/uv:0.9 AS uv-bin

FROM python:3.12-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Copy uv binary from official image (faster than pip install)
COPY --from=uv-bin /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies (production only)
RUN uv sync --frozen --no-dev

# Copy application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Run with uvicorn
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
