// ABOUTME: React Query hooks for all synthesis API endpoints.
// ABOUTME: Provides loading/error/data states with 30s stale time for synthesis, hypotheses, contradictions, gaps, and tasks.

import { useQuery } from "@tanstack/react-query";

import {
  fetchSynthesis,
  fetchHypotheses,
  fetchContradictions,
  fetchGaps,
  fetchTasks,
} from "@/lib/api/synthesis";

/**
 * Fetch the latest synthesis summary for a case.
 * Returns null data if no synthesis exists yet.
 */
export function useSynthesis(caseId: string) {
  return useQuery({
    queryKey: ["synthesis", caseId],
    queryFn: () => fetchSynthesis(caseId),
    staleTime: 30_000,
    retry: 1,
    enabled: !!caseId,
  });
}

/**
 * Fetch hypotheses for a case, ordered by confidence descending.
 * @param status - Optional filter: PENDING, SUPPORTED, REFUTED
 */
export function useHypotheses(caseId: string, status?: string) {
  return useQuery({
    queryKey: ["hypotheses", caseId, status],
    queryFn: () => fetchHypotheses(caseId, status),
    staleTime: 30_000,
    retry: 1,
    enabled: !!caseId,
  });
}

/**
 * Fetch contradictions for a case, ordered by severity (critical first).
 * @param severity - Optional filter: minor, significant, critical
 */
export function useContradictions(caseId: string, severity?: string) {
  return useQuery({
    queryKey: ["contradictions", caseId, severity],
    queryFn: () => fetchContradictions(caseId, severity),
    staleTime: 30_000,
    retry: 1,
    enabled: !!caseId,
  });
}

/**
 * Fetch evidence gaps for a case, ordered by priority (critical first).
 * @param priority - Optional filter: low, medium, high, critical
 */
export function useGaps(caseId: string, priority?: string) {
  return useQuery({
    queryKey: ["gaps", caseId, priority],
    queryFn: () => fetchGaps(caseId, priority),
    staleTime: 30_000,
    retry: 1,
    enabled: !!caseId,
  });
}

/**
 * Fetch investigation tasks for a case, ordered by priority then creation date.
 * @param taskType - Optional filter by task type
 * @param status - Optional filter: pending, in_progress, completed, dismissed
 */
export function useTasks(caseId: string, taskType?: string, status?: string) {
  return useQuery({
    queryKey: ["tasks", caseId, taskType, status],
    queryFn: () => fetchTasks(caseId, taskType, status),
    staleTime: 30_000,
    retry: 1,
    enabled: !!caseId,
  });
}
