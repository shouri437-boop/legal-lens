# ABOUTME: Builds a detailed case chronology and map locations from the case documents.
# ABOUTME: Splits documents into small chunks, extracts events/places in parallel across Groq keys, then merges and stores them.

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import statistics
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Literal
from uuid import UUID

import litellm
from pydantic import BaseModel, Field, field_validator
from rapidfuzz import fuzz
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.groq_keys import (
    is_rate_limit,
    is_request_too_large,
    mask,
    retry_after_seconds,
)
from app.groq_lanes import Lane, Lanes, RateLimited, estimate_tokens, get_lanes
from app.llm_schema import strict_response_format, supports_json_schema
from app.models import CaseFile, TimelineEvent
from app.models.synthesis import Location
from app.services.geocoding_service import GeocodingService
from app.services.media_text import file_to_text

logger = logging.getLogger(__name__)

CHUNK_CHARS = 6000
MAX_OUTPUT_TOKENS = 3200
PROMPT_OVERHEAD_TOKENS = 1500  # instructions + schema, measured on real calls

Category = Literal[
    "incident",
    "witness",
    "evidence",
    "investigation",
    "arrest",
    "filing",
    "hearing",
    "judgment",
    "appeal",
    "other",
]
PlaceRole = Literal[
    "crime_scene",
    "witness_location",
    "evidence_location",
    "suspect_location",
    "police_station",
    "hospital",
    "court",
    "other",
]

# Timeline "layer" (the colour/filter group in the UI) for each category.
_LAYER = {
    "incident": "evidence",
    "witness": "evidence",
    "evidence": "evidence",
    "investigation": "legal",
    "arrest": "legal",
    "filing": "legal",
    "hearing": "legal",
    "judgment": "legal",
    "appeal": "legal",
    "other": "strategy",
}
# Map pin type: the UI knows crime_scene / witness / evidence / suspect / other.
_PIN_TYPE = {
    "crime_scene": "crime_scene",
    "witness_location": "witness_location",
    "evidence_location": "evidence_location",
    "suspect_location": "suspect_location",
    "police_station": "other",
    "hospital": "other",
    "court": "other",
    "other": "other",
}


class ChunkEvent(BaseModel):
    date: str = Field(
        description="YYYY-MM-DD, or YYYY-MM / YYYY if partial, '' if unknown"
    )
    time: str = Field(
        description="HH:MM in 24h only if the text states a time, else ''"
    )
    title: str = Field(description="Short event title, max 90 characters")
    description: str = Field(description="One or two sentences on what happened")
    category: Category
    location: str = Field(description="Where it happened, '' if not stated")
    page: int = Field(description="Page number from the === Page N === marker")
    quote: str = Field(
        description="Verbatim excerpt (max 160 chars) supporting the event"
    )

    @field_validator("category", mode="before")
    @classmethod
    def _category(cls, v: object) -> object:
        return v if v in _CATEGORIES else "other"

    @field_validator("page", mode="before")
    @classmethod
    def _page(cls, v: object) -> object:
        m = re.search(r"\d+", str(v))
        return int(m.group()) if m else 1

    @field_validator(
        "date", "time", "title", "description", "location", "quote", mode="before"
    )
    @classmethod
    def _text(cls, v: object) -> object:
        return "" if v is None else str(v)


_CATEGORIES = {
    "incident",
    "witness",
    "evidence",
    "investigation",
    "arrest",
    "filing",
    "hearing",
    "judgment",
    "appeal",
    "other",
}
_ROLES = {
    "crime_scene",
    "witness_location",
    "evidence_location",
    "suspect_location",
    "police_station",
    "hospital",
    "court",
    "other",
}


class ChunkPlace(BaseModel):
    name: str = Field(description="Place name as used in the document")
    geocode_query: str = Field(
        description="Full searchable address incl. city, district, state, country; '' if unknown"
    )
    role: PlaceRole
    page: int
    quote: str = Field(
        description="Verbatim excerpt (max 160 chars) mentioning the place"
    )

    @field_validator("role", mode="before")
    @classmethod
    def _role(cls, v: object) -> object:
        return v if v in _ROLES else "other"

    @field_validator("page", mode="before")
    @classmethod
    def _page(cls, v: object) -> object:
        m = re.search(r"\d+", str(v))
        return int(m.group()) if m else 1

    @field_validator("name", "geocode_query", "quote", mode="before")
    @classmethod
    def _text(cls, v: object) -> object:
        return "" if v is None else str(v)


