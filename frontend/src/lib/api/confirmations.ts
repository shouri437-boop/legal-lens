// ABOUTME: API client for sending HITL confirmation responses (approve/reject).
// ABOUTME: Posts decisions to the backend confirmation endpoint to unblock agent pipelines.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface ConfirmationResponse {
  status: string;
  approved: boolean;
}

export interface BatchDecision {
  item_id: string;
  approved: boolean;
  reason?: string;
}

export interface BatchConfirmationResponse {
  status: string;
  resolved_count: number;
}

/**
 * Shared POST helper for confirmation endpoints.
 * Handles error extraction from response body and JSON parsing.
 */
async function postConfirmation<T>(
  url: string,
  body: Record<string, unknown>,
  errorPrefix: string,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errorBody = await res.json();
      if (errorBody.detail) {
        errorDetail = errorBody.detail;
      }
    } catch {
      // Ignore JSON parse errors on error response
    }
    throw new Error(`${errorPrefix}: ${errorDetail}`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error("Invalid response from server");
  }
}

/**
 * Send a confirmation response (approve or reject) for a pending agent action.
 * Unblocks the backend pipeline waiting on user decision.
 */
export async function respondToConfirmation(
  caseId: string,
  requestId: string,
  approved: boolean,
  reason?: string,
): Promise<ConfirmationResponse> {
  return postConfirmation<ConfirmationResponse>(
    `${API_URL}/api/cases/${caseId}/confirmations/${requestId}`,
    { approved, reason },
    "Confirmation failed",
  );
}

/**
 * Send batch confirmation decisions for a set of pending agent actions.
 * Each item in the batch can be individually approved or rejected.
 */
export async function respondToBatchConfirmation(
  caseId: string,
  batchId: string,
  decisions: BatchDecision[],
): Promise<BatchConfirmationResponse> {
  return postConfirmation<BatchConfirmationResponse>(
    `${API_URL}/api/cases/${caseId}/confirmations/batch/${batchId}`,
    { decisions },
    "Batch confirmation failed",
  );
}
