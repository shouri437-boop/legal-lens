// ABOUTME: sessionStorage cache for agent states to bridge the visibility gap between
// ABOUTME: SSE events and backend DB commits during browser refresh.

import type { AgentState, AgentStatus } from "@/types/command-center";

const CACHE_KEY_PREFIX = "legal-lens:agent-states:";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Cache data types (serialization-friendly — no Date objects, no Map/Set)
// ---------------------------------------------------------------------------

/** Lightweight snapshot of an agent's task, with ISO string dates. */
interface CachedTask {
  taskId: string;
  fileId: string;
  fileName: string;
  startedAt: string; // ISO 8601
  status: "processing";
}

/** Lightweight snapshot of a single agent's state. */
interface CachedAgentEntry {
  status: AgentStatus;
  currentTask?: CachedTask;
}

/** Top-level cache payload stored in sessionStorage. */
interface AgentStateCache {
  /** Unix timestamp (ms) of when the cache was written. */
  timestamp: number;
  /** Agent states keyed by instance ID (e.g. "legal_grp_0" or "triage"). */
  agents: Record<string, CachedAgentEntry>;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Persist the current agent states to sessionStorage, keyed by instance ID.
 *
 * Only non-idle agents are stored. The payload is intentionally lightweight
 * (no lastResult, no processingHistory, no thinkingTraces) because the cache
 * is only used to bridge the gap for agents whose execution records haven't
 * been committed to the DB yet. Committed agents are fully covered by the
 * backend state snapshot.
 */
export function persistAgentStates(
  caseId: string,
  states: Map<string, AgentState>,
): void {
  const agents: Record<string, CachedAgentEntry> = {};

  for (const [instanceId, state] of states) {
    if (state.status === "idle" && !state.currentTask) continue;

    agents[instanceId] = {
      status: state.status,
      currentTask:
        state.currentTask && state.currentTask.status === "processing"
          ? {
              taskId: state.currentTask.taskId,
              fileId: state.currentTask.fileId,
              fileName: state.currentTask.fileName,
              startedAt: state.currentTask.startedAt.toISOString(),
              status: "processing",
            }
          : undefined,
    };
  }

  const cache: AgentStateCache = {
    timestamp: Date.now(),
    agents,
  };

  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + caseId, JSON.stringify(cache));
  } catch {
    // sessionStorage unavailable or quota exceeded — non-critical, degrade silently
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Result of loading the cache: validated entries keyed by instance ID. */
export interface LoadedCache {
  agents: Record<string, CachedAgentEntry>;
}

/**
 * Load and validate cached agent states for the given case.
 *
 * Returns null if:
 * - No cache exists
 * - Cache has expired (older than CACHE_TTL_MS)
 * - Cache is malformed or unparseable
 */
export function loadCachedAgentStates(caseId: string): LoadedCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + caseId);
    if (!raw) return null;

    const cache: unknown = JSON.parse(raw);
    if (!isValidCache(cache)) return null;

    if (Date.now() - cache.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY_PREFIX + caseId);
      return null;
    }

    return {
      agents: cache.agents,
    };
  } catch {
    // Malformed JSON or sessionStorage error — discard silently
    clearCachedAgentStates(caseId);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/** Remove cached agent states for the given case. */
export function clearCachedAgentStates(caseId: string): void {
  try {
    sessionStorage.removeItem(CACHE_KEY_PREFIX + caseId);
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Deserialization helpers
// ---------------------------------------------------------------------------

/**
 * Reconstruct a frontend AgentTask from a cached task entry.
 * Converts the ISO date string back to a Date object.
 */
export function deserializeCachedTask(
  cached: CachedTask,
): AgentState["currentTask"] {
  return {
    taskId: cached.taskId,
    fileId: cached.fileId,
    fileName: cached.fileName,
    startedAt: new Date(cached.startedAt),
    status: "processing",
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Type guard ensuring the parsed JSON conforms to AgentStateCache. */
function isValidCache(value: unknown): value is AgentStateCache {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.timestamp === "number" &&
    typeof obj.agents === "object" &&
    obj.agents !== null
  );
}

/**
 * Type guard validating a single cache entry has the expected shape.
 * Guards against corrupted sessionStorage data from different app versions.
 */
export function isValidCachedEntry(
  value: unknown,
): value is { status: AgentStatus; currentTask?: CachedTask } {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.status !== "string") return false;
  const validStatuses: AgentStatus[] = [
    "idle",
    "processing",
    "complete",
    "error",
  ];
  if (!validStatuses.includes(entry.status as AgentStatus)) return false;
  // currentTask is optional, but if present must have required fields
  if (entry.currentTask !== undefined) {
    if (typeof entry.currentTask !== "object" || entry.currentTask === null)
      return false;
    const task = entry.currentTask as Record<string, unknown>;
    if (
      typeof task.taskId !== "string" ||
      typeof task.fileId !== "string" ||
      typeof task.fileName !== "string" ||
      typeof task.startedAt !== "string"
    ) {
      return false;
    }
  }
  return true;
}
