# ABOUTME: Pool of Groq API keys with per-agent affinity and automatic failover on rate limits.
# ABOUTME: Cooldowns are tracked per (key, model) because Groq meters each model separately.

from __future__ import annotations

import logging
import re
import time
import zlib

from app.config import get_settings

logger = logging.getLogger(__name__)

_ORG_RE = re.compile(r"organization\s+`?(org_[A-Za-z0-9]+)`?")
_RETRY_HINT_RE = re.compile(r"try again in\s+((?:[0-9.]+(?:ms|h|m|s))+)", re.I)
_RETRY_PART_RE = re.compile(r"([0-9.]+)(ms|h|m|s)")
_UNIT_SECONDS = {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0}


def retry_after_seconds(text: str) -> float | None:
    """Seconds Groq asks us to wait ("try again in 1m2.5s"), or None if it gave no hint."""
    match = _RETRY_HINT_RE.search(text)
    if not match:
        return None
    return sum(
        float(num) * _UNIT_SECONDS[unit]
        for num, unit in _RETRY_PART_RE.findall(match.group(1).lower())
    )


def is_rate_limit(exc: Exception) -> bool:
    return "RateLimit" in type(exc).__name__ or "rate limit" in str(exc).lower()


def is_request_too_large(text: str) -> bool:
    """A request above the per-minute cap of its model: no key or wait can fix it."""
    return "Request too large" in text


# Stable order used to give each agent its own key (index % number of keys).
# Agents that run at the same time (legal/evidence) sit next to each other so
# they land on different keys when two or more keys are configured.
_AGENT_ORDER = (
    "triage",
    "orchestrator",
    "legal",
    "evidence",
    "strategy",
    "kg_builder",
    "synthesis",
    "geospatial",
    "chat",
    "rag",
    "vision",
    "stt",
)


def mask(key: str | None) -> str:
    """Log-safe form of a key (never log the full value)."""
    return f"...{key[-4:]}" if key else "none"


class GroqKeyPool:
    def __init__(self, keys: list[str]) -> None:
        self.keys = list(dict.fromkeys(k.strip() for k in keys if k and k.strip()))
        self._cooldown_until: dict[tuple[str, str], float] = {}
        self._rotation = 0
        # key -> Groq organization, learned from rate-limit errors. Groq meters tokens
        # per organization, so keys of one organization share a single allowance.
        self._org: dict[str, str] = {}

    def __len__(self) -> int:
        return len(self.keys)

    def key_for_agent(self, agent_type: str | None) -> str | None:
        """The key assigned to an agent type (stable across runs)."""
        if not self.keys:
            return None
        if agent_type in _AGENT_ORDER:
            index = _AGENT_ORDER.index(agent_type)
        else:
            index = zlib.crc32((agent_type or "").encode())
        return self.keys[index % len(self.keys)]

    def next_key(self) -> str | None:
        """Round-robin key for callers with no agent identity."""
        if not self.keys:
            return None
        self._rotation += 1
        return self.keys[self._rotation % len(self.keys)]

    def available(self, key: str, model: str) -> bool:
        return time.monotonic() >= self._cooldown_until.get((key, model), 0.0)

    def learn_org(self, key: str | None, error_text: str) -> None:
        """Remember which organization ``key`` belongs to (named in Groq's 429 text)."""
        match = _ORG_RE.search(error_text)
        if key and match and self._org.get(key) != match.group(1):
            self._org[key] = match.group(1)
            logger.info("Groq key %s belongs to %s", mask(key), match.group(1))

    def peers(self, key: str) -> list[str]:
        """``key`` plus every key known to share its organization's allowance."""
        org = self._org.get(key)
        if org is None:
            return [key]
        return [k for k in self.keys if k == key or self._org.get(k) == org]

    def mark_limited(self, key: str, model: str, seconds: float) -> None:
        until = time.monotonic() + max(seconds, 0.0)
        for peer in self.peers(key):
            self._cooldown_until[(peer, model)] = until

    def choose(self, preferred: str | None, model: str) -> str | None:
        """Preferred key if it is not cooling down for ``model``, else another."""
        if preferred is None or not self.keys:
            return preferred
        if self.available(preferred, model):
            return preferred
        return self.alternative(preferred, model) or preferred

    def alternative(self, current: str | None, model: str) -> str | None:
        """Another key that is usable for ``model`` right now, if any."""
        if not self.keys:
            return None
        start = self.keys.index(current) + 1 if current in self.keys else 0
        for offset in range(len(self.keys)):
            candidate = self.keys[(start + offset) % len(self.keys)]
            if candidate != current and self.available(candidate, model):
                return candidate
        return None

    def soonest_wait(self, model: str) -> float:
        """Seconds until at least one key is usable for ``model`` (0 if one is)."""
        if not self.keys:
            return 0.0
        now = time.monotonic()
        return min(
            max(self._cooldown_until.get((k, model), 0.0) - now, 0.0) for k in self.keys
        )


_pool: GroqKeyPool | None = None


def get_pool() -> GroqKeyPool:
    global _pool
    if _pool is None:
        keys = get_settings().groq_keys
        _pool = GroqKeyPool(keys)
        logger.info(
            "Groq key pool: %d key(s) %s", len(_pool), [mask(k) for k in _pool.keys]
        )
    return _pool
