// ABOUTME: Shared formatting utilities for duration, numbers, and time display.
// ABOUTME: Centralizes formatting logic used across Command Center components.

/**
 * Format milliseconds into a human-readable duration string.
 * Under 1 second: "Xms", under 60 seconds: "X.Xs", above: "Xm Ys"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a number with locale-appropriate thousand separators.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format an ISO timestamp string to a localized time string.
 * Returns original string if parsing fails.
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleTimeString();
}

/** Known model ID → friendly display name mappings (Groq via LiteLLM, plus legacy Gemini runs). */
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "groq/openai/gpt-oss-120b": "GPT-OSS 120B (Groq)",
  "groq/openai/gpt-oss-20b": "GPT-OSS 20B (Groq)",
  "groq/qwen/qwen3.8-27b": "Qwen 3.8 27B (Groq)",
  "gemini-3-pro-preview": "Gemini 3 Pro",
  "gemini-3-flash-preview": "Gemini 3 Flash",
  "gemini-2.5-pro-preview-05-06": "Gemini 2.5 Pro",
  "gemini-2.5-flash-preview-05-20": "Gemini 2.5 Flash",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
};

/**
 * Format a raw model ID into a human-friendly display name.
 * Returns a known mapping if available, otherwise strips "-preview"
 * suffixes and title-cases the remaining segments.
 */
export function formatModelName(modelId: string): string {
  if (!modelId) return "Unknown Model";

  const known = MODEL_DISPLAY_NAMES[modelId];
  if (known) return known;

  // Fallback: strip provider prefix and trailing "-preview" variants, then title-case
  const cleaned = modelId.replace(/^.*\//, "").replace(/-preview.*$/, "");
  return cleaned
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

// -----------------------------------------------------------------------
// Agent instance label helpers
// -----------------------------------------------------------------------

/**
 * Derive a human-readable instance label from a compound agent ID.
 *
 * Compound IDs follow the convention `<baseType>_<suffix>` where suffix is
 * one of: `grp_N` (grouped files) or `ungrouped_N` (standalone file).
 *
 * Returns `null` for singleton agents where `instanceId === baseType`.
 *
 * @example
 *   formatInstanceLabel("legal_grp_0", "financial")     // "Group 1"
 *   formatInstanceLabel("legal_ungrouped_2", "legal") // "File 3"
 *   formatInstanceLabel("legal", "legal")                     // null
 */
export function formatInstanceLabel(
  instanceId: string,
  baseType: string,
): string | null {
  if (instanceId === baseType) return null;

  // Remove the base type prefix + underscore
  const suffix = instanceId.slice(baseType.length + 1);

  // Match "grp_N" pattern
  const grpMatch = suffix.match(/^grp_(\d+)$/);
  if (grpMatch) {
    return `Group ${Number(grpMatch[1]) + 1}`;
  }

  // Match "ungrouped_N" pattern
  const ungroupedMatch = suffix.match(/^ungrouped_(\d+)$/);
  if (ungroupedMatch) {
    return `File ${Number(ungroupedMatch[1]) + 1}`;
  }

  // Fallback: humanize the suffix
  return suffix.replace(/_/g, " ");
}

/**
 * Determine whether a compound instance ID represents a file group
 * (multiple files processed together) vs an ungrouped single file.
 */
export function isGroupInstance(instanceId: string, baseType: string): boolean {
  if (instanceId === baseType) return false;
  const suffix = instanceId.slice(baseType.length + 1);
  return suffix.startsWith("grp_");
}
