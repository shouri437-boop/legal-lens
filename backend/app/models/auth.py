# ABOUTME: SQLAlchemy models for Better Auth tables (read-only).
# ABOUTME: DO NOT create migrations for these - Better Auth manages them.

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    """
    Better Auth user table.

    Read-only model - this table is managed by Better Auth.
    Column names use camelCase to match Better Auth's schema.
    """

    __tablename__ = "user"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(
        "emailVerified", Boolean, default=False
    )
    image: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Session(Base):
    """
    Better Auth session table.

    Read-only model - this table is managed by Better Auth.
    Column names use camelCase to match Better Auth's schema.
    """

    __tablename__ = "session"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", String, nullable=False)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime, nullable=False)
    ip_address: Mapped[str | None] = mapped_column("ipAddress", String, nullable=True)
    user_agent: Mapped[str | None] = mapped_column("userAgent", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Account(Base):
    """
    Better Auth account table for OAuth providers and email/password.

    Read-only model - this table is managed by Better Auth.
    Column names use camelCase to match Better Auth's schema.
    """

    __tablename__ = "account"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", String, nullable=False)
    account_id: Mapped[str] = mapped_column("accountId", String, nullable=False)
    provider_id: Mapped[str] = mapped_column("providerId", String, nullable=False)
    access_token: Mapped[str | None] = mapped_column("accessToken", Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(
        "refreshToken", Text, nullable=True
    )
    access_token_expires_at: Mapped[datetime | None] = mapped_column(
        "accessTokenExpiresAt", DateTime, nullable=True
    )
    refresh_token_expires_at: Mapped[datetime | None] = mapped_column(
        "refreshTokenExpiresAt", DateTime, nullable=True
    )
    scope: Mapped[str | None] = mapped_column(String, nullable=True)
    id_token: Mapped[str | None] = mapped_column("idToken", Text, nullable=True)
    password: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Verification(Base):
    """
    Better Auth verification table for email verification tokens.

    Read-only model - this table is managed by Better Auth.
    Column names use camelCase to match Better Auth's schema.
    """

    __tablename__ = "verification"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    identifier: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Jwks(Base):
    """
    Better Auth JWKS table for JWT signing keys.

    Read-only model - this table is managed by Better Auth.
    Column names use camelCase to match Better Auth's schema.
    """

    __tablename__ = "jwks"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    public_key: Mapped[str] = mapped_column("publicKey", Text, nullable=False)
    private_key: Mapped[str] = mapped_column("privateKey", Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
