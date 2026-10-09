// ABOUTME: Full evidence gap detail panel rendered inside the app-wide DetailSidebar.
// ABOUTME: Shows description, what_is_missing, why_needed, suggested actions, and related entity IDs.

"use client";

import { clsx } from "clsx";
import { Lightbulb, HelpCircle, Target, Link2 } from "lucide-react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { EntityBadge } from "@/components/ui/entity-badge";
import type { GapResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GapDetailPanelProps {
  gap: GapResponse;
}

// ---------------------------------------------------------------------------
// Priority styling
// ---------------------------------------------------------------------------

const PRIORITY_STYLE: Record<
  string,
  { color: string; bg: string; text: string; label: string }
> = {
  critical: {
    color: "#ef4444",
    bg: "bg-red-500/10 border-red-500/25",
    text: "text-red-400",
    label: "Critical",
  },
  high: {
    color: "#f97316",
    bg: "bg-orange-500/10 border-orange-500/25",
    text: "text-orange-400",
    label: "High",
  },
  medium: {
    color: "#f59e0b",
    bg: "bg-amber-500/10 border-amber-500/25",
    text: "text-amber-400",
    label: "Medium",
  },
  low: {
    color: "#78716c",
    bg: "bg-stone/10 border-stone/20",
    text: "text-stone",
    label: "Low",
  },
};

// ---------------------------------------------------------------------------
// GapDetailPanel Component
// ---------------------------------------------------------------------------

export function GapDetailPanel({ gap }: GapDetailPanelProps) {
  const priorityStyle = PRIORITY_STYLE[gap.priority] ?? PRIORITY_STYLE.low;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex-none px-5 py-5 border-b border-stone/15"
        style={{
          background: `linear-gradient(135deg, ${priorityStyle.color}20 0%, transparent 100%)`,
        }}
      >
        {/* Priority badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
              priorityStyle.bg,
              priorityStyle.text,
            )}
          >
            {priorityStyle.label} Priority
          </span>
        </div>

        {/* Description */}
        <h3 className="text-sm font-semibold text-smoke leading-relaxed">
          {gap.description}
        </h3>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* What Is Missing */}
        <CollapsibleSection
          title="What Is Missing"
          color={priorityStyle.color}
          icon={<HelpCircle className="w-3.5 h-3.5" />}
          defaultOpen
        >
          <p className="text-sm text-smoke/80 leading-relaxed whitespace-pre-wrap">
            {gap.what_is_missing}
          </p>
        </CollapsibleSection>

        {/* Why Needed */}
        {gap.why_needed && (
          <CollapsibleSection
            title="Why This Matters"
            color={priorityStyle.color}
            icon={<Target className="w-3.5 h-3.5" />}
            defaultOpen
          >
            <p className="text-sm text-smoke/80 leading-relaxed whitespace-pre-wrap">
              {gap.why_needed}
            </p>
          </CollapsibleSection>
        )}

        {/* Suggested Actions */}
        {gap.suggested_actions && (
          <CollapsibleSection
            title="Suggested Actions"
            color="#f59e0b"
            icon={<Lightbulb className="w-3.5 h-3.5" />}
            defaultOpen
          >
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
              <p className="text-sm text-smoke/80 leading-relaxed whitespace-pre-wrap">
                {gap.suggested_actions}
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* Related Entities */}
        {gap.related_entities && gap.related_entities.length > 0 && (
          <CollapsibleSection
            title="Related Entities"
            color={priorityStyle.color}
            icon={<Link2 className="w-3.5 h-3.5" />}
            badge={gap.related_entities.length}
          >
            <div className="space-y-1.5">
              {gap.related_entities.map((entity) => (
                <EntityBadge
                  key={entity.id}
                  name={entity.name}
                  entityType={entity.entity_type}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Empty state for minimal gap */}
        {!gap.why_needed &&
          !gap.suggested_actions &&
          gap.related_entities.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-stone">
                No additional details available for this evidence gap.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