class ChunkResult(BaseModel):
    events: list[ChunkEvent]
    places: list[ChunkPlace]


_SYSTEM = """You build a chronology and a place list from ONE PART of a legal case document.

EVENTS: list every distinct thing that HAPPENED and has a date or time (the offence, sightings, \
witness reports, FIR registration, arrests, recoveries, post-mortem, inquest, investigation steps, \
charge-sheet, trial steps, judgment, appeal). One entry per occurrence: if several sources describe \
the same occurrence, list it once. Do NOT list documents or exhibits themselves (a bank statement, \
an order sheet, a bill, a register) as events - only what happened (a deposit, a hearing, a visit).

PLACES: list real, specific places where something happened or that a lawyer would want on a map \
(crime scene, recovery site, residence, shop, police station, hospital, court, depot, road, \
area). Skip generic words with no name or town ("the hospital", "a police station", "the Bench").

Rules:
- Use only what the text says. Never invent or guess dates, times or places.
- date: YYYY-MM-DD (YYYY-MM or YYYY if only partial; '' if no date). Copy the YEAR exactly as \
written for THAT event ("12.03.2019" is 2019 even if the judgment is from 2023).
- time: HH:MM 24-hour ONLY when the text states a time (e.g. "9.00 a.m." -> "09:00"), else ''.
- page: the number from the "=== Page N ===" marker the item appears under.
- quote: a short VERBATIM excerpt (max 160 characters) copied exactly from the text.
- title: at most 90 characters, specific ("A-4 arrested at depot", not "Arrest"). description: 1-2 sentences.
- geocode_query: a full address a map service can find: name + area + town/district + state + \
country, using the town names in the document header; '' if it cannot be located.
- Skip citations of other cases and general legal discussion; keep this case's own facts.
- If the part has no events or places, return empty lists."""


@dataclass
class _Chunk:
    file_id: str
    file_name: str
    text: str
    pages: tuple[int, int]
    depth: int = 0


# ---------------------------------------------------------------------------
# Splitting documents into chunks
# ---------------------------------------------------------------------------

_PAGE_RE = re.compile(r"^=== Page (\d+) ===$", re.M)


def _split_pages(text: str) -> list[tuple[int, str]]:
    """(page, text) pairs from a ``file_to_text`` result (page 1 if unpaged)."""
    marks = list(_PAGE_RE.finditer(text))
    if not marks:
        return [(1, text)]
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        out.append((int(m.group(1)), text[m.end() : end].strip()))
    return out


def _chunks_for_file(file_id: str, name: str, text: str) -> list[_Chunk]:
    chunks: list[_Chunk] = []
    buf: list[str] = []
    size = 0
    first = last = 0

    def flush() -> None:
        nonlocal buf, size
        if buf:
            chunks.append(_Chunk(file_id, name, "\n\n".join(buf), (first, last)))
        buf, size = [], 0

    for page, body in _split_pages(text):
        if not body.strip():
            continue
        # a very long page is cut into pieces that keep the same page marker
        pieces = [body[i : i + CHUNK_CHARS] for i in range(0, len(body), CHUNK_CHARS)]
        for piece in pieces:
            block = f"=== Page {page} ===\n{piece}"
            if size and size + len(block) > CHUNK_CHARS:
                flush()
            if not buf:
                first = page
            buf.append(block)
            last = page
            size += len(block)
    flush()
    return chunks


# ---------------------------------------------------------------------------
# One extraction call
# ---------------------------------------------------------------------------


async def _call(
    lane: Lane, context: str, chunk: _Chunk, strict: bool
) -> tuple[ChunkResult, int | None]:
    user = (
        f"Case document: {chunk.file_name}\n{context}\n"
        f"(pages {chunk.pages[0]}-{chunk.pages[1]})\n\n{chunk.text}"
    )
    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": user},
    ]
    if strict:
        response_format: dict[str, Any] = strict_response_format(
            ChunkResult, "ChunkResult"
        )
    else:
        response_format = {"type": "json_object"}
        messages[0]["content"] += "\n\nReturn JSON: " + json.dumps(
            ChunkResult.model_json_schema(), separators=(",", ":")
        )
    response = await litellm.acompletion(
        model=lane.model,
        messages=messages,
        response_format=response_format,
        temperature=0.1,
        max_completion_tokens=MAX_OUTPUT_TOKENS,
        reasoning_effort="low" if "gpt-oss" in lane.model else None,
        drop_params=True,
        api_key=lane.key,
        num_retries=0,
    )
    usage = getattr(response, "usage", None)
    total = getattr(usage, "total_tokens", None) if usage else None
    return (
        ChunkResult.model_validate_json(response.choices[0].message.content or ""),
        total,
    )


