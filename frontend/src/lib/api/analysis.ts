// ABOUTME: API client for starting analysis workflows on cases.
// ABOUTME: Uses shared api client for JWT-authenticated requests.

import { api, ApiError } from "@/lib/api-client";

export type AnalysisMode = "uploaded_only" | "rerun_all";

export interface AnalysisStartResponse {
  workflow_id: string;
  case_id: string;
  files_queued: number;
  message: string;
}

export async function startAnalysis(
  caseId: string,
  mode: AnalysisMode = "uploaded_only",
): Promise<AnalysisStartResponse> {
  return api.post<AnalysisStartResponse>(`/api/cases/${caseId}/analyze`, {
    mode,
  });
}

export { ApiError };
