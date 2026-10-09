# ABOUTME: Process-pool workers for PDF page extraction and rendering.
# ABOUTME: Imports only PyMuPDF so worker processes start fast; must stay free of app imports.

import fitz  # PyMuPDF


def extract_text(data: bytes, start: int, end: int) -> list[str]:
    """Plain text of pages ``start`` (inclusive) to ``end`` (exclusive), 0-indexed."""
    with fitz.open(stream=data, filetype="pdf") as doc:
        return [doc[i].get_text("text") for i in range(start, end)]


def render_png(data: bytes, indexes: list[int], dpi: int) -> list[bytes]:
    """PNG bytes for the given 0-indexed pages."""
    with fitz.open(stream=data, filetype="pdf") as doc:
        return [doc[i].get_pixmap(dpi=dpi).tobytes("png") for i in indexes]


def ping() -> bool:
    """No-op used to start worker processes ahead of the first real request."""
    return True