async def _extract_chunk(
    chunk: _Chunk, context: str, lanes: Lanes, stats: dict[str, int]
) -> list[ChunkResult]:
    """Extract one chunk, waiting for capacity, failing over between lanes, splitting if too big."""
    settings = get_settings()
    need = estimate_tokens(len(chunk.text)) + PROMPT_OVERHEAD_TOKENS + MAX_OUTPUT_TOKENS
    strict = True
    for attempt in range(settings.groq_max_attempts):
        try:
            lane, entry = await lanes.acquire(need, settings.groq_max_wait_seconds)
        except RateLimited as exc:
            # every key/model is cooling down for longer than we may wait
            stats["rate_limit_wait"] = max(stats["rate_limit_wait"], int(exc.seconds))
            break
        try:
            result, used = await _call(
                lane, context, chunk, strict and supports_json_schema(lane.model)
            )
            lanes.settle(lane, entry, used)
            return [result]
        except Exception as exc:  # noqa: BLE001
            text = str(exc)
            lanes.settle(lane, entry, 0)  # nothing was spent
            too_big = (
                is_request_too_large(text)
                or "max completion tokens" in text
                or "does not match the expected schema" in text
                or "validation error" in text
            )
            if too_big and len(chunk.text) > 1500 and chunk.depth < 4:
                # too much for one answer: split the chunk in two and extract each half
                half = len(chunk.text) // 2
                cut = chunk.text.rfind("\n", 0, half)
                cut = cut if cut > 200 else half
                out: list[ChunkResult] = []
                for part_text in (chunk.text[:cut], chunk.text[cut:]):
                    part = _Chunk(
                        chunk.file_id,
                        chunk.file_name,
                        part_text,
                        chunk.pages,
                        chunk.depth + 1,
                    )
                    out.extend(await _extract_chunk(part, context, lanes, stats))
                return out
            if is_rate_limit(exc):
                lanes.penalize(lane, text, retry_after_seconds(text) or 8.0)
                stats["rate_limited"] += 1
                continue
            # schema rejected / invalid JSON: retry once in plain JSON mode
            logger.warning(
                "Chunk extraction failed on %s %s (%s)",
                mask(lane.key),
                lane.model,
                text[:160],
            )
            strict = False
            if attempt >= 3:
                break
    stats["failed_chunks"] += 1
    return []


# ---------------------------------------------------------------------------
# Merge, verify, store
# ---------------------------------------------------------------------------


def _norm(text: str) -> str:
    return re.sub(r"[\W_]+", "", text.lower())


_MONTHS = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
]


_YMD = re.compile(r"(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?")


def _date_in(ymd: str, text: str, with_year: bool) -> bool:
    """True if ``text`` states this date (day and month, and the year when ``with_year``)."""
    m = _YMD.fullmatch(ymd.strip())
    if not m:
        return False
    year, month, day = m.group(1), m.group(2), m.group(3)
    low = text.lower()
    # a two-digit year only counts as the tail of a numeric date such as 15/03/19
    short_year = rf"\d{{1,2}}[./-]\d{{1,2}}[./-]{year[2:]}(?!\d)"
    if with_year and year not in low and not re.search(short_year, low):
        return False
    if month is None:
        return True
    mnum = int(month)
    name = _MONTHS[mnum - 1] if 1 <= mnum <= 12 else "?"
    abbr = name[:3]
    named = rf"(?:{name}|{abbr}[a-z]*\.?)"
    if with_year:
        mon = rf"(?:{named}|0?{mnum})"
        yr = rf"(?:{year}|(?<=[./-]){year[2:]}(?!\d))"
        if day is None:
            return bool(re.search(rf"{mon}[^\n]{{0,8}}{yr}", low))
        d = int(day)
        patterns = (
            rf"(?<!\d)0?{d}(?!\d)[^\n]{{0,25}}?{mon}[^\n]{{0,12}}?{yr}",
            rf"{name}[^\n]{{0,6}}?0?{d}(?!\d)[^\n]{{0,8}}?{yr}",
            rf"{abbr}[a-z]*\.?[^\n]{{0,6}}?0?{d}(?!\d)[^\n]{{0,8}}?{yr}",
        )
    else:
        if day is None:
            return bool(re.search(named, low))
        d = int(day)
        patterns = (
            rf"(?<!\d)0?{d}(?!\d)[^\n]{{0,12}}?{named}",
            rf"{named}[^\n]{{0,6}}?0?{d}(?!\d)",
            rf"(?<!\d)0?{d}[./-]0?{mnum}(?!\d)",
        )
    return any(re.search(pat, low) for pat in patterns)


