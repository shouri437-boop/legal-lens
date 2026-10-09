// ABOUTME: Provides a stable per-tab identifier for de-duping BroadcastChannel events.
// ABOUTME: Uses sessionStorage so each browser tab gets a unique id.

const STORAGE_KEY = "legal-lens:tab-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateTabId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id = randomId();
    window.sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // If sessionStorage is unavailable (rare), fall back to a best-effort id.
    return randomId();
  }
}
