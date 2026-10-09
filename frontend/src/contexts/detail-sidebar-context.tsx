// ABOUTME: Split React contexts (state + dispatch) for the detail sidebar.
// ABOUTME: Prevents re-renders in views that only dispatch updates.

"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type {
  DetailSidebarState,
  DetailSidebarDispatch,
  SidebarContentDescriptor,
} from "@/types/detail-sidebar";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from "@/types/detail-sidebar";

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const LS_KEY_WIDTH = "legal-lens-detail-sidebar-width";
const LS_KEY_COLLAPSED = "legal-lens-detail-sidebar-collapsed";

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export const DetailSidebarStateContext =
  createContext<DetailSidebarState | null>(null);

export const DetailSidebarDispatchContext =
  createContext<DetailSidebarDispatch | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DetailSidebarProviderProps {
  children: ReactNode;
}

function readPersistedWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_WIDTH_DEFAULT;
  const raw = localStorage.getItem(LS_KEY_WIDTH);
  if (raw === null) return SIDEBAR_WIDTH_DEFAULT;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, parsed));
}

function readPersistedCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_KEY_COLLAPSED) === "true";
}

export function DetailSidebarProvider({
  children,
}: DetailSidebarProviderProps) {
  const [content, setContentRaw] = useState<SidebarContentDescriptor | null>(
    null,
  );
  const [isCollapsed, setIsCollapsed] = useState(readPersistedCollapsed);
  const [widthPercent, setWidthPercentRaw] = useState(readPersistedWidth);

  // Skip persist effects on initial mount to avoid overwriting localStorage
  // with SSR-default values during hydration. The flag effect MUST be declared
  // after the persist effects so React runs it last in the mount commit.
  const isInitialMountRef = useRef(true);

  // Persist width changes (skip initial mount)
  useEffect(() => {
    if (isInitialMountRef.current) return;
    localStorage.setItem(LS_KEY_WIDTH, String(widthPercent));
  }, [widthPercent]);

  // Persist collapsed state (skip initial mount)
  useEffect(() => {
    if (isInitialMountRef.current) return;
    localStorage.setItem(LS_KEY_COLLAPSED, String(isCollapsed));
  }, [isCollapsed]);

  // Clear the mount guard AFTER persist effects have skipped their first run
  useEffect(() => {
    isInitialMountRef.current = false;
  }, []);

  // -- Dispatch functions (stable references via useCallback) --

  // Track whether sidebar has content, so setContent only auto-expands
  // when opening (null → content), not when updating existing content.
  const hasContentRef = useRef(false);

  const setContent = useCallback((descriptor: SidebarContentDescriptor) => {
    if (!hasContentRef.current) {
      setIsCollapsed(false);
    }
    hasContentRef.current = true;
    setContentRaw(descriptor);
  }, []);

  const clearContent = useCallback(() => {
    hasContentRef.current = false;
    setContentRaw(null);
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const setWidthPercent = useCallback((percent: number) => {
    const clamped = Math.min(
      SIDEBAR_WIDTH_MAX,
      Math.max(SIDEBAR_WIDTH_MIN, percent),
    );
    setWidthPercentRaw(clamped);
  }, []);

  const state = useMemo<DetailSidebarState>(
    () => ({ content, isCollapsed, widthPercent }),
    [content, isCollapsed, widthPercent],
  );

  const dispatch = useMemo<DetailSidebarDispatch>(
    () => ({
      setContent,
      clearContent,
      setCollapsed,
      toggleCollapsed,
      setWidthPercent,
    }),
    [setContent, clearContent, setCollapsed, toggleCollapsed, setWidthPercent],
  );

  return (
    <DetailSidebarStateContext.Provider value={state}>
      <DetailSidebarDispatchContext.Provider value={dispatch}>
        {children}
      </DetailSidebarDispatchContext.Provider>
    </DetailSidebarStateContext.Provider>
  );
}