def _date_supported(ymd: str, chunk_text: str, doc_text: str) -> bool:
    """True if the document really states this date (guards against invented dates).

    A judgment usually writes the year once ("on 12 March 2019") and later says only
    "15 March", so a date is accepted when the whole document states it in full, or when
    this part names the day and month and the document states that year somewhere.
    """
    if _date_in(ymd, doc_text, with_year=True):
        return True
    year_in_doc = _date_in(ymd[:4], doc_text, with_year=True)
    return year_in_doc and _date_in(ymd, chunk_text, with_year=False)


_MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"
_SUFFIX = r"(?:st|nd|rd|th)?"
_NUMERIC_DATE = re.compile(r"(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)")
_DAY_MONTH = re.compile(
    rf"(?<!\d)(\d{{1,2}}){_SUFFIX}(?:\s*[-–]\s*(\d{{1,2}}){_SUFFIX})?[\s-]+{_MON}"
    r"(?:[\s,]+(\d{4}))?",
    re.I,
)
_MONTH_DAY = re.compile(
    rf"\b{_MON}[\s.]+(\d{{1,2}}){_SUFFIX}(?!\d)(?:,?\s+(\d{{4}}))?", re.I
)
_MONTH_YEAR = re.compile(rf"\b{_MON}[\s,]+(\d{{4}})(?!\d)", re.I)
_MONTH_NUMBER = {m[:3]: i for i, m in enumerate(_MONTHS, start=1)}

# (start, end, days it names or None for "month only", month, year or None)
_Mention = tuple[int, int, "set[int] | None", int, "int | None"]


def _date_mentions(text: str) -> list[_Mention]:
    """Every date written in ``text``, in order ("15.03.2019", "12-13 March", "Dec 2018")."""
    found: list[_Mention] = []
    for m in _NUMERIC_DATE.finditer(text):
        year = int(m[3]) if len(m[3]) == 4 else 2000 + int(m[3])
        found.append((m.start(), m.end(), {int(m[1])}, int(m[2]), year))
    for m in _DAY_MONTH.finditer(text):
        days = {int(m[1])} | ({int(m[2])} if m[2] else set())
        year = int(m[4]) if m[4] else None
        found.append((m.start(), m.end(), days, _MONTH_NUMBER[m[3].lower()], year))
    for m in _MONTH_DAY.finditer(text):
        year = int(m[3]) if m[3] else None
        found.append(
            (m.start(), m.end(), {int(m[2])}, _MONTH_NUMBER[m[1].lower()], year)
        )
    for m in _MONTH_YEAR.finditer(text):
        found.append((m.start(), m.end(), None, _MONTH_NUMBER[m[1].lower()], int(m[2])))
    found.sort(key=lambda x: (x[0], -(x[1] - x[0])))
    kept: list[_Mention] = []
    for item in found:  # a date inside a longer one ("March 2019" in "12 March 2019")
        if not kept or item[0] >= kept[-1][1]:
            kept.append(item)
    return kept


def _mention_is(m: _Mention, year: int, month: int, day: int | None) -> bool:
    _, _, days, mon, yr = m
    return (
        mon == month
        and (yr is None or yr == year)
        and (days is None or day is None or day in days)
    )


def _quote_span(quote: str, page_text: str) -> tuple[int, int] | None:
    """Where ``quote`` sits in ``page_text`` (matching ignores punctuation and spacing)."""
    wanted = _norm(quote)
    if not wanted:
        return None
    keep = [i for i, ch in enumerate(page_text) if ch.isalnum()]
    flat = "".join(page_text[i].lower() for i in keep)
    pos = flat.find(wanted)
    if pos < 0:
        return None
    return keep[pos], keep[pos + len(wanted) - 1] + 1


