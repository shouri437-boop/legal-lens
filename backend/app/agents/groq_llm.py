# ABOUTME: ADK model wrapper that runs "groq/..." model IDs through LiteLLM.
# ABOUTME: Gives each agent its own Groq key, fails over to another key on rate limits, and handles structured output.

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections.abc import AsyncGenerator, Callable
from typing import Any

from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.models.registry import LLMRegistry
from pydantic import PrivateAttr

from app.config import get_settings
from app.groq_keys import (
    get_pool,
    is_rate_limit,
    is_request_too_large,
    mask,
    retry_after_seconds,
)
from app.llm_schema import schema_dict, strict_response_format, supports_json_schema

logger = logging.getLogger(__name__)

# Groq accepts low | medium | high for gpt-oss reasoning effort.
_REASONING_EFFORT = {
    "minimal": "low",
    "low": "low",
    "medium": "medium",
    "high": "high",
}


_MAX_RATE_LIMIT_WAITS = 8


def _rate_limit_delay(exc: Exception) -> float | None:
    """Seconds to wait before retrying a Groq 429, or None if waiting cannot help."""
    if not is_rate_limit(exc) or is_request_too_large(str(exc)):
        return None  # not a rate limit, or bigger than the per-minute cap: never fits
    hint = retry_after_seconds(str(exc))
    return 5.0 if hint is None else hint + 1.0


def _schema_instruction(schema: Any) -> str:
    return (
        "OUTPUT FORMAT: Respond with a single valid JSON object and nothing else "
        "(no markdown fences, no commentary before or after). The JSON must "
        "conform to this JSON Schema; include every required field:\n"
        + json.dumps(schema_dict(schema), separators=(",", ":"))
    )


class GroqLlm(LiteLlm):
    """LiteLlm for Groq-hosted models.

    Keys: with several keys configured, each agent type uses its own key (see
    ``groq_keys``); when that key hits a rate limit the call switches to another
    key that still has room, and only waits when every key is limited.

    Structured output: requests carrying an ``output_schema`` use Groq's
    schema-constrained mode on gpt-oss models (so small models cannot drop
    required fields) and fall back to plain JSON mode with the schema in the
    prompt if Groq rejects it. The pipeline validates every response against the
    Pydantic model and retries on parse failure.
    """

    _agent_type: str | None = PrivateAttr(default=None)
    _preferred_key: str | None = PrivateAttr(default=None)
    _llms: dict[tuple[str, str, str], LiteLlm] = PrivateAttr(default_factory=dict)
    _init_kwargs: dict[str, Any] = PrivateAttr(default_factory=dict)

    def __init__(
        self, model: str, agent_type: str | None = None, **kwargs: Any
    ) -> None:
        settings = get_settings()
        pool = get_pool()
        preferred = kwargs.pop("api_key", None) or (
            pool.key_for_agent(agent_type) if agent_type else pool.next_key()
        )
        # Silently drop params Groq does not support rather than failing the call.
        kwargs.setdefault("drop_params", True)
        # Quick retries for transient errors; rate limits are handled in _call().
        kwargs.setdefault("num_retries", 2)
        if "gpt-oss" in model:
            kwargs.setdefault(
                "reasoning_effort",
                _REASONING_EFFORT.get(settings.thinking_level.lower(), "low"),
            )
        super().__init__(model=model, **kwargs)
        self._agent_type = agent_type
        self._preferred_key = preferred
        self._init_kwargs = dict(kwargs)

    @classmethod
    def supported_models(cls) -> list[str]:
        return [r"groq/.*"]

    def _llm(self, mode: str, key: str | None, schema: Any = None) -> LiteLlm:
        """A LiteLlm bound to ``key`` for one response mode (cached)."""
        schema_id = ""
        if mode == "schema":
            body = json.dumps(schema_dict(schema), sort_keys=True)
            schema_id = hashlib.sha1(body.encode()).hexdigest()
        cache_key = (mode, key or "", schema_id)
        if cache_key not in self._llms:
            extra: dict[str, Any] = {}
            if key:
                extra["api_key"] = key
            if mode == "json":
                extra["response_format"] = {"type": "json_object"}
            elif mode == "schema":
                extra["response_format"] = strict_response_format(schema)
            self._llms[cache_key] = LiteLlm(
                model=self.model, **self._init_kwargs, **extra
            )
        return self._llms[cache_key]

    async def _call(
        self, make: Callable[[str | None], AsyncGenerator[LlmResponse, None]]
    ) -> AsyncGenerator[LlmResponse, None]:
        """Run one model call; on a Groq rate limit (HTTP 429) switch key or wait."""
        pool = get_pool()
        key = pool.choose(self._preferred_key, self.model)
        for attempt in range(_MAX_RATE_LIMIT_WAITS + 1):
            yielded = False
            try:
                async for response in make(key):
                    yielded = True
                    yield response
                return
            except Exception as exc:
                delay = _rate_limit_delay(exc)
                if yielded or delay is None or attempt == _MAX_RATE_LIMIT_WAITS:
                    raise
                if key:
                    pool.learn_org(key, str(exc))
                    pool.mark_limited(key, self.model, delay)
                other = pool.alternative(key, self.model)
                if other:
                    logger.warning(
                        "Groq rate limit on %s (key %s); switching to key %s",
                        self.model,
                        mask(key),
                        mask(other),
                    )
                    key = other
                    continue
                wait = min(delay, pool.soonest_wait(self.model) or delay)
                if wait > get_settings().groq_max_wait_seconds:
                    raise  # e.g. a daily quota: fail with Groq's message, not a long sleep
                logger.warning(
                    "Groq rate limit on %s; waiting %.0fs (retry %d/%d)",
                    self.model,
                    wait,
                    attempt + 1,
                    _MAX_RATE_LIMIT_WAITS,
                )
                await asyncio.sleep(wait)
                key = pool.choose(self._preferred_key, self.model)

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        config = llm_request.config
        schema = config.response_schema if config else None
        if schema is None:
            async for response in self._call(
                lambda k: self._llm("plain", k).generate_content_async(
                    llm_request, stream
                )
            ):
                yield response
            return

        config.response_schema = None
        config.response_mime_type = None

        if supports_json_schema(self.model):
            yielded = False
            try:
                async for response in self._call(
                    lambda k: self._llm("schema", k, schema).generate_content_async(
                        llm_request, stream
                    )
                ):
                    yielded = True
                    yield response
                return
            except Exception as exc:
                if yielded:
                    raise
                logger.warning(
                    "Schema-constrained call failed for %s (%s); retrying in JSON mode",
                    self.model,
                    str(exc)[:200],
                )

        # JSON mode only guarantees valid JSON, so spell the schema out in the
        # prompt. (Strict schema mode needs no copy: it would double the tokens.)
        llm_request.append_instructions([_schema_instruction(schema)])
        async for response in self._call(
            lambda k: self._llm("json", k).generate_content_async(llm_request, stream)
        ):
            yield response


def make_groq_model(model: str, agent_type: str) -> GroqLlm | str:
    """Model object for an agent: gives that agent type its own Groq key.

    Non-Groq model IDs are returned unchanged for ADK's normal resolution.
    """
    if model.startswith("groq/"):
        return GroqLlm(model=model, agent_type=agent_type)
    return model


# Take over the "groq/.*" pattern ADK registers for plain LiteLlm.
LLMRegistry.register(GroqLlm)
