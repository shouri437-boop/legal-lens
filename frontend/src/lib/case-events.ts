// ABOUTME: Custom DOM events for cross-component case data synchronization.
// ABOUTME: Allows child pages (e.g. library) to notify parent layout of case data changes.

const CASE_DATA_CHANGED_EVENT = "case-data-changed";
const ANALYSIS_RESET_EVENT = "analysis-reset";

/**
 * Dispatch when case-related data changes (file uploads, deletions, etc.)
 * so parent components can refetch stale case data.
 */
export function emitCaseDataChanged(): void {
  window.dispatchEvent(new CustomEvent(CASE_DATA_CHANGED_EVENT));
}

/**
 * Subscribe to case data change events. Returns an unsubscribe function.
 */
export function onCaseDataChanged(callback: () => void): () => void {
  window.addEventListener(CASE_DATA_CHANGED_EVENT, callback);
  return () => window.removeEventListener(CASE_DATA_CHANGED_EVENT, callback);
}

/**
 * Dispatch when a new analysis workflow starts. Consumers (e.g. useAgentStates)
 * should clear accumulated state from previous runs.
 */
export function emitAnalysisReset(): void {
  window.dispatchEvent(new CustomEvent(ANALYSIS_RESET_EVENT));
}

/**
 * Subscribe to analysis reset events. Returns an unsubscribe function.
 */
export function onAnalysisReset(callback: () => void): () => void {
  window.addEventListener(ANALYSIS_RESET_EVENT, callback);
  return () => window.removeEventListener(ANALYSIS_RESET_EVENT, callback);
}