def _date_fits_quote(
    ymd: str, quote: str, page_text: str, before: int, after: int
) -> bool | None:
    """Does the date written next to the quote agree with ``ymd``?

    A table row or sentence states its own date just before (or inside) the text it
    describes, so the nearest date before the quote must be the event's date. Returns
    None when the quote or any nearby date cannot be found (no evidence either way).
    """
    m = _YMD.fullmatch(ymd.strip())
    span = _quote_span(quote, page_text)
    if not m or span is None:
        return None
    year, month = int(m.group(1)), int(m.group(2) or 0)
    day = int(m.group(3)) if m.group(3) else None
    if not month:
        return None
    start, end = span
    mentions = _date_mentions(page_text)
    inside = [x for x in mentions if start <= x[0] < end]
    if inside:
        return any(_mention_is(x, year, month, day) for x in inside)
    preceding = [x for x in mentions if x[0] < start and start - x[0] <= before]
    if preceding:
        return _mention_is(preceding[-1], year, month, day)
    following = [x for x in mentions if end <= x[0] <= end + after]
    if following:
        return any(_mention_is(x, year, month, day) for x in following)
    return None


def _parse_when(d: str, t: str) -> tuple[datetime | None, bool]:
    """(datetime, is_exact_day) from the model's date/time strings."""
    d = (d or "").strip()
    m = re.fullmatch(r"(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?", d)
    if not m:
        return None, False
    year, month, day = int(m.group(1)), int(m.group(2) or 1), int(m.group(3) or 1)
    if not (1800 <= year <= 2100):
        return None, False
    try:
        base = date(year, month, day)
    except ValueError:
        return None, False
    hh = mm = 0
    tm = re.fullmatch(r"(\d{1,2}):(\d{2})", (t or "").strip())
    if tm and int(tm.group(1)) < 24 and int(tm.group(2)) < 60:
        hh, mm = int(tm.group(1)), int(tm.group(2))
    return datetime(base.year, base.month, base.day, hh, mm, tzinfo=UTC), bool(
        m.group(3)
    )


@dataclass
class _Event:
    when: datetime
    exact: bool
    has_time: bool
    title: str
    description: str
    category: str
    location: str
    citations: list[dict[str, object]]


def _same_event(
    e: _Event,
    when: datetime,
    has_time: bool,
    title: str,
    description: str,
    category: str,
) -> bool:
    if e.when.date() != when.date():
        return False
    ratio = fuzz.token_set_ratio(e.title, title)
    if e.has_time and has_time:
        if e.when != when:
            return False  # two different timed events on the same day stay separate
        # same minute: merge when the wording overlaps (a little less strictly if the
        # category also matches)
        return ratio >= 60 or (e.category == category and ratio >= 45)
    if e.has_time != has_time:
        # one version carries the time of day, the other only the date: same event
        # if the wording is clearly alike
        return ratio >= 70 or fuzz.token_set_ratio(e.description, description) >= 80
    if ratio >= 82:
        return True
    return fuzz.token_set_ratio(e.description, description) >= 88


def _merge_events(
    raw: list[tuple[_Chunk, ChunkEvent]],
    pages: dict[tuple[str, int], str],
    docs: dict[str, str],
) -> list[_Event]:
    settings = get_settings()
    merged: list[_Event] = []
    dropped_dates = 0
    for chunk, ev in raw:
        when, exact = _parse_when(ev.date, ev.time)
        if when is None or not ev.title.strip():
            continue
        page_text = pages.get((chunk.file_id, ev.page), "")
        quote = ev.quote.strip()
        # The date must be written next to the event's own quote; when that cannot be
        # judged, it must at least be stated somewhere in the document.
        fits = _date_fits_quote(
            ev.date,
            quote,
            page_text,
            settings.timeline_date_lookback_chars,
            settings.timeline_date_lookahead_chars,
        )
        if fits is None:
            fits = _date_supported(
                ev.date, chunk.text, docs.get(chunk.file_id, chunk.text)
            )
        if not fits:
            dropped_dates += 1  # the date is not the one the document gives this event
            if dropped_dates <= 6:
                logger.info(
                    "Dropped event %r: date %s does not match the document",
                    ev.title[:60],
                    ev.date,
                )
            continue
        verified = bool(quote) and _norm(quote) in _norm(page_text)
        citation = {
            "file_id": chunk.file_id,
            "locator": f"page:{ev.page}",
            "excerpt": quote if verified else "",
        }
        has_time = bool(re.fullmatch(r"\d{1,2}:\d{2}", ev.time.strip()))
        dup = next(
            (
                e
                for e in merged
                if _same_event(e, when, has_time, ev.title, ev.description, ev.category)
            ),
            None,
        )
        if dup:
            if len(ev.description) > len(dup.description):
                dup.description = ev.description
            if len(ev.title) > len(dup.title) and len(ev.title) <= 90:
                dup.title = ev.title.strip()
            if has_time and not dup.has_time:
                dup.when, dup.has_time = when, True
            if not dup.location and ev.location:
                dup.location = ev.location.strip()
            if citation not in dup.citations and len(dup.citations) < 6:
                dup.citations.append(citation)
            continue
        merged.append(
            _Event(
                when=when,
                exact=exact,
                has_time=has_time,
                title=ev.title.strip()[:200],
                description=ev.description.strip(),
                category=ev.category,
                location=ev.location.strip(),
                citations=[citation],
            )
        )
    if dropped_dates:
        logger.info(
            "Dropped %d events whose date is not in the document text", dropped_dates
        )
    merged.sort(key=lambda e: (e.when, e.title))
    return merged


