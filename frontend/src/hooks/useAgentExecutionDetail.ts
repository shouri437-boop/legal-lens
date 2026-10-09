// ABOUTME: React Query hook for fetching full agent execution detail by ID.
// ABOUTME: Enables rich data display in the Command Center sidebar via the REST execution endpoint.

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface ExecutionDetailResponse {
  id: string;
  agent_name: string;
  model_name: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  thinking_traces: Array<Record<string, unknown>> | null;
}

/**
 * Fetch full execution data (output_data, input_data, thinking_traces)
 * for a given execution ID. Data is immutable once the agent completes,
 * so a generous staleTime avoids unnecessary refetches.
 */
export function useAgentExecutionDetail(executionId: string | undefined) {
  return useQuery<ExecutionDetailResponse>({
    queryKey: ["agent-execution-detail", executionId],
    queryFn: () =>
      api.get<ExecutionDetailResponse>(`/api/agents/executions/${executionId}`),
    enabled: !!executionId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}
