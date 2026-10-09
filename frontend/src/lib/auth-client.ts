// ABOUTME: Authentication is disabled locally; API calls rely on the backend's AUTH_DISABLED dev mode.
// ABOUTME: getToken keeps its signature for the API modules but never returns a token.

export async function getToken(): Promise<string | null> {
  return null;
}
