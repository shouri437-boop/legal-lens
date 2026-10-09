# ABOUTME: Application configuration using pydantic-settings.
# ABOUTME: Loads settings from environment variables with type validation.

import os
import re
from functools import cached_property
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root is two levels up from this file (backend/app/config.py -> project root)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ROOT_ENV = _PROJECT_ROOT / ".env"
_BACKEND_ENV = _PROJECT_ROOT / "backend" / ".env"

# Load .env files into os.environ so third-party libs (ADK, LiteLLM, GCS)
# that read env vars directly will find them.
# override=False: real env vars always take precedence over .env values.
# Backend .env loaded first (higher priority), then root .env as fallback.
load_dotenv(_BACKEND_ENV, override=False)
load_dotenv(_ROOT_ENV, override=False)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # NOTE: Kept optional so tooling (like OpenAPI/type generation) can import
    # the app without requiring runtime secrets. Runtime validation happens
    # during application startup.
    database_url: str | None = None
    cors_origins_raw: str = ""
    debug: bool = False
    sql_echo: bool = False
    gcs_bucket: str | None = None
    # Local-disk evidence storage, used when gcs_bucket is not set
    local_storage_path: str = "storage"
    # Public URL of this backend (used to build local file download links)
    backend_url: str = "http://localhost:8080"
    frontend_url: str = "http://localhost:3000"  # For JWKS endpoint
    # Service account email for signing GCS URLs when using user credentials locally
    # For Cloud Run with workload identity, this is auto-detected from metadata
    gcs_signing_service_account: str | None = None

    # Development API key for testing via Swagger UI (only works when debug=True)
    # Set DEV_API_KEY in .env to enable API testing without frontend auth
    dev_api_key: str | None = None

    # Local-only: skip authentication entirely and act as the dev user (needs debug=True)
    auth_disabled: bool = False

    # --- ADK / Groq configuration ---
    # API key for Groq (agents run through ADK's LiteLLM wrapper; also used for
    # Whisper transcription and image description of uploaded evidence)
    groq_api_key: str | None = None
    # Extra keys, comma- or newline-separated (GROQ_API_KEYS). With several keys each
    # agent gets its own key and a rate-limited key is skipped in favour of another.
    # Groq limits are per ORGANIZATION: keys from the same account share one allowance.
    groq_api_keys: str | None = None
    # GCS bucket for ADK artifact storage; falls back to gcs_bucket if not set
    adk_artifacts_bucket: str | None = None
    # Application name for ADK session namespacing
    adk_app_name: str = "legal-lens"
    # LiteLLM model IDs ("groq/" prefix routes to Groq). The "flash" role is used
    # for triage, geospatial and chat; the "pro" role for the reasoning agents.
    # Pro and Flash are different models on purpose: Groq's free tier gives each model
    # its own 8,000 tokens/minute allowance, so splitting agents across two models
    # doubles throughput. Set PRO_MODEL=groq/openai/gpt-oss-20b to use one fast model.
    flash_model: str = "groq/openai/gpt-oss-20b"
    pro_model: str = "groq/openai/gpt-oss-120b"
    # Model for the fast document RAG analysis (one call per request)
    rag_model: str = "groq/openai/gpt-oss-20b"
    # Max characters of retrieved passages per RAG request. Groq's free tier rejects any
    # request over 8,000 tokens (~14k chars of passages leaves room for prompt + answer);
    # raise this on a paid tier.
    rag_max_context_chars: int = 14_000
    # Raw Groq model IDs (no "groq/" prefix) for the direct SDK calls that turn
    # non-text evidence into text before it reaches the agents.
    vision_model: str = "qwen/qwen3.8-27b"
    stt_model: str = "whisper-large-v3-turbo"
    # Reasoning effort for gpt-oss agents: minimal | low | medium | high
    # ("minimal" is sent to Groq as "low", its lowest setting).
    thinking_level: str = "low"
    # Evidence-to-text conversion limits
    # PDF pages with fewer extracted characters than this are treated as scanned
    # and sent to the vision model (up to ocr_max_pages_per_file pages per file).
    pdf_min_text_chars_per_page: int = 80
    ocr_max_pages_per_file: int = 10
    # Parallelism: PDFs with at least pdf_parallel_min_pages pages are read by
    # pdf_workers processes; scanned pages are OCR'd ocr_concurrency at a time.
    pdf_workers: int = 4
    pdf_parallel_min_pages: int = 40
    ocr_concurrency: int = 4
    # Combined characters of file text sent to an agent in ONE request (0 = no limit).
    # Groq's free tier rejects any request over 8,000 tokens in total, and each agent's
    # prompt + schema already takes 3-6k, so documents are sent as excerpts. On a paid
    # Groq tier set AGENT_TEXT_BUDGET_CHARS=0 to send whole documents.
    agent_text_budget_chars: int = 6000
    # Case chronology (timeline + map) builder: documents are cut into ~6k-char chunks,
    # extracted in parallel over every (Groq key x model) lane. groq_tpm_limit is the
    # tokens-per-minute allowance of ONE key+model (8000 on Groq's free tier).
    timeline_max_chunks: int = 80
    groq_tpm_limit: int = 8000
    # Models the shared Groq scheduler spreads calls over (comma-separated LiteLLM IDs,
    # GROQ_LANE_MODELS). Groq meters every model separately, so more models = more
    # throughput. Empty = the distinct FLASH_MODEL, PRO_MODEL and RAG_MODEL.
    # Places geocoded farther than this from where most of a case's places resolve are
    # re-resolved biased toward that area (within geocode_bias_km); if they still land
    # farther away they are left off the map instead of being pinned in another region.
    # Per-request timeout for Google geocoding (a dead connection must not hang a build),
    # and the overall limit for building a case's timeline and map.
    geocode_timeout_seconds: float = 15.0
    chronology_timeout_seconds: float = 1200.0
    # An event's date must agree with the date written next to its quote in the document:
    # the nearest date mentioned up to this many characters before the quote (or one
    # inside it / this many characters after it) must be the event's date.
    timeline_date_lookback_chars: int = 700
    timeline_date_lookahead_chars: int = 100
    geocode_outlier_km: float = 150.0
    geocode_bias_km: float = 60.0
    groq_lane_models: str = ""
    # Rough characters per token, used to estimate how many tokens a request will use.
    groq_chars_per_token: float = 3.2
    # How long a call may wait for Groq capacity before failing with a clear error
    # (a daily-quota 429 asks for minutes to hours; waiting that long is not useful).
    groq_max_wait_seconds: float = 120.0
    # Attempts per call (rate limits and schema rejections both count).
    groq_max_attempts: int = 14
    # Completion-token cap for the RAG calls; counted against the per-minute limit.
    rag_max_output_tokens: int = 3500
    # Hard cap on characters of extracted text handed to the agents per file
    max_chars_per_file: int = 150_000
    # Groq's upload limit for transcription (bytes); larger audio is skipped
    stt_max_bytes: int = 25_000_000

    # --- Agent execution configuration ---
    max_parse_retries: int = 1
    confidence_threshold: int = 40
    routing_confidence_threshold: int = 40
    routing_hitl_threshold_legal: int = 50
    routing_hitl_threshold_evidence: int = 20
    routing_hitl_threshold_strategy: int = 40

    # --- Pipeline stage timeouts (seconds) ---
    pipeline_timeout_triage: int = 600
    pipeline_timeout_orchestrator: int = 300
    pipeline_timeout_domain_agents: int = 900
    pipeline_timeout_strategy: int = 300
    pipeline_timeout_overall: int = 1800  # 30 minutes

    # --- SSE / Real-time configuration ---
    # Heartbeat interval for SSE connections to keep alive on Cloud Run (per REQ-INF-004)
    sse_heartbeat_interval_seconds: float = 15.0
    # Maximum time to wait for HITL confirmation before timing out (0 = no timeout)
    confirmation_timeout_seconds: float = 3600.0  # 1 hour

    @property
    def groq_keys(self) -> list[str]:
        """All configured Groq keys (GROQ_API_KEYS first, then GROQ_API_KEY), deduplicated."""
        raw = [*re.split(r"[,\s]+", self.groq_api_keys or ""), self.groq_api_key or ""]
        return list(dict.fromkeys(k for k in raw if k))

    model_config = SettingsConfigDict(
        # Look for .env in backend/ first, then project root (absolute paths)
        env_file=(_BACKEND_ENV, _ROOT_ENV),
        case_sensitive=False,
        # Map CORS_ORIGINS env var to cors_origins_raw field
        env_prefix="",
        extra="ignore",
    )

    @classmethod
    def model_customise_sources(
        cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        """Customize settings sources."""
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
        )

    @cached_property
    def cors_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated or JSON string.

        Automatically includes frontend_url if set and not the localhost default.
        """
        value = self.cors_origins_raw.strip()
        origins: list[str] = []

        if value:
            # Try JSON array first
            if value.startswith("["):
                try:
                    import json

                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        origins = [str(o).strip() for o in parsed if str(o).strip()]
                except Exception:
                    pass
            # Fall back to comma-separated
            if not origins:
                origins = [o.strip() for o in value.split(",") if o.strip()]

        # Auto-include frontend_url for production CORS
        if self.frontend_url and self.frontend_url not in origins:
            origins.append(self.frontend_url)

        return origins

    def get_routing_hitl_threshold(self, agent_type: str) -> int:
        """Return the HITL routing confidence threshold for a given agent type.

        Per-agent thresholds allow conservative agents (legal) to
        require more frequent human review than liberal agents (evidence).
        Falls back to the global routing_confidence_threshold for unknown types.
        """
        _thresholds: dict[str, int] = {
            "legal": self.routing_hitl_threshold_legal,
            "evidence": self.routing_hitl_threshold_evidence,
            "strategy": self.routing_hitl_threshold_strategy,
        }
        return _thresholds.get(agent_type, self.routing_confidence_threshold)


def _ensure_adk_env(s: Settings) -> None:
    """Sync derived env vars that LiteLLM reads directly from os.environ.

    Called once after Settings is first created so that values computed from
    the typed settings object are visible to litellm / groq.
    """
    if s.groq_keys:
        os.environ.setdefault("GROQ_API_KEY", s.groq_keys[0])


_settings: Settings | None = None


def get_settings() -> Settings:
    """Get cached settings instance.

    This keeps module imports side-effect free (important for tooling, tests,
    and OpenAPI generation) while still using environment-driven configuration.
    """

    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore[call-arg]
        _ensure_adk_env(_settings)
    return _settings


# Backwards-compatible import style.
settings = get_settings()
