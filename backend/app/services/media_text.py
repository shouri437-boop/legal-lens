# ABOUTME: Converts uploaded evidence (PDF, image, audio, video, text) into plain text for Groq agents.
# ABOUTME: Groq chat models are text-only, so PDFs get page markers, audio gets timestamps, images get descriptions.

from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import shutil
import subprocess
import tempfile
from collections import OrderedDict
from concurrent.futures import ProcessPoolExecutor
from typing import Any

import fitz  # PyMuPDF
from google.cloud import storage  # type: ignore[import-untyped,attr-defined]
from groq import AsyncGroq, RateLimitError

from app.config import get_settings
from app.groq_keys import get_pool, mask
from app.local_storage import read_local, use_local_storage
from app.models.file import CaseFile
from app.services import _pdf_worker

logger = logging.getLogger(__name__)

# Groq vision accepts images up to 4 MB (base64-encoded) and 33 megapixels.
_IMAGE_MAX_BYTES = 3_000_000
_IMAGE_MAX_SIDE = 2048
_VISION_RETRIES = 6

_CACHE_MAX = 64
_cache: OrderedDict[tuple[str, int], str] = OrderedDict()
_clients: dict[str, AsyncGroq] = {}

_OCR_PROMPT = (
    "This is one page of a legal evidence document. Transcribe ALL text visible on "
    "the page verbatim, preserving reading order, tables (as plain text rows) and "
    "numbers exactly. Then, on a new line starting with 'VISUALS:', briefly note any "
    "non-text content (stamps, signatures, handwriting, logos, photos). "
    "Do not add commentary."
)

_IMAGE_PROMPT = (
    "This image is evidence in a legal investigation. 1) Transcribe any visible text "
    "verbatim. 2) Describe the scene objectively: people, objects, setting, "
    "visible dates, signage, damage or anything that looks edited or out of place. "
    "State only what is visible; do not speculate about identities."
)


def _groq(key: str | None = None) -> AsyncGroq:
    """Client for ``key`` (or the next pooled key); one client per key."""
    key = key or get_pool().next_key()
    if not key:
        raise RuntimeError("GROQ_API_KEY is not configured")
    if key not in _clients:
        _clients[key] = AsyncGroq(api_key=key)
    return _clients[key]


async def _groq_call(agent: str, model: str, call):
    """Run ``call(client)`` on this task's Groq key, switching key or waiting on 429.

    ``agent`` picks the preferred key ("vision" / "stt"); the cooldown is tracked
    per (key, model) because Groq meters each model separately.
    """
    pool = get_pool()
    key = pool.choose(pool.key_for_agent(agent), model)
    for attempt in range(_VISION_RETRIES):
        try:
            return await call(_groq(key))
        except RateLimitError as exc:
            if attempt == _VISION_RETRIES - 1:
                raise
            hint = exc.response.headers.get("retry-after") if exc.response else None
            delay = min(float(hint) if hint else 2.0**attempt, 30.0) + 0.25
            if key:
                pool.learn_org(key, str(exc))
                pool.mark_limited(key, model, delay)
            other = pool.alternative(key, model)
            if other:
                logger.warning(
                    "Groq rate limit on %s (key %s); switching to key %s",
                    model,
                    mask(key),
                    mask(other),
                )
                key = other
                continue
            await asyncio.sleep(delay)
            key = pool.choose(pool.key_for_agent(agent), model)
    raise RuntimeError("unreachable")


# ---------------------------------------------------------------------------
# Raw bytes
# ---------------------------------------------------------------------------


async def read_file_bytes(gcs_bucket: str, storage_path: str) -> bytes:
    """Download a stored file from local storage or GCS."""
    if use_local_storage():
        return await read_local(storage_path)
    client = storage.Client()
    blob = client.bucket(gcs_bucket).blob(storage_path)
    return await asyncio.to_thread(blob.download_as_bytes)


# ---------------------------------------------------------------------------
# Vision (images and scanned PDF pages)
# ---------------------------------------------------------------------------


async def _describe_image(image_bytes: bytes, mime_type: str, prompt: str) -> str:
    """One vision call, retrying on Groq rate limits using the server's retry hint."""
    data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    ]
    model = get_settings().vision_model
    response = await _groq_call(
        "vision",
        model,
        lambda client: client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            max_tokens=2048,
        ),
    )
    return (response.choices[0].message.content or "").strip()


