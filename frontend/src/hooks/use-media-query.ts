// ABOUTME: Custom hook for responsive design media query detection.
// ABOUTME: Returns boolean indicating if viewport matches the specified breakpoint.

"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Hook to detect if viewport matches a media query.
 * Uses useSyncExternalStore for proper external subscription handling.
 * Returns false during SSR to avoid hydration mismatch.
 *
 * @param query - CSS media query string (e.g., "(min-width: 1024px)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", callback);
      return () => mediaQuery.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Predefined breakpoint hooks matching Tailwind defaults.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}