@dataclass
class _Place:
    name: str
    query: str
    role: str
    citations: list[dict[str, object]]


_ROLE_RANK = {
    "crime_scene": 0,
    "witness_location": 1,
    "evidence_location": 2,
    "suspect_location": 3,
}


_GENERIC = {
    "police",
    "station",
    "hospital",
    "court",
    "depot",
    "hotel",
    "shop",
    "flat",
    "well",
    "kiln",
    "road",
    "laboratory",
    "lab",
    "bench",
    "judge",
    "outpost",
    "house",
    "residence",
    "building",
    "the",
    "a",
    "an",
    "of",
    "at",
    "near",
    "where",
    "ward",
    "office",
    "market",
    "area",
    "site",
    "trial",
    "division",
    "high",
    "referenced",
    "defence",
    "adjoining",
    "second",
    "floor",
}


def _specific_tokens(name: str) -> set[str]:
    return {
        t
        for t in re.findall(r"[a-z0-9]+", name.lower())
        if t not in _GENERIC and len(t) > 1
    }


def _same_place(p: _Place, name: str, tokens: set[str], role: str) -> bool:
    if fuzz.token_set_ratio(p.name, name) >= 88:
        return True
    pt = _specific_tokens(p.name)
    # "Kiln Nala" / "brick kiln": same role and one name's specific words contain the other's
    return bool(tokens and pt and (tokens <= pt or pt <= tokens) and p.role == role)


def _merge_places(
    raw: list[tuple[_Chunk, ChunkPlace]], pages: dict[tuple[str, int], str]
) -> list[_Place]:
    merged: list[_Place] = []
    for chunk, pl in raw:
        name = pl.name.strip()
        if not name:
            continue
        has_query = bool(pl.geocode_query.strip())
        tokens = _specific_tokens(name)
        if not tokens and not has_query:
            continue  # "the hospital" / "police station": nothing to put on a map
        quote = pl.quote.strip()
        verified = bool(quote) and _norm(quote) in _norm(
            pages.get((chunk.file_id, pl.page), "")
        )
        citation = {
            "file_id": chunk.file_id,
            "locator": f"page:{pl.page}",
            "excerpt": quote if verified else "",
        }

        dup = next((p for p in merged if _same_place(p, name, tokens, pl.role)), None)
        if dup:
            if len(name) > len(dup.name) and len(name) <= 80:
                dup.name = name
            if pl.geocode_query and len(pl.geocode_query) > len(dup.query):
                dup.query = pl.geocode_query.strip()
            if _ROLE_RANK.get(pl.role, 9) < _ROLE_RANK.get(dup.role, 9):
                dup.role = pl.role
            if citation not in dup.citations and len(dup.citations) < 6:
                dup.citations.append(citation)
            continue
        merged.append(_Place(name[:500], pl.geocode_query.strip(), pl.role, [citation]))
    return merged


def _spread_stacked(places: list[_Place], coords: list[dict[str, float] | None]) -> int:
    """Fan out places that geocoded to the very same point so each pin is clickable.

    When a document names several places in one town without street addresses, the
    geocoder returns the town centre for all of them. They are laid out on a small
    spiral (~100-700 m) around that point; positions are approximate.
    """
    import math

    groups: dict[tuple[float, float], list[int]] = {}
    for i, c in enumerate(coords):
        if c is not None:
            groups.setdefault((round(c["lat"], 4), round(c["lng"], 4)), []).append(i)
    moved = 0
    for (lat, lng), idxs in groups.items():
        if len(idxs) < 2:
            continue
        for rank, i in enumerate(sorted(idxs, key=lambda i: places[i].name.lower())):
            if rank == 0:
                continue
            radius = 0.0011 * math.ceil(math.sqrt(rank))  # ~120 m per ring
            angle = rank * 2.399963
            coords[i] = {
                "lat": lat + radius * math.sin(angle),
                "lng": lng
                + radius * math.cos(angle) / max(math.cos(math.radians(lat)), 0.2),
            }
            moved += 1
    return moved


