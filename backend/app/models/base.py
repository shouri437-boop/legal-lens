# ABOUTME: SQLAlchemy declarative base for all database models.
# ABOUTME: All model classes should inherit from Base.

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass
