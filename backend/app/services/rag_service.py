# ABOUTME: Fast document RAG: local PDF text extraction, page-aware chunking, BM25 retrieval,
# ABOUTME: and a single Groq call that returns a cited analysis. Every quote is verified against its page.

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

import litellm
from pydantic import BaseModel, Field

from app.config import get_settings
from app.groq_keys import is_rate_limit, is_request_too_large, retry_after_seconds
from app.groq_lanes import estimate_tokens, get_lanes
from app.llm_schema import strict_response_format, supports_json_schema
from app.local_storage import local_path, read_local, use_local_storage, write_local
from app.services.media_text import extract_pdf_pages

logger = logging.getLogger(__name__)

CHUNK_CHARS = 1000
CHUNK_OVERLAP = 150
TOP_K_PER_FACET = 5
MAX_CONTEXT_CHUNKS = 30
ASK_TOP_K = 8
MIN_TEXT_CHARS_PER_PAGE = 80  # below this we treat the PDF as scanned

_STOPWORDS = frozenset(
    "a an and are as at be been by for from has have he her his in is it its of on or "
    "that the their them there they this to was were which who will with would not no".split()
)


# ---------------------------------------------------------------------------
# Index
# ---------------------------------------------------------------------------


@dataclass
class Chunk:
    file_id: str
    file_name: str
    page: int
    text: str
    tokens: list[str] = field(default_factory=list)


@dataclass
class DocIndex:
    signature: tuple[str, ...]
    pages: dict[tuple[str, int], str]  # (file_id, page) -> page text
    file_names: dict[str, str]
    chunks: list[Chunk]
    scanned_files: list[str]
    _df: Counter[str] = field(default_factory=Counter)
    _avg_len: float = 0.0

    def finalize(self) -> None:
        for c in self.chunks:
            self._df.update(set(c.tokens))
        self._avg_len = sum(len(c.tokens) for c in self.chunks) / max(
            len(self.chunks), 1
        )

    def search(self, query: str, k: int) -> list[Chunk]:
        """BM25 ranking of chunks for a query."""
        q = _tokenize(query)
        if not q or not self.chunks:
            return []
        n = len(self.chunks)
        k1, b = 1.5, 0.75
        scored: list[tuple[float, int]] = []
        for i, c in enumerate(self.chunks):
            tf = Counter(c.tokens)
            dl = len(c.tokens) or 1
            score = 0.0
            for term in set(q):
                f = tf.get(term, 0)
                if not f:
                    continue
                df = self._df.get(term, 0)
                idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
                score += (
                    idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / self._avg_len))
                )
            if score > 0:
                scored.append((score, i))
        scored.sort(reverse=True)
        return [self.chunks[i] for _, i in scored[:k]]


def _tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]


def _norm(text: str) -> str:
    return re.sub(r"[\W_]+", "", text.lower())


