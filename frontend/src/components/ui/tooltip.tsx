// ABOUTME: Reusable, ARIA-compliant portal tooltip component.
// ABOUTME: Supports configurable position, delay, keyboard dismiss, and focus/hover triggers.

"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type TooltipPosition = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  /**
   * Content rendered inside the tooltip popup.
   *
   * **Note:** Tooltip content is rendered with `pointer-events: none`, so
   * interactive elements (buttons, links) inside the tooltip will not be
   * clickable. Use a popover pattern if interactivity is needed.
   */
  content: ReactNode;
  /** Preferred placement relative to the trigger element. */
  position?: TooltipPosition;
  /** Delay in ms before the tooltip appears (prevents flicker on fast mouse movement). */
  delay?: number;
  /** Whether the tooltip is disabled (never shown). */
  disabled?: boolean;
  /** Optional className applied to the wrapper `<span>`. Use to fix layout issues (e.g. `"w-full"`). */
  className?: string;
  /** The trigger element(s) to wrap. */
  children: ReactNode;
}

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

/** Gap between trigger element and tooltip (in px). */
const TOOLTIP_OFFSET = 8;
/** Arrow size in px. */
const ARROW_SIZE = 6;
/** Minimum distance from viewport edge before flipping. */
const VIEWPORT_PADDING = 12;

// -----------------------------------------------------------------------
// Position computation
// -----------------------------------------------------------------------

interface TooltipCoords {
  top: number;
  left: number;
  actualPosition: TooltipPosition;
}

/**
 * Compute the fixed-position coordinates for the tooltip, with automatic
 * flip to the opposite side if the tooltip would clip the viewport.
 */
function computePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferred: TooltipPosition,
): TooltipCoords {
  const { innerWidth: vw, innerHeight: vh } = window;

  const positions: Record<
    TooltipPosition,
    { top: number; left: number; fits: boolean }
  > = {
    top: {
      top: triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET,
      left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      fits:
        triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET >
        VIEWPORT_PADDING,
    },
    bottom: {
      top: triggerRect.bottom + TOOLTIP_OFFSET,
      left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      fits:
        triggerRect.bottom + tooltipRect.height + TOOLTIP_OFFSET <
        vh - VIEWPORT_PADDING,
    },
    left: {
      top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
      left: triggerRect.left - tooltipRect.width - TOOLTIP_OFFSET,
      fits:
        triggerRect.left - tooltipRect.width - TOOLTIP_OFFSET >
        VIEWPORT_PADDING,
    },
    right: {
      top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
      left: triggerRect.right + TOOLTIP_OFFSET,
      fits:
        triggerRect.right + tooltipRect.width + TOOLTIP_OFFSET <
        vw - VIEWPORT_PADDING,
    },
  };

  // Try preferred first, then flip to opposite, then try remaining axes
  const opposites: Record<TooltipPosition, TooltipPosition> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };

  const fallbackOrder: TooltipPosition[] = [
    preferred,
    opposites[preferred],
    ...(["top", "right", "bottom", "left"] as TooltipPosition[]).filter(
      (p) => p !== preferred && p !== opposites[preferred],
    ),
  ];

  for (const pos of fallbackOrder) {
    if (positions[pos].fits) {
      // Clamp horizontal/vertical to stay within viewport
      const clamped = {
        top: Math.max(
          VIEWPORT_PADDING,
          Math.min(
            positions[pos].top,
            vh - tooltipRect.height - VIEWPORT_PADDING,
          ),
        ),
        left: Math.max(
          VIEWPORT_PADDING,
          Math.min(
            positions[pos].left,
            vw - tooltipRect.width - VIEWPORT_PADDING,
          ),
        ),
      };
      return { ...clamped, actualPosition: pos };
    }
  }

  // Ultimate fallback: use preferred position, clamped
  const fallback = positions[preferred];
  return {
    top: Math.max(
      VIEWPORT_PADDING,
      Math.min(fallback.top, vh - tooltipRect.height - VIEWPORT_PADDING),
    ),
    left: Math.max(
      VIEWPORT_PADDING,
      Math.min(fallback.left, vw - tooltipRect.width - VIEWPORT_PADDING),
    ),
    actualPosition: preferred,
  };
}

// -----------------------------------------------------------------------
// Arrow styles by position
// -----------------------------------------------------------------------

function arrowStyles(position: TooltipPosition): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
    pointerEvents: "none",
  };

  switch (position) {
    case "top":
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: "50%",
        transform: "translateX(-50%)",
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: "var(--popover) transparent transparent transparent",
      };
    case "bottom":
      return {
        ...base,
        top: -ARROW_SIZE,
        left: "50%",
        transform: "translateX(-50%)",
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: "transparent transparent var(--popover) transparent",
      };
    case "left":
      return {
        ...base,
        right: -ARROW_SIZE,
        top: "50%",
        transform: "translateY(-50%)",
        borderWidth: `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: "transparent transparent transparent var(--popover)",
      };
    case "right":
      return {
        ...base,
        left: -ARROW_SIZE,
        top: "50%",
        transform: "translateY(-50%)",
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: "transparent var(--popover) transparent transparent",
      };
  }
}

// -----------------------------------------------------------------------
// Tooltip Component
// -----------------------------------------------------------------------

export function Tooltip({
  content,
  position = "top",
  delay = 150,
  disabled = false,
  className,
  children,
}: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  // ------- Show / hide logic -------

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    setCoords(computePosition(triggerRect, tooltipRect, position));
  }, [position]);

  const show = useCallback(() => {
    if (disabled) return;
    delayTimerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hide = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    setIsVisible(false);
    setCoords(null);
  }, []);

  // Update tooltip position once it becomes visible (needs a frame for the
  // portal element to be in the DOM so we can read its dimensions).
  useEffect(() => {
    if (!isVisible) return;
    // Use rAF to ensure the portal has rendered and we can measure it
    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, updatePosition]);

  // ------- Keyboard: dismiss on Escape -------

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, hide]);

  // ------- Cleanup timer on unmount -------

  useEffect(() => {
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, []);

  // ------- Event handlers -------

  const handleMouseEnter = useCallback(() => show(), [show]);
  const handleMouseLeave = useCallback(() => hide(), [hide]);
  const handleFocus = useCallback(() => show(), [show]);
  const handleBlur = useCallback(() => hide(), [hide]);

  // ------- Render -------

  // The trigger wrapper is an inline span so it doesn't affect layout.
  // We attach aria-describedby to link the trigger to the tooltip for
  // screen readers, but only when the tooltip is actually visible.
  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={isVisible ? tooltipId : undefined}
        style={{ display: "inline-flex" }}
      >
        {children}
      </span>

      {isVisible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              zIndex: 9999,
              pointerEvents: "none",
              // Fade in; respects prefers-reduced-motion via CSS media query
              opacity: coords ? 1 : 0,
              transition: "opacity 120ms ease-out",
            }}
          >
            <div
              className="text-xs rounded-lg shadow-2xl px-3 py-1.5 max-w-72 leading-relaxed"
              style={{
                backgroundColor: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
              }}
            >
              {content}
              {/* Arrow pointing toward the trigger */}
              <div style={arrowStyles(coords?.actualPosition ?? position)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
