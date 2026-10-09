// ABOUTME: Reusable collapsible panel with a color-coded left border and toggle.
// ABOUTME: Shared by Command Center NodeDetailsSidebar and Knowledge Graph entity panels.

"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CollapsibleSectionProps {
  /** Section heading label (displayed uppercase). */
  title: string;
  /** CSS color for the left accent border and optional icon tinting. */
  color: string;
  /** Whether the section starts in the open state. Defaults to false. */
  defaultOpen?: boolean;
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Optional badge (count or label) rendered after the title. */
  badge?: string | number;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollapsibleSection({
  title,
  color,
  defaultOpen = false,
  icon,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className="border-b border-stone/10"
      style={{
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: color,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-stone/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="opacity-60" style={{ color }}>
              {icon}
            </span>
          )}
          <span className="text-xs font-medium text-stone uppercase tracking-wide">
            {title}
          </span>
          {badge !== undefined && (
            <span className="text-xs text-stone/60">({badge})</span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-stone" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone" />
        )}
      </button>
      {isOpen && <div className="px-5 pb-4 space-y-3">{children}</div>}
    </div>
  );
}
