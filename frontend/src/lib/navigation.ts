// ABOUTME: Client-side navigation utilities for auth flows.
// ABOUTME: Provides hard redirect for post-auth navigation to ensure server-side validation.

/**
 * Perform a hard redirect (full page reload) to the specified path.
 * Use this instead of Next.js router.push() after authentication changes
 * to ensure server-side session validation runs fresh with new cookies.
 */
export function hardRedirect(path: string): void {
  window.location.href = path;
}
