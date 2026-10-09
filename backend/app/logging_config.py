# ABOUTME: Centralized logging configuration with consistent pipe-delimited format.
# ABOUTME: Quiets noisy third-party loggers and overrides uvicorn formatters.

import logging
import sys

LOG_FORMAT = "%(asctime)s.%(msecs)03d | %(levelname)-8s | %(name)s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# ANSI escape sequences for terminal colouring
_RESET = "\033[0m"
_DIM = "\033[2m"

_LEVEL_COLORS: dict[int, str] = {
    logging.DEBUG: "\033[36m",  # cyan
    logging.INFO: "\033[32m",  # green
    logging.WARNING: "\033[33m",  # yellow
    logging.ERROR: "\033[31m",  # red
    logging.CRITICAL: "\033[1;31m",  # bold red
}

# Third-party loggers that are excessively verbose at INFO level
_NOISY_LOGGERS = (
    "google.adk",
    "google.auth",
    "google.auth.transport",
    "google.api_core",
    "urllib3",
    "httpcore",
    "httpx",
    "hpack",
    "grpc",
)


class _ColorFormatter(logging.Formatter):
    """Formatter that adds ANSI colours when writing to a TTY.

    Colours the level name by severity and dims the timestamp + module
    columns so the message itself stands out. Falls back to plain text
    when stderr is redirected (pipes, files, Cloud Run).
    """

    def __init__(self, *, is_tty: bool) -> None:
        super().__init__(fmt=LOG_FORMAT, datefmt=LOG_DATE_FORMAT)
        self._is_tty = is_tty

    def format(self, record: logging.LogRecord) -> str:
        if not self._is_tty:
            return super().format(record)

        # Colour the level field
        color = _LEVEL_COLORS.get(record.levelno, "")
        original_levelname = record.levelname
        record.levelname = f"{color}{record.levelname}{_RESET}"

        # Dim the timestamp and module name for visual hierarchy
        original_name = record.name
        record.name = f"{_DIM}{record.name}{_RESET}"

        formatted = super().format(record)

        # Restore originals so other handlers/filters see clean values
        record.levelname = original_levelname
        record.name = original_name

        # Dim the timestamp portion (everything before the first pipe)
        pipe_idx = formatted.index(" | ")
        formatted = f"{_DIM}{formatted[:pipe_idx]}{_RESET}{formatted[pipe_idx:]}"

        return formatted


def setup_logging(*, level: int = logging.INFO) -> None:
    """Configure the root logger with a consistent, grep-friendly format.

    Call once during application startup (lifespan). Applies the same
    formatter to all handlers including uvicorn's access and error loggers.
    Automatically enables ANSI colours when stderr is a TTY.
    """
    # Root logger
    root = logging.getLogger()
    root.setLevel(level)

    # Remove any pre-existing handlers to avoid duplicate lines
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(level)
    handler.setFormatter(
        _ColorFormatter(is_tty=hasattr(sys.stderr, "isatty") and sys.stderr.isatty())
    )
    root.addHandler(handler)

    # Quiet noisy third-party loggers
    for name in _NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)

    # Override uvicorn's own formatters so all output looks the same
    for uvicorn_logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True