def _shrink_image(data: bytes) -> tuple[bytes, str]:
    """Downscale/re-encode an image so it fits Groq's vision limits."""
    from PIL import Image

    with Image.open(io.BytesIO(data)) as src:
        img = src.convert("RGB")
    img.thumbnail((_IMAGE_MAX_SIDE, _IMAGE_MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue(), "image/jpeg"


def _exif_summary(data: bytes) -> str:
    """Return EXIF tags (camera, timestamps, GPS) as text, or '' if none."""
    try:
        from PIL import ExifTags, Image

        with Image.open(io.BytesIO(data)) as img:
            exif = img.getexif()
            if not exif:
                return ""
            lines: list[str] = []
            for tag_id, value in exif.items():
                name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if name in {"MakerNote", "PrintImageMatching"} or isinstance(
                    value, bytes
                ):
                    continue
                lines.append(f"{name}: {value}")
            gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
            for tag_id, value in gps.items():
                lines.append(f"GPS {ExifTags.GPSTAGS.get(tag_id, tag_id)}: {value}")
            return "\n".join(lines)
    except Exception:
        return ""


async def _image_to_text(data: bytes, mime_type: str) -> str:
    exif = _exif_summary(data)
    payload, mime = data, mime_type
    if len(data) > _IMAGE_MAX_BYTES or mime_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    }:
        payload, mime = await asyncio.to_thread(_shrink_image, data)
    description = await _describe_image(payload, mime, _IMAGE_PROMPT)
    parts = [f"[Image description]\n{description}"]
    if exif:
        parts.append(f"[EXIF metadata]\n{exif}")
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------


_pool: ProcessPoolExecutor | None = None
_ocr_sem: asyncio.Semaphore | None = None


def _get_pool() -> ProcessPoolExecutor:
    global _pool
    if _pool is None:
        workers = max(1, min(get_settings().pdf_workers, os.cpu_count() or 1))
        _pool = ProcessPoolExecutor(max_workers=workers)
    return _pool


async def warm_pool() -> None:
    """Start the PDF worker processes now so the first upload is not slowed by it."""
    settings = get_settings()
    if settings.pdf_workers < 2:
        return
    loop = asyncio.get_running_loop()
    try:
        await asyncio.gather(
            *(
                loop.run_in_executor(_get_pool(), _pdf_worker.ping)
                for _ in range(settings.pdf_workers)
            )
        )
    except Exception as exc:
        logger.warning("PDF worker pool warm-up failed: %s", exc)


def _page_count(data: bytes) -> int:
    with fitz.open(stream=data, filetype="pdf") as doc:
        return doc.page_count


def _split(n: int, parts: int) -> list[tuple[int, int]]:
    size = -(-n // parts)  # ceil
    return [(i, min(i + size, n)) for i in range(0, n, size)]


async def extract_pdf_pages(data: bytes) -> list[str]:
    """Plain text of every page, extracted in parallel across worker processes.

    Small documents are read in one thread (process start-up would cost more
    than it saves); larger ones are split into page ranges, one per worker.
    Falls back to a single in-process read if the pool is unavailable.
    """
    settings = get_settings()
    n = await asyncio.to_thread(_page_count, data)
    if n < settings.pdf_parallel_min_pages or settings.pdf_workers < 2:
        return await asyncio.to_thread(_pdf_worker.extract_text, data, 0, n)
    loop = asyncio.get_running_loop()
    try:
        batches = _split(n, settings.pdf_workers)
        parts = await asyncio.gather(
            *(
                loop.run_in_executor(_get_pool(), _pdf_worker.extract_text, data, s, e)
                for s, e in batches
            )
        )
    except Exception as exc:
        logger.warning("Parallel PDF extraction failed (%s); reading serially", exc)
        return await asyncio.to_thread(_pdf_worker.extract_text, data, 0, n)
    return [text for part in parts for text in part]


async def _render_pages(data: bytes, indexes: list[int], dpi: int = 110) -> list[bytes]:
    """PNG renders of the given pages, split across worker processes."""
    workers = get_settings().pdf_workers
    if len(indexes) < 4 or workers < 2:
        return await asyncio.to_thread(_pdf_worker.render_png, data, indexes, dpi)
    loop = asyncio.get_running_loop()
    try:
        chunks = [indexes[s:e] for s, e in _split(len(indexes), workers)]
        parts = await asyncio.gather(
            *(
                loop.run_in_executor(_get_pool(), _pdf_worker.render_png, data, c, dpi)
                for c in chunks
            )
        )
    except Exception as exc:
        logger.warning("Parallel page rendering failed (%s); rendering serially", exc)
        return await asyncio.to_thread(_pdf_worker.render_png, data, indexes, dpi)
    return [png for part in parts for png in part]


async def _ocr_page(png: bytes) -> str | None:
    """Vision-OCR one page image, bounded by a shared concurrency limit."""
    global _ocr_sem
    if _ocr_sem is None:
        _ocr_sem = asyncio.Semaphore(get_settings().ocr_concurrency)
    async with _ocr_sem:
        try:
            return await _describe_image(png, "image/png", _OCR_PROMPT)
        except Exception as exc:
            logger.warning("OCR failed for a scanned PDF page: %s", exc)
            return None


async def _pdf_to_text(data: bytes) -> str:
    settings = get_settings()
    raw = await extract_pdf_pages(data)
    texts = [t.strip() for t in raw]

    # Pages with (almost) no text layer are scanned: render and OCR them in
    # parallel, up to a per-file budget.
    scanned_idx = [
        i for i, t in enumerate(texts) if len(t) < settings.pdf_min_text_chars_per_page
    ][: settings.ocr_max_pages_per_file]
    ocr_done = 0
    if scanned_idx:
        pngs = await _render_pages(data, scanned_idx)
        results = await asyncio.gather(*(_ocr_page(png) for png in pngs))
        for i, ocr in zip(scanned_idx, results, strict=True):
            if ocr:
                ocr_done += 1
                texts[i] = f"{texts[i]}\n{ocr}".strip() if texts[i] else ocr

    header = f"[PDF document, {len(texts)} pages]"
    if ocr_done:
        header += f" [{ocr_done} scanned page(s) transcribed by vision OCR]"
    body = "\n\n".join(
        f"=== Page {i} ===\n{t if t else '(no extractable text)'}"
        for i, t in enumerate(texts, start=1)
    )
    return f"{header}\n\n{body}"


# ---------------------------------------------------------------------------
# Audio / video
# ---------------------------------------------------------------------------


def _ffmpeg_to_mp3(data: bytes, suffix: str) -> bytes | None:
    """Extract a small mono 16 kHz audio track with ffmpeg (None if unavailable)."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return None
    fd_in, src = tempfile.mkstemp(suffix=suffix or ".bin")
    fd_out, dst = tempfile.mkstemp(suffix=".mp3")
    os.close(fd_in)
    os.close(fd_out)
    try:
        with open(src, "wb") as f:
            f.write(data)
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                src,
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-b:a",
                "48k",
                dst,
            ],
            check=True,
            capture_output=True,
        )
        with open(dst, "rb") as f:
            return f.read()
    except subprocess.CalledProcessError as exc:
        logger.warning("ffmpeg failed: %s", exc.stderr[-300:] if exc.stderr else exc)
        return None
    finally:
        for path in (src, dst):
            if os.path.exists(path):
                os.unlink(path)


def _get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _fmt_ts(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


async def _transcribe(data: bytes, filename: str) -> str:
    model = get_settings().stt_model
    response = await _groq_call(
        "stt",
        model,
        lambda client: client.audio.transcriptions.create(
            file=(filename, data),
            model=model,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
            temperature=0.0,
        ),
    )
    segments = _get(response, "segments") or []
    if not segments:
        return (_get(response, "text") or "").strip()
    return "\n".join(
        f"[{_fmt_ts(float(_get(seg, 'start', 0.0)))}] {str(_get(seg, 'text', '')).strip()}"
        for seg in segments
    )


async def _audio_to_text(
    data: bytes, filename: str, mime_type: str, *, is_video: bool
) -> str:
    kind = "Video" if is_video else "Audio"
    suffix = "." + filename.rsplit(".", 1)[1].lower() if "." in filename else ""
    limit = get_settings().stt_max_bytes

    payload, name = data, filename
    if is_video or len(data) > limit:
        mp3 = await asyncio.to_thread(_ffmpeg_to_mp3, data, suffix)
        if mp3 is None:
            if is_video:
                return (
                    "[Video file: the audio track could not be extracted because "
                    "ffmpeg is not installed, so no transcript is available. "
                    "Visual content is not analysed.]"
                )
            return (
                f"[Audio file is {len(data) // 1_000_000} MB, over the "
                f"{limit // 1_000_000} MB transcription limit, and ffmpeg is not "
                "installed to compress it, so no transcript is available.]"
            )
        payload, name = mp3, "audio.mp3"

    if len(payload) > limit:
        return (
            f"[{kind} file is too long to transcribe in one request "
            f"({len(payload) // 1_000_000} MB after compression).]"
        )
    transcript = await _transcribe(payload, name)
    note = " (audio track only; visuals not analysed)" if is_video else ""
    return f"[{kind} transcript{note} -- timestamps are MM:SS]\n{transcript or '(no speech detected)'}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _is_text_like(mime_type: str, filename: str) -> bool:
    return (
        mime_type.startswith("text/")
        or mime_type in {"application/json", "application/xml", "application/csv"}
        or filename.lower().endswith((".txt", ".md", ".csv", ".json", ".xml", ".log"))
    )


async def _convert(file: CaseFile, gcs_bucket: str) -> str:
    data = await read_file_bytes(gcs_bucket, file.storage_path)
    mime = file.mime_type or ""
    name = file.original_filename

    if mime == "application/pdf" or name.lower().endswith(".pdf"):
        return await _pdf_to_text(data)
    if mime.startswith("image/"):
        return await _image_to_text(data, mime)
    if mime.startswith("audio/"):
        return await _audio_to_text(data, name, mime, is_video=False)
    if mime.startswith("video/"):
        return await _audio_to_text(data, name, mime, is_video=True)
    if _is_text_like(mime, name):
        return data.decode("utf-8", errors="replace")
    return f"[Unsupported file type '{mime}': content could not be converted to text.]"


async def file_to_text(file: CaseFile, gcs_bucket: str) -> str:
    """Return the text an agent should read for ``file`` (cached per file)."""
    key = (file.storage_path, file.size_bytes)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    try:
        text = await _convert(file, gcs_bucket)
    except Exception as exc:
        logger.exception("Could not convert %s to text", file.original_filename)
        return f"[Could not convert this file to text: {type(exc).__name__}: {exc}]"

    limit = get_settings().max_chars_per_file
    if len(text) > limit:
        text = (
            text[:limit] + f"\n\n[... truncated: {len(text) - limit} more characters]"
        )

    _cache[key] = text
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return text
