# ABOUTME: Converts Pydantic/JSON schemas into the strict form Groq's json_schema mode accepts.
# ABOUTME: Strict mode needs every property listed as required and additionalProperties=false.

from __future__ import annotations

import copy
from typing import Any

from pydantic import BaseModel


def schema_dict(schema: Any) -> dict[str, Any]:
    """JSON Schema dict for a Pydantic model class/instance or a plain dict."""
    if isinstance(schema, type) and issubclass(schema, BaseModel):
        return schema.model_json_schema()
    if isinstance(schema, BaseModel):
        return schema.model_dump(exclude_none=True, mode="json")
    if isinstance(schema, dict):
        return schema
    return {}


def _strictify(node: Any) -> None:
    if isinstance(node, dict):
        if node.get("type") == "object" and "properties" in node:
            node["additionalProperties"] = False
            node["required"] = list(node["properties"])
        for value in node.values():
            _strictify(value)
    elif isinstance(node, list):
        for value in node:
            _strictify(value)


def strict_response_format(schema: Any, name: str = "response") -> dict[str, Any]:
    """OpenAI-style ``response_format`` that makes the model emit exactly ``schema``."""
    body = copy.deepcopy(schema_dict(schema))
    _strictify(body)
    return {
        "type": "json_schema",
        "json_schema": {"name": name, "strict": True, "schema": body},
    }


def supports_json_schema(model: str) -> bool:
    """Groq models that accept json_schema response formats (gpt-oss family)."""
    return "gpt-oss" in model
