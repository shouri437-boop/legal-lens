// ABOUTME: Single timeline entry for a relationship in the entity timeline sidebar.
// ABOUTME: Expandable to reveal evidence excerpt and (deferred) source document card.

"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, FileSearch, Shield } from "lucide-react";
import { clsx } from "clsx";

import { getEntityColor } from "@/lib/knowledge-graph-config";
import type {
  EntityResponse,
  RelationshipResponse,
} from "@/types/knowledge-graph";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EntityTimelineEntryProps {
  relationship: RelationshipResponse;
  selectedEntity: EntityResponse;
  /** Resolved from allEntities. Null if the connected entity was not found. */
  connectedEntity: EntityResponse | null;
  /** Whether this is the "source" side of the relationship (selectedEntity is source). */
  isSource: boolean;
  /** Callback to view source evidence for a set of finding IDs. */
  onViewSource?: (findingIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a display date from the temporal_context string, or return null. */
function extractDateLabel(temporal: string | null): string | null {
  if (!temporal) return null;
  // Try to find a 4-digit year
  const yearMatch = temporal.match(/\b(1[89]\d{2}|20\d{2})\b/);
  if (yearMatch) return yearMatch[1];
  // Otherwise, truncate the context to something readable
  return temporal.length > 40 ? temporal.slice(0, 40) + "\u2026" : temporal;
}

/** Title-case an entity type string (replace underscores, capitalize). */
function formatEntityType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityTimelineEntry({
  relationship,
  selectedEntity,
  connectedEntity,
  isSource,
  onViewSource,
}: EntityTimelineEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const dateLabel =
    extractDateLabel(relationship.temporal_context) ?? "Unknown date";

  const selectedColor = getEntityColor(selectedEntity.entity_type);
  const connectedColor = connectedEntity
    ? getEntityColor(connectedEntity.entity_type)
    : "#8A8A82";
  const connectedName = connectedEntity?.name ?? "Unknown Entity";

  // Build relationship display: {source} -- label --> {target}
  const sourceName = isSource ? selectedEntity.name : connectedName;
  const targetName = isSource ? connectedName : selectedEntity.name;
  const sourceColor = isSource ? selectedColor : connectedColor;
  const targetColor = isSource ? connectedColor : selectedColor;

  const hasEvidence =
    relationship.evidence_excerpt && relationship.evidence_excerpt.length > 0;
  const hasCorroboration =
    relationship.corroboration_count != null &&
    relationship.corroboration_count > 1;

  return (
    <div className="border-b border-stone/8 last:border-b-0">
      {/* Collapsed row */}
      <button
        onClick={toggle}
        className={clsx(
          "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
          "hover:bg-charcoal/30",
          isExpanded && "bg-charcoal/20",
        )}
      >
        {/* Date column */}
        <span
          className="text-sm font-medium text-smoke/70 mt-0.5 shrink-0 w-20 text-right leading-tight"
          title={dateLabel}
        >
          {dateLabel}
        </span>

        {/* Relationship description */}
        <div className="flex-1 min-w-0">
          <div className="text-sm leading-relaxed">
            <span className="font-medium" style={{ color: sourceColor }}>
              {sourceName}
            </span>
            <span className="text-smoke/50 mx-1">&rarr;</span>
            <span className="text-smoke italic">{relationship.label}</span>
            <span className="text-smoke/50 mx-1">&rarr;</span>
            <span className="font-medium" style={{ color: targetColor }}>
              {targetName}
            </span>
          </div>
          {connectedEntity && (
            <span className="text-xs text-smoke/60 mt-0.5 block">
              {formatEntityType(connectedEntity.entity_type)}
            </span>
          )}
        </div>

        {/* Chevron */}
        <span className="text-smoke/50 mt-0.5 shrink-0">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-3 pl-[calc(1rem+4.5rem)]">
          {/* Temporal context badge */}
          {relationship.temporal_context && (
            <div className="mb-2">
              <span className="inline-block text-xs px-2 py-0.5 rounded bg-charcoal/40 text-smoke/70 border border-stone/20">
                {relationship.temporal_context}
              </span>
            </div>
          )}

          {/* Source document card */}
          <div className="rounded-lg bg-charcoal/30 border border-stone/20 p-3">
            {/* Evidence excerpt */}
            {hasEvidence && (
              <p className="text-sm text-smoke/90 leading-relaxed mb-2 italic">
                &ldquo;{relationship.evidence_excerpt}&rdquo;
              </p>
            )}

            {/* Corroboration badge */}
            {hasCorroboration && (
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={12} className="text-emerald-500" />
                <span className="text-xs text-emerald-400">
                  Corroborated by {relationship.corroboration_count} agents
                </span>
              </div>
            )}

            {/* Confidence + relationship type */}
            <div className="flex items-center gap-3 text-xs text-smoke/70">
              {relationship.confidence != null && (
                <span>Confidence: {relationship.confidence}%</span>
              )}
              <span>Type: {relationship.relationship_type}</span>
            </div>

            {/* View source */}
            <div className="mt-2 pt-2 border-t border-stone/20">
              {relationship.source_finding_ids &&
              relationship.source_finding_ids.length > 0 &&
              onViewSource ? (
                <button
                  type="button"
                  onClick={() => onViewSource(relationship.source_finding_ids!)}
                  className="inline-flex items-center gap-1.5 text-xs text-stone hover:text-smoke cursor-pointer transition-colors"
                >
                  <FileSearch size={12} />
                  View source evidence
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs text-stone/70 cursor-not-allowed"
                  title="No source citations available for this relationship"
                >
                  <FileSearch size={12} />
                  Source not yet available
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
