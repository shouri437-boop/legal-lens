# ABOUTME: Shared parsing helpers for extracting structured data from ADK events.
# ABOUTME: Used by all pipeline agents for JSON extraction, token usage, thinking traces, and structured output parsing.

import json
import logging

from google.adk.events import Event
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


def _attempt_json_repair(text: str) -> str:
    """Best-effort repair of truncated JSON by trimming to the last closing brace.

    LLMs sometimes truncate JSON output mid-string (e.g., "Unterminated string").
    This attempts to salvage valid JSON by stripping trailing incomplete content.
    The caller still validates with json.loads(), so corrupt data cannot slip through.

    Args:
        text: Raw JSON candidate string, possibly truncated.

    Returns:
        Repaired text if a trailing `}` was found, otherwise the original text.
    """
    stripped = text.rstrip()
    if stripped.endswith("}"):
        return stripped
    last_brace = stripped.rfind("}")
    if last_brace == -1:
        return text
    return stripped[: last_brace + 1]


def extract_json_from_text(text: str) -> str | None:
    """Extract JSON from model response text, handling markdown code fences.

    Tolerates missing closing fences — if the model opens a code block
    but never closes it, everything after the opening fence is used.
    Applies best-effort repair for truncated JSON before returning.
    """
    # Try ```json fence first, then bare ``` fence
    for fence in ("```json", "```"):
        pos = text.find(fence)
        if pos == -1:
            continue
        start = pos + len(fence)
        end = text.find("```", start)
        # No closing fence — take everything after the opening fence
        candidate = text[start:end].strip() if end != -1 else text[start:].strip()
        if candidate:
            return _attempt_json_repair(candidate)

    # Try the whole text as JSON
    text = text.strip()
    if text.startswith("{"):
        return _attempt_json_repair(text)

    return None


def extract_token_usage(events: list[Event]) -> tuple[int, int]:
    """Accumulate token usage across all events.

    Returns:
        Tuple of (input_tokens, output_tokens).
    """
    input_tokens = 0
    output_tokens = 0
    for event in events:
        if event.usage_metadata:
            if event.usage_metadata.prompt_token_count:
                input_tokens += event.usage_metadata.prompt_token_count
            if event.usage_metadata.candidates_token_count:
                output_tokens += event.usage_metadata.candidates_token_count
    return input_tokens, output_tokens


def extract_thinking_traces(events: list[Event]) -> list[dict[str, object]]:
    """Extract thinking traces from events for audit logging."""
    traces: list[dict[str, object]] = []
    for event in events:
        if not event.content or not event.content.parts:
            continue
        for part in event.content.parts:
            if part.thought and part.text:
                traces.append(
                    {
                        "agent": event.author,
                        "thought": part.text[:2000],  # Cap individual thoughts
                        "timestamp": event.timestamp,
                    }
                )
    return traces


def format_thinking_traces(traces: list[object] | None) -> str:
    """Join thinking trace entries into a display-friendly string.

    Handles both dict entries (from extract_thinking_traces) and raw values.
    Normalizes JSON-structured thoughts to readable text — some models
    with thinking enabled sometimes produce JSON-formatted deliberation
    (especially with multimodal inputs) rather than natural language.

    Args:
        traces: List of thinking trace dicts or raw values from DB.

    Returns:
        Joined thinking text, empty string if no traces.
    """
    if not traces:
        return ""

    parts: list[str] = []
    for trace in traces:
        thought = trace.get("thought", "") if isinstance(trace, dict) else str(trace)
        if not thought:
            continue
        parts.append(_normalize_thought_text(thought))

    return "\n".join(parts)


def _normalize_thought_text(text: str) -> str:
    """Normalize a single thought string for readable display.

    If the text is a JSON object (common with multimodal thinking),
    extracts string values with key labels for readability.
    Non-JSON text is returned unchanged.
    """
    stripped = text.strip()
    if not stripped.startswith("{"):
        return text
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            extracted = _flatten_json_to_text(parsed)
            if extracted:
                return extracted
    except (json.JSONDecodeError, ValueError):
        pass
    return text


def _flatten_json_to_text(data: object) -> str:
    """Recursively extract readable text from a JSON structure.

    Dict string values get key labels (e.g., "title: Some Title").
    Nested dicts are flattened. Lists get bullet prefixes.
    """
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        parts: list[str] = []
        for key, value in data.items():
            extracted = _flatten_json_to_text(value)
            if not extracted:
                continue
            # Label leaf string values with their key for context
            if isinstance(value, str):
                parts.append(f"{key}: {extracted}")
            else:
                parts.append(extracted)
        return "\n".join(parts)
    if isinstance(data, list):
        parts = []
        for item in data:
            extracted = _flatten_json_to_text(item)
            if extracted:
                parts.append(f"- {extracted}")
        return "\n".join(parts)
    return ""


def extract_response_texts(events: list[Event]) -> list[str]:
    """Extract non-thought text parts from the final response event.

    Scans events in reverse to find the last final response, then returns
    all non-thought text parts. Thinking/reasoning parts (part.thought=True)
    are internal model deliberation and are excluded — use
    extract_thinking_traces() for those.

    Returns:
        List of response text strings, empty if no response found.
    """
    for event in reversed(events):
        if not event.is_final_response():
            continue
        if not event.content or not event.content.parts:
            continue
        texts = [
            part.text for part in event.content.parts if part.text and not part.thought
        ]
        if texts:
            return texts
    return []


def extract_structured_json[OutputT: BaseModel](
    events: list[Event],
    output_type: type[OutputT],
    agent_name: str,
) -> OutputT | None:
    """Parse structured output from ADK events into a Pydantic model.

    Generic replacement for per-agent parse functions (parse_legal_output,
    parse_legal_output, etc.). Delegates event traversal to
    extract_response_texts() so that thinking parts are excluded,
    then parses the response text as JSON.

    Args:
        events: List of ADK events from runner execution.
        output_type: Pydantic model class to validate against.
        agent_name: Agent name for log messages.

    Returns:
        Parsed output model instance, or None if parsing fails.
    """
    response_texts = extract_response_texts(events)
    if not response_texts:
        logger.error("No response text found for %s", agent_name)
        return None

    for text in response_texts:
        json_str = extract_json_from_text(text)
        if json_str is None:
            continue
        try:
            data = json.loads(json_str)
            return output_type.model_validate(data)
        except (json.JSONDecodeError, ValueError, ValidationError) as exc:
            logger.warning(
                "Failed to parse %s output JSON: %s",
                agent_name,
                exc,
            )
            continue

    logger.error("No valid %s output found in agent events", agent_name)
    return None
