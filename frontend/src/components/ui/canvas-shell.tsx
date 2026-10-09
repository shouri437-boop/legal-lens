// ABOUTME: Reusable bordered canvas container with header, content, and footer slots.
// ABOUTME: Shared by Command Center and Knowledge Graph for consistent visual framing.

import type { ReactNode } from "react";
import { clsx } from "clsx";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasShellProps {
  /** Title displayed in the header bar. */
  title: string;
  /** Subtitle displayed below the title. */
  subtitle?: string;
  /** Optional content rendered on the right side of the header bar. */
  headerRight?: ReactNode;
  /** Optional footer slot (rendered at the bottom with a top border). */
  footer?: ReactNode;
  /** Additional CSS classes applied to the outermost container. */
  className?: string;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasShell({
  title,
  subtitle,
  headerRight,
  footer,
  className,
  children,
}: CanvasShellProps) {
  return (
    <div
      className={clsx(
        "flex flex-col w-full h-full bg-background dark:bg-charcoal rounded-lg overflow-hidden border-2 border-warm-gray/30 dark:border-stone/30",
        className,
      )}
    >
      {/* Header */}
      <div className="flex-none px-6 py-3 border-b border-stone/15">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-smoke mb-0.5">{title}</h2>
            {subtitle && <p className="text-xs text-stone">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">{children}</div>

      {/* Footer (optional) */}
      {footer && (
        <div className="flex-none px-6 py-3 border-t border-stone/15">
          {footer}
        </div>
      )}
    </div>
  );
}
