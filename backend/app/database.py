# ABOUTME: Async SQLAlchemy database engine and session management.
# ABOUTME: Provides connection pooling optimized for Cloud Run cold starts.

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL is required to initialize the database engine"
            )

        # Cloud Run specific: smaller pool due to instance scaling
        _engine = create_async_engine(
            settings.database_url,
            pool_size=5,  # Small for Cloud Run cold starts
            max_overflow=10,  # Allow bursting
            pool_pre_ping=True,  # Verify connections before use
            pool_recycle=1800,  # Recycle connections every 30 min
            echo=settings.sql_echo,
        )
    return _engine


def _get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            _get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _sessionmaker


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session."""
    async with _get_sessionmaker()() as session:
        try:
            yield session
        finally:
            await session.close()
