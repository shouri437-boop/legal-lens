// ABOUTME: Custom hook for managing panel collapse state with localStorage persistence
// ABOUTME: Provides independent state management for each panel with automatic persistence across page refreshes

import { useState, useEffect } from "react";

/**
 * Controller interface for panel collapse state management
 */
export interface PanelStateController {
  /** Whether the panel is currently collapsed */
  isCollapsed: boolean;
  /** Toggles the panel between collapsed and expanded states */
  toggleCollapse: () => void;
  /** Programmatically sets the collapsed state */
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * Get value from localStorage with fallback
 */
function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;

  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set value in localStorage
 */
function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
}

/**
 * Custom hook for managing panel collapse state with localStorage persistence.
 *
 * This hook provides automatic persistence of panel collapse states across page refreshes
 * using localStorage. Each panel is identified by a unique panelId, allowing independent
 * state management for multiple panels (e.g., left and right panels).
 *
 * The hook is SSR-safe and handles hydration properly by loading from localStorage only
 * after the component mounts on the client side.
 *
 * @param panelId - Unique identifier for the panel (e.g., "node-info", "evidence-panel")
 * @param defaultCollapsed - Initial collapsed state if no saved state exists (default: true)
 * @returns Controller object with collapse state and control functions
 *
 * @example
 * // In a panel component
 * const { isCollapsed, toggleCollapse } = usePanelState("node-info", true);
 *
 * return (
 *   <div style={{ width: isCollapsed ? '0px' : '300px' }}>
 *     <button onClick={toggleCollapse}>
 *       {isCollapsed ? '▶' : '◀'}
 *     </button>
 *   </div>
 * );
 */
export function usePanelState(
  panelId: string,
  defaultCollapsed: boolean = true,
): PanelStateController {
  const storageKey = `legal-lens-panel-${panelId}`;

  // Initialize with default value
  // Will hydrate from localStorage in useEffect (SSR-safe)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);

  // Track if we've hydrated from localStorage to avoid persisting the initial default
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    const storedValue = getLocalStorage<boolean>(storageKey, defaultCollapsed);
    // Use a microtask to avoid setState during render
    Promise.resolve().then(() => {
      setIsCollapsed(storedValue);
      setIsHydrated(true);
    });
  }, [storageKey, defaultCollapsed]);

  // Persist to localStorage whenever state changes (after initial hydration)
  useEffect(() => {
    if (isHydrated) {
      setLocalStorage<boolean>(storageKey, isCollapsed);
    }
  }, [isCollapsed, isHydrated, storageKey]);

  /**
   * Toggles the panel between collapsed and expanded states
   */
  const toggleCollapse = (): void => {
    setIsCollapsed((prev) => !prev);
  };

  /**
   * Programmatically sets the collapsed state
   */
  const setCollapsed = (collapsed: boolean): void => {
    setIsCollapsed(collapsed);
  };

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  };
}
