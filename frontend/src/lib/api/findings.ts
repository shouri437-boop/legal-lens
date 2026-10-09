// ABOUTME: API client functions for case findings endpoints.
// ABOUTME: Fetches finding lists and individual finding details.

import { api } from "@/lib/api-client";
import type { FindingListResponse, FindingResponse } from "@/types/findings";

/**
 * Fetch a paginated list of findings for a case.
 * Backend limit range: 1-200 (default 50).
 */
export async function listFindings(
  caseId: string,
  limit: number = 200,
  offset: number = 0,
): Promise<FindingListResponse> {
  return api.get<FindingListResponse>(
    `/api/cases/${caseId}/findings?limit=${limit}&offset=${offset}`,
  );
}

/** Fetch a single finding by ID. */
export async function getFinding(
  caseId: string,
  findingId: string,
): Promise<FindingResponse> {
  return api.get<FindingResponse>(`/api/cases/${caseId}/findings/${findingId}`);
}
