# ABOUTME: Authentication dependencies for FastAPI endpoints.
# ABOUTME: Supports both JWT (production) and API key (development) authentication.

import logging
import os
import secrets
from datetime import UTC, datetime
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.auth import User
from app.schemas.common import ErrorResponse

logger = logging.getLogger(__name__)

# =============================================================================
# Security Schemes - These create the "Authorize" button in Swagger UI
# =============================================================================

# Dev API key scheme (header-based) - only shown when DEBUG=True and key configured
_dev_api_key_scheme: APIKeyHeader | None = None


def _is_dev_auth_allowed() -> bool:
    """Check if dev authentication should be enabled.

    Requires BOTH conditions:
    1. DEBUG=True in settings
    2. DEV_API_KEY is configured

    Additionally warns if cloud environment indicators are detected.
    """
    if not (settings.debug and settings.dev_api_key):
        return False

    # Extra safety: warn if cloud environment detected
    cloud_indicators = ["K_SERVICE", "GAE_APPLICATION", "AWS_LAMBDA_FUNCTION_NAME"]
    if any(os.environ.get(var) for var in cloud_indicators):
        logger.warning(
            "Dev API key auth is enabled but cloud environment detected! "
            "Set DEBUG=False in production."
        )

    return True


if _is_dev_auth_allowed():
    _dev_api_key_scheme = APIKeyHeader(
        name="X-Dev-API-Key",
        scheme_name="DevAPIKey",
        description="Development API key for local testing (DEBUG mode only). "
        "Set DEV_API_KEY in your .env file. Never use in production.",
        auto_error=False,  # Don't error if missing, fall through to JWT
    )


# JWT Bearer scheme for production auth
_bearer_scheme = HTTPBearer(
    scheme_name="BearerAuth",
    description="JWT token from Better Auth (production)",
    auto_error=False,  # Don't error if missing, we handle it ourselves
)

# =============================================================================
# JWKS Client for JWT validation
# =============================================================================

_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    """Get or create cached JWKS client for JWT validation."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            f"{settings.frontend_url}/api/auth/jwks",
            cache_keys=True,
        )
    return _jwks_client


# =============================================================================
# Dev User Management
# =============================================================================

DEV_USER_ID = "dev-user-00000000-0000-0000-0000-000000000000"


async def _get_or_create_dev_user(db: AsyncSession) -> User:
    """Get or create the development user for API testing."""
    result = await db.execute(select(User).where(User.id == DEV_USER_ID))
    user = result.scalar_one_or_none()

    if user is None:
        # Use naive UTC datetime - Better Auth tables use TIMESTAMP WITHOUT TIME ZONE
        now = datetime.now(tz=UTC).replace(tzinfo=None)
        user = User(
            id=DEV_USER_ID,
            name="Dev User",
            email="dev@localhost",
            email_verified=True,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Created dev user for API testing: %s", DEV_USER_ID)

    return user


# =============================================================================
# Main Authentication Dependency
# =============================================================================


async def _authenticate_user(
    db: AsyncSession,
    bearer_token: HTTPAuthorizationCredentials | None,
    dev_api_key: str | None = None,
) -> User:
    """Core authentication logic shared by both dev and production paths.

    Authentication priority:
    1. X-Dev-API-Key header (only when DEBUG=True and DEV_API_KEY configured)
    2. Authorization: Bearer <jwt> header (production JWT from Better Auth)
    """
    # Method 1: Dev API key (development only)
    if _dev_api_key_scheme and dev_api_key:
        if secrets.compare_digest(dev_api_key, settings.dev_api_key or ""):
            logger.debug("Authenticated via dev API key")
            return await _get_or_create_dev_user(db)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid dev API key",
            )

    # Method 2: JWT Bearer token (production)
    if bearer_token:
        try:
            jwks_client = get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(bearer_token.credentials)
            payload = jwt.decode(
                bearer_token.credentials,
                signing_key.key,
                algorithms=["EdDSA", "ES256", "RS256"],
                audience=settings.frontend_url,
                issuer=settings.frontend_url,
            )
        except jwt.exceptions.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
            )

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        return user

    # Local-only bypass: no credentials needed when AUTH_DISABLED=true and DEBUG=true
    if settings.debug and settings.auth_disabled:
        return await _get_or_create_dev_user(db)

    # No valid authentication provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication. Provide X-Dev-API-Key or Bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


# Conditionally define get_current_user with the appropriate FastAPI signature.
# When dev auth is enabled, the dev_api_key header parameter is included;
# when disabled, it is excluded entirely so it never leaks into the OpenAPI schema.
#
# NOTE: The type: ignore[misc] below is intentional. Mypy does not support
# conditional function redefinition. This pattern is required to:
# 1. Keep dev auth parameters out of production OpenAPI schema
# 2. Ensure FastAPI dependency injection works correctly in each mode
# Both branches define the same logical function with the same return type.
if _dev_api_key_scheme:

    async def get_current_user(
        db: Annotated[AsyncSession, Depends(get_db)],
        bearer_token: Annotated[
            HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
        ] = None,
        dev_api_key: str | None = Depends(_dev_api_key_scheme),
    ) -> User:
        """Authenticate via Dev API key (header) or JWT Bearer token."""
        return await _authenticate_user(db, bearer_token, dev_api_key)

else:

    async def get_current_user(  # type: ignore[misc]  # Intentional: conditional redefinition
        db: Annotated[AsyncSession, Depends(get_db)],
        bearer_token: Annotated[
            HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
        ] = None,
    ) -> User:
        """Authenticate via JWT Bearer token."""
        return await _authenticate_user(db, bearer_token)


# Type alias for dependency injection in route handlers
CurrentUser = Annotated[User, Depends(get_current_user)]

# =============================================================================
# Auth Router
# =============================================================================

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get(
    "/me",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def get_me(current_user: CurrentUser) -> dict:
    """Return current authenticated user info."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "image": current_user.image,
    }