def _km_between(a: dict[str, float], b: tuple[float, float]) -> float:
    """Great-circle distance in km between a coordinate dict and a (lat, lng) pair."""
    lat1, lng1, lat2, lng2 = map(math.radians, (a["lat"], a["lng"], b[0], b[1]))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 12742.0 * math.asin(math.sqrt(h))


async def _keep_in_case_area(
    places: list[_Place],
    coords: list[dict[str, float] | None],
    geocode: Callable[..., Awaitable[dict[str, float] | None]],
    region_of: Callable[[tuple[float, float]], Awaitable[str]],
    settings: Settings,
) -> list[dict[str, float] | None]:
    """Pull ambiguous place names back to the area the case is about.

    A town name that exists in several regions can geocode anywhere. The case area
    is where most of its places resolve (the median); places resolved far from it
    are looked up again as "<place>, <the area's own locality and state>", and dropped
    (left without coordinates) if they still land far away.
    """
    found = [c for c in coords if c is not None]
    if len(found) < 3:
        return coords
    center = (
        statistics.median(c["lat"] for c in found),
        statistics.median(c["lng"] for c in found),
    )
    limit = settings.geocode_outlier_km
    region = await region_of(center)
    fixed = list(coords)
    moved = dropped = 0
    for i, (place, c) in enumerate(zip(places, coords, strict=True)):
        if c is not None and _km_between(c, center) <= limit:
            continue
        retry = await geocode(place, center, region)
        if retry is not None and _km_between(retry, center) <= limit:
            fixed[i] = retry
            moved += 1
        else:
            fixed[i] = None
            dropped += c is not None
    if moved or dropped:
        logger.info(
            "Geocoding: %d places re-resolved near the case area, %d dropped as "
            "outside it (>%.0f km)",
            moved,
            dropped,
            limit,
        )
    return fixed


