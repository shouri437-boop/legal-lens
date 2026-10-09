// ABOUTME: Consumer hooks for the detail sidebar split contexts.
// ABOUTME: useDetailSidebar reads state; useDetailSidebarDispatch reads dispatch only.

"use client";

import { useContext } from "react";
import {
  DetailSidebarStateContext,
  DetailSidebarDispatchContext,
} from "@/contexts/detail-sidebar-context";
import type {
  DetailSidebarState,
  DetailSidebarDispatch,
} from "@/types/detail-sidebar";

/** Read the sidebar state (content, isCollapsed, widthPercent). */
export function useDetailSidebar(): DetailSidebarState {
  const ctx = useContext(DetailSidebarStateContext);
  if (ctx === null) {
    throw new Error(
      "useDetailSidebar must be used within a DetailSidebarProvider",
    );
  }
  return ctx;
}

/** Read only the dispatch functions (stable references, no re-renders on state change). */
export function useDetailSidebarDispatch(): DetailSidebarDispatch {
  const ctx = useContext(DetailSidebarDispatchContext);
  if (ctx === null) {
    throw new Error(
      "useDetailSidebarDispatch must be used within a DetailSidebarProvider",
    );
  }
  return ctx;
}
