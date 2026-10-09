// ABOUTME: Generic pointer-event-based drag-to-resize hook.
// ABOUTME: Returns handler props for a resize handle element.

"use client";

import { useCallback, useRef } from "react";

interface UseResizeHandleOptions {
  /** Minimum width percent */
  minPercent: number;
  /** Maximum width percent */
  maxPercent: number;
  /** Called on each drag frame with the clamped percent */
  onResize: (percent: number) => void;
  /** Called once when dragging ends */
  onResizeEnd?: (percent: number) => void;
}

interface ResizeHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
}

/**
 * Returns pointer-event handlers for a resize handle element.
 * Drag left/right to resize; values are clamped to [minPercent, maxPercent].
 *
 * The handle is assumed to be on the LEFT edge of a right-aligned sidebar,
 * so dragging left increases the sidebar width.
 */
export function useResizeHandle({
  minPercent,
  maxPercent,
  onResize,
  onResizeEnd,
}: UseResizeHandleOptions): ResizeHandleProps {
  const lastPercentRef = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const viewportWidth = window.innerWidth;

      // Capture the current sidebar width from the element's parent
      const sidebarEl = (e.target as HTMLElement).parentElement;
      const startWidthPx = sidebarEl?.offsetWidth ?? (viewportWidth * 40) / 100;
      const startPercent = (startWidthPx / viewportWidth) * 100;

      const onPointerMove = (moveEvent: PointerEvent) => {
        // Dragging left (negative deltaX) = wider sidebar
        const deltaX = moveEvent.clientX - startX;
        const deltaPct = (deltaX / viewportWidth) * 100;
        const raw = startPercent - deltaPct;
        const clamped = Math.min(maxPercent, Math.max(minPercent, raw));
        lastPercentRef.current = clamped;
        onResize(clamped);
      };

      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd?.(lastPercentRef.current);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [minPercent, maxPercent, onResize, onResizeEnd],
  );

  return { onPointerDown };
}
