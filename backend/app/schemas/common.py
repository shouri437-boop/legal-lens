# ABOUTME: Common Pydantic schemas shared across the API.
# ABOUTME: Includes error responses and reusable mixins.

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error response format for API errors."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: dict[str, Any] | None = Field(
        default=None, description="Additional error context"
    )
    recoverable: bool = Field(
        default=True, description="Whether the error can be resolved by the client"
    )
    suggested_action: str | None = Field(
        default=None, description="Suggested action for the client to take"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input provided",
                    "details": {"field": "email", "reason": "Invalid email format"},
                    "recoverable": True,
                    "suggested_action": "Please provide a valid email address",
                }
            ]
        }
    }


class TimestampMixin(BaseModel):
    """Mixin for models that track creation and update timestamps."""

    created_at: datetime = Field(..., description="When the record was created")
    updated_at: datetime = Field(..., description="When the record was last updated")
