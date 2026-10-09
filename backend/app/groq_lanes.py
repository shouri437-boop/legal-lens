# ABOUTME: Shared Groq call scheduler: spreads requests over every (key, model) lane within its per-minute token allowance.
# ABOUTME: Keys of one Groq organization share an allowance (learned from 429s); callers wait, fail over, or get a clear error.

from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field

from app.config import get_settings
from app.groq_keys import GroqKeyPool, get_pool

_WINDOW_SECONDS = 60.0  # Groq's token limits are per minute


class RateLimited(Exception):
    """Every Groq key/model is rate limited for longer than the caller may wait."""

    def __init__(self, seconds: float) -> None:
        self.seconds = seconds
        super().__init__(
            f"All Groq keys and models are rate limited; capacity returns in "
            f"about {seconds:.0f}s."
        )


def estimate_tokens(chars: int) -> int:
    return int(chars / get_settings().groq_chars_per_token)


def lane_models() -> list[str]:
    """Models to spread over: GROQ_LANE_MODELS, else the distinct flash/pro/rag models."""
    s = get_settings()
    configured = [m.strip() for m in s.groq_lane_models.split(",") if m.strip()]
    return list(dict.fromkeys(configured or [s.flash_model, s.pro_model, s.rag_model]))


@dataclass(eq=False)
class Lane:
    """One (key, model) pair; its recent token use is tracked for the last minute."""

    key: str
    model: str
    uses: deque[tuple[float, int]] = field(default_factory=deque)

    def used(self, now: float) -> int:
        while self.uses and now - self.uses[0][0] > _WINDOW_SECONDS:
            self.uses.popleft()
        return sum(tokens for _, tokens in self.uses)


class Lanes:
    def __init__(self, pool: GroqKeyPool, models: list[str], tpm: int) -> None:
        self.pool = pool
        self.tpm = tpm
        self.lanes = [Lane(k, m) for m in models for k in pool.keys]

    def _peers(self, lane: Lane) -> list[Lane]:
        """Lanes drawing on the same allowance: same model, keys of one organization."""
        keys = set(self.pool.peers(lane.key))
        return [p for p in self.lanes if p.model == lane.model and p.key in keys]

    def _used(self, lane: Lane, now: float) -> int:
        return sum(p.used(now) for p in self._peers(lane))

    async def acquire(
        self, need: int, max_wait: float | None = None
    ) -> tuple[Lane, tuple[float, int]]:
        """Reserve ``need`` tokens on the least-used free lane, waiting for room.

        Raises ``RateLimited`` when every lane is cooling down for longer than
        ``max_wait`` seconds (e.g. a daily quota), instead of waiting indefinitely.
        """
        if not self.lanes:
            raise RuntimeError("GROQ_API_KEY is not configured")
        need = min(
            need, self.tpm
        )  # a request above the cap can never fit; let Groq decide
        while True:
            now = time.monotonic()
            best: Lane | None = None
            best_used = 0
            for lane in self.lanes:
                if not self.pool.available(lane.key, lane.model):
                    continue
                used = self._used(lane, now)
                if used + need <= self.tpm and (best is None or used < best_used):
                    best, best_used = lane, used
            if best is not None:
                entry = (now, need)
                best.uses.append(entry)
                return best, entry
            if max_wait is not None and self.lanes:
                soonest = min(
                    self.pool.soonest_wait(model)
                    for model in {lane.model for lane in self.lanes}
                )
                if soonest > max_wait:
                    raise RateLimited(soonest)
            await asyncio.sleep(1.0)

    @staticmethod
    def settle(lane: Lane, entry: tuple[float, int], actual: int | None) -> None:
        """Replace the reserved estimate with the tokens the call really used."""
        if actual is not None and entry in lane.uses:
            lane.uses[lane.uses.index(entry)] = (entry[0], actual)

    def penalize(self, lane: Lane, error_text: str, seconds: float) -> None:
        """Groq said this lane's allowance is gone: cool it (and its organization) down."""
        self.pool.learn_org(lane.key, error_text)
        self.pool.mark_limited(lane.key, lane.model, seconds)
        now = time.monotonic()
        for peer in self._peers(lane):
            peer.uses.append((now, self.tpm))  # treat the minute's allowance as spent


_lanes: Lanes | None = None
_signature: tuple[object, ...] | None = None


def get_lanes() -> Lanes:
    """Process-wide scheduler, so RAG, chronology and other callers share accounting."""
    global _lanes, _signature
    pool = get_pool()
    models = lane_models()
    tpm = get_settings().groq_tpm_limit
    signature = (tuple(pool.keys), tuple(models), tpm)
    if _lanes is None or signature != _signature:
        _lanes, _signature = Lanes(pool, models, tpm), signature
    return _lanes