async def build_case_chronology(
    case_id: str, workflow_id: UUID, db: AsyncSession
) -> dict[str, int]:
    """Extract events + places from every case file and replace the stored timeline and map."""
    settings = get_settings()
    cid = UUID(case_id)
    started = time.monotonic()

    files = list(
        (await db.execute(select(CaseFile).where(CaseFile.case_id == cid)))
        .scalars()
        .all()
    )
    if not files:
        return {"events": 0, "locations": 0, "paths": 0, "unmappable": 0}

    # 1. documents -> text (concurrent, cached) -> page map and chunks
    texts = await asyncio.gather(
        *(file_to_text(f, settings.gcs_bucket or "") for f in files)
    )
    pages: dict[tuple[str, int], str] = {}
    docs: dict[str, str] = {}
    chunks: list[_Chunk] = []
    contexts: dict[str, str] = {}
    for f, text in zip(files, texts, strict=True):
        fid = str(f.id)
        docs[fid] = text
        for page, body in _split_pages(text):
            pages[(fid, page)] = body
        contexts[fid] = "Document header: " + re.sub(
            r"\s+", " ", (_split_pages(text)[0][1])[:400]
        )
        chunks.extend(_chunks_for_file(fid, f.original_filename, text))
    chunks = chunks[: settings.timeline_max_chunks]

    # 2. chunks -> events/places, in parallel over every (key, model) lane
    lanes = get_lanes()
    logger.info(
        "Chronology for case=%s: %d files, %d chunks, %d lanes (%d keys x %d models)",
        case_id,
        len(files),
        len(chunks),
        len(lanes.lanes),
        len({lane.key for lane in lanes.lanes}),
        len({lane.model for lane in lanes.lanes}),
    )
    stats = {"rate_limited": 0, "failed_chunks": 0, "rate_limit_wait": 0}
    queue: asyncio.Queue[_Chunk] = asyncio.Queue()
    for c in chunks:
        queue.put_nowait(c)
    raw_events: list[tuple[_Chunk, ChunkEvent]] = []
    raw_places: list[tuple[_Chunk, ChunkPlace]] = []
    done = 0

    async def worker() -> None:
        nonlocal done
        while True:
            try:
                chunk = queue.get_nowait()
            except asyncio.QueueEmpty:
                return
            for res in await _extract_chunk(
                chunk, contexts[chunk.file_id], lanes, stats
            ):
                raw_events.extend((chunk, e) for e in res.events)
                raw_places.extend((chunk, p) for p in res.places)
            done += 1
            if done % 5 == 0 or done == len(chunks):
                logger.info(
                    "Chronology case=%s: %d/%d chunks done", case_id, done, len(chunks)
                )

    await asyncio.gather(*(worker() for _ in range(max(len(lanes.lanes), 1))))

    if chunks and stats["failed_chunks"] == len(chunks):
        # nothing could be read: keep the existing timeline and map instead of wiping them
        if stats["rate_limit_wait"]:
            raise RateLimited(stats["rate_limit_wait"])
        raise RuntimeError("The model could not read any part of the documents.")

    events = _merge_events(raw_events, pages, docs)
    places = _merge_places(raw_places, pages)

    # 3. geocode places concurrently
    geocoder: GeocodingService | None
    try:
        geocoder = GeocodingService()
    except ValueError:
        geocoder = None
        logger.warning("No Google Maps key: places are stored without coordinates")
    sem = asyncio.Semaphore(8)

    async def geocode(
        p: _Place, near: tuple[float, float] | None = None, region: str = ""
    ) -> dict[str, float] | None:
        if geocoder is None:
            return None
        async with sem:
            named = f"{p.name}, {region}" if region else ""
            for query in dict.fromkeys(q for q in (named, p.query, p.name) if q):
                coords = await geocoder.geocode_address(
                    query, near=near, bias_km=settings.geocode_bias_km
                )
                if coords:
                    return coords
        return None

    coords = await asyncio.gather(*(geocode(p) for p in places))

    async def region_of(center: tuple[float, float]) -> str:
        """Locality, state and country of the case area, from its centre point."""
        if geocoder is None:
            return ""
        address = await geocoder.reverse_geocode(*center)
        return ", ".join(address.split(", ")[-3:]) if address else ""

    coords = await _keep_in_case_area(places, coords, geocode, region_of, settings)
    spread = _spread_stacked(places, coords)
    if spread:
        logger.info("Fanned out %d places that shared one geocoded point", spread)

    # 4. replace the case's stored timeline + locations
    await db.execute(delete(TimelineEvent).where(TimelineEvent.case_id == cid))
    await db.execute(delete(Location).where(Location.case_id == cid))

    event_rows: list[tuple[_Event, TimelineEvent]] = []
    for e in events:
        approx = "" if e.exact else "Approximate date. "
        row = TimelineEvent(
            case_id=cid,
            workflow_id=workflow_id,
            title=e.title,
            description=(approx + e.description).strip() or None,
            event_date=e.when,
            event_type=e.category,
            layer=_LAYER.get(e.category, "strategy"),
            citations=e.citations,
        )
        db.add(row)
        event_rows.append((e, row))

    unmappable = 0
    for p, c in zip(places, coords, strict=True):
        linked = [
            {
                "type": "event",
                "title": e.title,
                "description": e.description,
                "timestamp": e.when.isoformat(),
                "layer": _LAYER.get(e.category, "strategy"),
                "confidence": 0.8,
            }
            for e, _ in event_rows
            if e.location and fuzz.partial_token_set_ratio(e.location, p.name) >= 85
        ]
        if linked:
            stamps = sorted(item["timestamp"] for item in linked)
            linked.append({"type": "period", "start": stamps[0], "end": stamps[-1]})
        if c is None:
            unmappable += 1
        db.add(
            Location(
                case_id=cid,
                workflow_id=workflow_id,
                name=p.name,
                coordinates=c,
                location_type=_PIN_TYPE.get(p.role, "other"),
                citations=p.citations,
                temporal_associations=linked or None,
            )
        )
    await db.flush()

    counts = {
        "events": len(events),
        "locations": len(places),
        "paths": 0,
        "unmappable": unmappable,
    }
    logger.info(
        "Chronology case=%s done in %.0fs: %s (rate-limit waits=%d, failed chunks=%d)",
        case_id,
        time.monotonic() - started,
        counts,
        stats["rate_limited"],
        stats["failed_chunks"],
    )
    return counts
