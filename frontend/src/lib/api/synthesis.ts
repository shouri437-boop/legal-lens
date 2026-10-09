// ABOUTME: API client functions for all synthesis endpoints (hypotheses, contradictions, gaps, tasks, synthesis).
// ABOUTME: Uses the shared api client for JWT auth; query params for optional filters.

import { api, ApiError } from "@/lib/api-client";
import type {
  SynthesisResponse,
  HypothesisResponse,
  ContradictionResponse,
  GapResponse,
  TaskResponse,
} from "@/types/synthesis";

/**
 * Fetch the latest synthesis summary for a case.
 * Returns null if no synthesis exists yet (404).
 */
export async function fetchSynthesis(
  caseId: string,
): Promise<SynthesisResponse | null> {
  try {
    return await api.get<SynthesisResponse>(`/api/cases/${caseId}/synthesis`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetch hypotheses for a case with optional status filter.
 * @param status - Filter by PENDING, SUPPORTED, or REFUTED
 */
export async function fetchHypotheses(
  caseId: string,
  status?: string,
): Promise<HypothesisResponse[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();
  const url = `/api/cases/${caseId}/hypotheses${qs ? `?${qs}` : ""}`;
  return api.get<HypothesisResponse[]>(url);
}

/**
 * Fetch contradictions for a case with optional severity filter.
 * @param severity - Filter by minor, significant, or critical
 */
export async function fetchContradictions(
  caseId: string,
  severity?: string,
): Promise<ContradictionResponse[]> {
  const params = new URLSearchParams();
  if (severity) params.set("severity", severity);
  const qs = params.toString();
  const url = `/api/cases/${caseId}/contradictions${qs ? `?${qs}` : ""}`;
  return api.get<ContradictionResponse[]>(url);
}

/**
 * Fetch evidence gaps for a case with optional priority filter.
 * @param priority - Filter by low, medium, high, or critical
 */
export async function fetchGaps(
  caseId: string,
  priority?: string,
): Promise<GapResponse[]> {
  const params = new URLSearchParams();
  if (priority) params.set("priority", priority);
  const qs = params.toString();
  const url = `/api/cases/${caseId}/gaps${qs ? `?${qs}` : ""}`;
  return api.get<GapResponse[]>(url);
}

/**
 * Fetch investigation tasks for a case with optional filters.
 * @param taskType - Filter by task type (e.g. resolve_contradiction)
 * @param status - Filter by pending, in_progress, completed, dismissed
 */
export async function fetchTasks(
  caseId: string,
  taskType?: string,
  status?: string,
): Promise<TaskResponse[]> {
  const params = new URLSearchParams();
  if (taskType) params.set("task_type", taskType);
  if (status) params.set("status", status);
  const qs = params.toString();
  const url = `/api/cases/${caseId}/tasks${qs ? `?${qs}` : ""}`;
  return api.get<TaskResponse[]>(url);
}
