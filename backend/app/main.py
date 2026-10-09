# ABOUTME: FastAPI application entry point.
# ABOUTME: Configures middleware, includes routers, and handles application lifecycle.

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import (
    agents,
    auth,
    cases,
    chat,
    confirmations,
    files,
    findings,
    health,
    knowledge_graph,
    local_files,
    locations,
    rag,
    sse,
    synthesis,
    timeline,
)
from app.config import get_settings
from app.logging_config import setup_logging
from app.schemas import ErrorResponse
from app.services.media_text import warm_pool

# DO NOT import GZipMiddleware - incompatible with SSE

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    setup_logging()
    logger.info("Legal Lens API starting up...")

    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL must be set for the backend to start. "
            "(It may be omitted for tooling like OpenAPI/type generation.)"
        )

    # Log dev API key availability
    if settings.debug and settings.dev_api_key:
        logger.info(
            "Dev API key enabled for Swagger UI testing. "
            "Use X-Dev-API-Key header to authenticate."
        )

    # Start PDF worker processes in the background so the first read is fast
    warm_task = asyncio.create_task(warm_pool())

    yield
    warm_task.cancel()
    logger.info("Legal Lens API shutting down...")


# Note: Security schemes (Authorize button) are automatically added by
# APIKeyHeader and HTTPBearer dependencies in app/api/auth.py

app = FastAPI(
    title="Legal Lens API",
    version="0.1.0",
    description="Legal intelligence platform backend",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},  # Remember auth in browser
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    error = ErrorResponse(
        code="VALIDATION_ERROR",
        message="Invalid request",
        details={
            "errors": exc.errors(),
            "path": request.url.path,
        },
        recoverable=True,
        suggested_action="Fix the request payload and try again.",
    )
    return JSONResponse(status_code=422, content=error.model_dump(mode="json"))


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    # If something already raised a structured error payload, pass it through.
    if (
        isinstance(exc.detail, dict)
        and "code" in exc.detail
        and "message" in exc.detail
    ):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    error = ErrorResponse(
        code=f"HTTP_{exc.status_code}",
        message=str(exc.detail),
        details={
            "path": request.url.path,
        },
        recoverable=exc.status_code < 500,
    )
    return JSONResponse(
        status_code=exc.status_code, content=error.model_dump(mode="json")
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    settings = get_settings()
    logger.exception("Unhandled exception on %s", request.url.path)

    details: dict | None = None
    if settings.debug:
        details = {"error": str(exc), "path": request.url.path}

    error = ErrorResponse(
        code="INTERNAL_SERVER_ERROR",
        message="Internal server error",
        details=details,
        recoverable=False,
    )
    return JSONResponse(status_code=500, content=error.model_dump(mode="json"))


# CORS for frontend
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NOTE: Do NOT add GZipMiddleware - breaks SSE streaming

# Paths excluded from request logging (noisy or long-lived SSE connections)
_SKIP_LOG_PREFIXES = ("/health", "/sse/")


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log method, path, status, and duration for each HTTP request."""
    path = request.url.path
    if any(path.startswith(prefix) for prefix in _SKIP_LOG_PREFIXES):
        return await call_next(request)

    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "HTTP %s %s status=%d duration_ms=%.1f",
        request.method,
        path,
        response.status_code,
        duration_ms,
    )
    return response


# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(sse.router, tags=["sse"])
app.include_router(auth.router, tags=["auth"])
app.include_router(cases.router, tags=["cases"])
app.include_router(files.router, tags=["files"])
app.include_router(local_files.router, tags=["local-files"])
app.include_router(agents.router, tags=["agents"])
app.include_router(confirmations.router, tags=["confirmations"])
app.include_router(knowledge_graph.router, tags=["knowledge-graph"])
app.include_router(findings.router, tags=["findings"])
app.include_router(synthesis.router, tags=["synthesis"])
app.include_router(timeline.router, tags=["timeline"])
app.include_router(locations.router, tags=["geospatial"])
app.include_router(chat.router, tags=["chat"])
app.include_router(rag.router, tags=["rag"])