def _chunk_page(text: str) -> list[str]:
    text = re.sub(r"[ \t]+", " ", text).strip()
    if len(text) <= CHUNK_CHARS:
        return [text] if text else []
    out, start = [], 0
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))
        if end < len(text):
            cut = text.rfind(" ", start + CHUNK_CHARS // 2, end)
            end = cut if cut != -1 else end
        out.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return out


async def _read_bytes(storage_path: str) -> bytes:
    if use_local_storage():
        return await read_local(storage_path)
    from google.cloud import storage  # type: ignore[import-untyped,attr-defined]

    settings = get_settings()

    def _download() -> bytes:
        blob = storage.Client().bucket(settings.gcs_bucket).blob(storage_path)
        return blob.download_as_bytes()

    return await asyncio.to_thread(_download)


_index_cache: dict[str, DocIndex] = {}


def forget_case(case_id: str) -> None:
    """Drop the in-memory page index for a case (used when the case is deleted)."""
    _index_cache.pop(case_id, None)


async def build_index(case_id: str, files: list[tuple[str, str, str]]) -> DocIndex:
    """Build (or reuse) the page/chunk index. ``files`` = (file_id, file_name, storage_path)."""
    signature = tuple(sorted(f[0] for f in files))
    cached = _index_cache.get(case_id)
    if cached and cached.signature == signature:
        return cached

    pages: dict[tuple[str, int], str] = {}
    names: dict[str, str] = {}
    chunks: list[Chunk] = []
    scanned: list[str] = []

    async def read_pages(storage_path: str) -> list[str]:
        return await extract_pdf_pages(await _read_bytes(storage_path))

    # Read every file concurrently (download + parallel page extraction)
    all_pages = await asyncio.gather(*(read_pages(f[2]) for f in files))

    for (file_id, name, _), page_texts in zip(files, all_pages, strict=True):
        names[file_id] = name
        total_chars = sum(len(p.strip()) for p in page_texts)
        if total_chars < MIN_TEXT_CHARS_PER_PAGE * max(len(page_texts), 1):
            scanned.append(file_id)
        for i, text in enumerate(page_texts, start=1):
            pages[(file_id, i)] = text
            for piece in _chunk_page(text):
                chunks.append(Chunk(file_id, name, i, piece, _tokenize(piece)))

    index = DocIndex(signature, pages, names, chunks, scanned)
    index.finalize()
    _index_cache[case_id] = index
    return index


# ---------------------------------------------------------------------------
# Structured output models
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    file: str = Field(description="File label such as F1")
    page: int = Field(description="1-indexed page number")
    quote: str = Field(
        description="Short verbatim excerpt (under 200 characters) copied from that page"
    )


class Fact(BaseModel):
    text: str
    citations: list[Citation]


class Event(BaseModel):
    date: str
    event: str
    citations: list[Citation]


class Issue(BaseModel):
    issue: str
    analysis: str
    citations: list[Citation]


class Party(BaseModel):
    name: str
    role: str


class Analysis(BaseModel):
    summary: str
    parties: list[Party]
    key_facts: list[Fact]
    timeline: list[Event]
    legal_issues: list[Issue]
    outcome: Fact
    contradictions: list[Fact]
    gaps: list[str]


class Answer(BaseModel):
    answer: str
    answerable: bool
    citations: list[Citation]


FACETS = {
    "parties": "parties accused appellant respondent petitioner complainant witness informant name",
    "facts": "facts incident occurred allegation prosecution case FIR deceased date place recovery",
    "timeline": "date dated year month on occurred filed registered arrested decided judgment order",
    "issues": "issue question of law contention argument submitted learned counsel section act held",
    "holding": "held court concluded judgment order acquitted convicted dismissed allowed appeal sentence set aside",
    "conflicts": "contradiction inconsistent discrepancy however denied contrary version improbable",
    "gaps": "not proved failed absence no evidence missing not produced not recovered not examined doubt",
}

ANALYSIS_PROMPT = """You are a legal analyst. Analyse the case documents using ONLY the passages below.

Rules:
- Every factual claim must carry at least one citation: the file label, the page number and a SHORT VERBATIM quote
  (under 200 characters, copied exactly from the passage on that page).
- Never invent facts, names, dates, sections or citations. If something is not in the passages, leave it out
  or say it is not stated.
- Contradictions: report conflicting statements neutrally. Do not decide who is right.
- gaps: things the passages show are missing or unproven (plain sentences, no citations needed).
- Be detailed and specific, but concise. Return JSON matching the schema.

Files:
{legend}

Passages:
{passages}
"""

ASK_PROMPT = """Answer the question using ONLY the passages below. Cite every claim with the file label, page number
and a SHORT VERBATIM quote (under 200 characters) copied exactly from the passage. If the passages do not answer the
question, set answerable=false and say "The evidence does not say." Do not guess.

Files:
{legend}

Passages:
{passages}

Question: {question}
"""


def _format_passages(chunks: list[Chunk], labels: dict[str, str]) -> str:
    return "\n\n".join(f"[{labels[c.file_id]} p.{c.page}]\n{c.text}" for c in chunks)


async def _generate(prompt: str, schema: type[BaseModel]) -> Any:
    """One JSON-mode Groq call, validated against ``schema``."""
    settings = get_settings()
    lanes = get_lanes()
    schema_text = json.dumps(schema.model_json_schema(), separators=(",", ":"))
    instruction = (
        "Respond with a single valid JSON object and nothing else, conforming to "
        "this JSON Schema (include every required field):\n" + schema_text
    )
    # Tokens this request will count against a model's per-minute allowance.
    need = (
        estimate_tokens(len(prompt) + len(instruction)) + settings.rag_max_output_tokens
    )

    # Models that accept json_schema constrain decoding to the schema (no schema text
    # needed in the prompt); anything else, or a rejected schema, uses plain JSON mode
    # with the schema spelled out in the prompt.
    strict = True
    last_error: Exception | None = None
    for _ in range(settings.groq_max_attempts):
        lane, entry = await lanes.acquire(need, settings.groq_max_wait_seconds)
        use_schema = strict and supports_json_schema(lane.model)
        messages = [{"role": "user", "content": prompt}]
        if use_schema:
            response_format = strict_response_format(schema, schema.__name__)
        else:
            response_format = {"type": "json_object"}
            messages.insert(0, {"role": "system", "content": instruction})
        try:
            response = await litellm.acompletion(
                model=lane.model,
                messages=messages,
                response_format=response_format,
                temperature=0.2,
                max_completion_tokens=settings.rag_max_output_tokens,
                reasoning_effort="low" if "gpt-oss" in lane.model else None,
                drop_params=True,
                api_key=lane.key,
                num_retries=0,
            )
            usage = getattr(response, "usage", None)
            lanes.settle(lane, entry, getattr(usage, "total_tokens", None))
            return schema.model_validate_json(response.choices[0].message.content or "")
        except Exception as exc:
            last_error = exc
            text = str(exc)
            lanes.settle(lane, entry, 0)  # nothing was spent
            if is_rate_limit(exc):
                lanes.penalize(lane, text, retry_after_seconds(text) or 5.0)
                continue
            if is_request_too_large(text):
                raise
            logger.warning(
                "RAG call failed on %s (%s): %s",
                lane.model,
                response_format["type"],
                text[:200],
            )
            strict = False
    assert last_error is not None
    raise last_error


def _context_budget(schema: type[BaseModel], fixed_chars: int) -> int:
    """Characters of retrieved passages that still fit one request's token allowance.

    The per-minute limit covers prompt + schema + answer, so passages get what is
    left after those; ``rag_max_context_chars`` stays as an upper bound.
    """
    s = get_settings()
    fixed = fixed_chars + len(json.dumps(schema.model_json_schema()))
    free_tokens = s.groq_tpm_limit - s.rag_max_output_tokens - estimate_tokens(fixed)
    fits = int(max(free_tokens, 0) * s.groq_chars_per_token)
    return max(min(s.rag_max_context_chars, fits), CHUNK_CHARS)


def _verify(
    citations: list[Citation],
    index: DocIndex,
    label_to_file: dict[str, str],
    stats: dict[str, int],
) -> list[dict[str, Any]]:
    """Keep only citations whose quote really appears on the cited page."""
    out = []
    for c in citations:
        stats["total"] += 1
        file_id = label_to_file.get(c.file.strip().upper())
        page_text = index.pages.get((file_id, c.page)) if file_id else None
        q = _norm(c.quote)
        if page_text is not None and q and q in _norm(page_text):
            stats["verified"] += 1
            out.append(
                {
                    "file_id": file_id,
                    "file_name": index.file_names[file_id],
                    "page": c.page,
                    "quote": c.quote.strip(),
                }
            )
    return out


def _labels(index: DocIndex) -> tuple[dict[str, str], dict[str, str], str]:
    file_to_label = {fid: f"F{i}" for i, fid in enumerate(index.file_names, start=1)}
    label_to_file = {v: k for k, v in file_to_label.items()}
    legend = "\n".join(
        f"{lab} = {index.file_names[fid]}" for fid, lab in file_to_label.items()
    )
    return file_to_label, label_to_file, legend


def _verify_tree(
    obj: Any, index: DocIndex, label_to_file: dict[str, str], stats: dict[str, int]
) -> Any:
    if isinstance(obj, dict):
        if "citations" in obj and isinstance(obj["citations"], list):
            obj["citations"] = _verify(
                [Citation(**c) for c in obj["citations"]], index, label_to_file, stats
            )
        for k, v in obj.items():
            if k != "citations":
                obj[k] = _verify_tree(v, index, label_to_file, stats)
    elif isinstance(obj, list):
        return [_verify_tree(v, index, label_to_file, stats) for v in obj]
    return obj


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _cache_path(case_id: str) -> str:
    return f"cases/{case_id}/rag_analysis.json"


def load_cached_analysis(case_id: str) -> dict[str, Any] | None:
    path = local_path(_cache_path(case_id))
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


async def analyze(case_id: str, files: list[tuple[str, str, str]]) -> dict[str, Any]:
    started = time.perf_counter()
    index = await build_index(case_id, files)
    t_index = time.perf_counter()
    if index.scanned_files and len(index.scanned_files) == len(files):
        raise ValueError(
            "These PDFs have no extractable text (they look scanned). OCR is not supported yet."
        )

    file_to_label, label_to_file, legend = _labels(index)

    selected: dict[int, Chunk] = {}
    for facet_query in FACETS.values():
        for c in index.search(facet_query, TOP_K_PER_FACET):
            selected[id(c)] = c
    for c in index.chunks[:2]:  # the caption / opening usually names the parties
        selected[id(c)] = c
    order = {id(c): i for i, c in enumerate(index.chunks)}
    # Keep the most relevant passages (selection order = relevance order) that fit
    # the context budget, then present them in document order.
    budget = _context_budget(Analysis, len(ANALYSIS_PROMPT) + len(legend))
    kept: list[Chunk] = []
    used = 0
    for c in selected.values():
        if len(kept) >= MAX_CONTEXT_CHUNKS or used + len(c.text) > budget:
            continue
        kept.append(c)
        used += len(c.text)
    chunks = sorted(kept, key=lambda c: order[id(c)])

    prompt = ANALYSIS_PROMPT.format(
        legend=legend, passages=_format_passages(chunks, file_to_label)
    )
    t_retrieve = time.perf_counter()
    parsed = await _generate(prompt, Analysis)
    t_llm = time.perf_counter()

    data = parsed.model_dump()
    stats = {"total": 0, "verified": 0}
    data = _verify_tree(data, index, label_to_file, stats)

    result = {
        "analysis": data,
        "meta": {
            "model": get_settings().rag_model,
            "files": [{"id": f, "name": n} for f, n in index.file_names.items()],
            "pages_total": len(index.pages),
            "chunks_indexed": len(index.chunks),
            "chunks_used": len(chunks),
            "citations_total": stats["total"],
            "citations_verified": stats["verified"],
            "latency_ms": {
                "index": round((t_index - started) * 1000),
                "retrieve": round((t_retrieve - t_index) * 1000),
                "llm": round((t_llm - t_retrieve) * 1000),
                "total": round((time.perf_counter() - started) * 1000),
            },
        },
    }
    write_local(_cache_path(case_id), json.dumps(result).encode("utf-8"))
    return result


async def ask(
    case_id: str, files: list[tuple[str, str, str]], question: str
) -> dict[str, Any]:
    started = time.perf_counter()
    index = await build_index(case_id, files)
    file_to_label, label_to_file, legend = _labels(index)
    chunks = index.search(question, ASK_TOP_K)
    t_retrieve = time.perf_counter()
    if not chunks:
        return {
            "answer": "The evidence does not say.",
            "answerable": False,
            "citations": [],
            "meta": {
                "chunks_used": 0,
                "latency_ms": {"total": round((t_retrieve - started) * 1000)},
            },
        }

    prompt = ASK_PROMPT.format(
        legend=legend,
        passages=_format_passages(chunks, file_to_label),
        question=question,
    )
    parsed = await _generate(prompt, Answer)
    data = parsed.model_dump()
    stats = {"total": 0, "verified": 0}
    data["citations"] = _verify(parsed.citations, index, label_to_file, stats)
    if parsed.answerable and not data["citations"]:
        # An answer with no verifiable source is not allowed to stand.
        data["answer"] = "The evidence does not say."
        data["answerable"] = False
    data["meta"] = {
        "chunks_used": len(chunks),
        "citations_total": stats["total"],
        "citations_verified": stats["verified"],
        "latency_ms": {
            "retrieve": round((t_retrieve - started) * 1000),
            "total": round((time.perf_counter() - started) * 1000),
        },
    }
    return data
