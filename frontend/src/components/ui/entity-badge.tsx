// ABOUTME: Reusable entity name + type badge component for displaying resolved entities.
// ABOUTME: Color-coded dot and type label matching the GapDetailPanel entity row styling.

"use client";

import { getEntityColor } from "@/lib/knowledge-graph-config";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EntityBadgeProps {
  /** Entity display name. */
  name: string;
  /** Entity type (e.g., "person", "organization", "location"). */
  entityType: string;
  /** Override color for the dot (if caller already has it resolved). */
  color?: string;
  /** Optional click handler. When provided, renders as an interactive button. */
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityBadge({
  name,
  entityType,
  color,
  onClick,
}: EntityBadgeProps) {
  const dotColor = color ?? getEntityColor(entityType);

  const content = (
    <>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-xs text-smoke truncate">{name}</span>
      <span className="ml-auto shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone/15 text-stone/80 uppercase tracking-wide">
        {entityType}
      </span>
    </>
  );

  const baseClass =
    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-charcoal/50 border border-stone/10";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} w-full text-left cursor-pointer hover:brightness-110 transition-[filter]`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
