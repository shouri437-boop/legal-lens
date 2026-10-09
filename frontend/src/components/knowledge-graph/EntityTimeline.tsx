// ABOUTME: Right sidebar panel showing a chronological relationship timeline for a selected entity.
// ABOUTME: Inspired by the Command Center NodeDetailsSidebar layout with gradient header and scrollable body.

"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Search, GitBranch } from "lucide-react";

import { getEntityColor } from "@/lib/knowledge-graph-config";
import { EntityTimelineEntry } from "./EntityTimelineEntry";
import type {
  EntityResponse,
  RelationshipResponse,
} from "@/types/knowledge-graph";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EntityTimelineProps {
  entity: EntityResponse;
  /** All relationships involving this entity (both as source and target). */
  relationships: RelationshipResponse[];
  /** Full entity list for resolving connected entity names. */
  allEntities: EntityResponse[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Title-case an entity type string (replace underscores, capitalize). */
function formatEntityType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Attempt to extract a sortable Date from temporal_context.
 * Returns epoch ms or Infinity if not parseable (pushed to end).
 */
function parseTemporal(temporal: string | null): number {
  if (!temporal) return Infinity;
  // Try native Date parse (handles ISO dates, "January 2020", etc.)
  const ts = Date.parse(temporal);
  if (!isNaN(ts)) return ts;
  // Try extracting a 4-digit year
  const match = temporal.match(/\b(1[89]\d{2}|20\d{2})\b/);
  if (match) return Date.parse(`${match[1]}-01-01`);
  return Infinity;
}

/** Compute a human-readable date range string from relationships. */
function computeDateRange(rels: RelationshipResponse[]): string {
  const dates = rels
    .map((r) => ({
      ts: parseTemporal(r.temporal_context),
      raw: r.temporal_context,
    }))
    .filter((d) => d.ts !== Infinity)
    .sort((a, b) => a.ts - b.ts);

  if (dates.length === 0) return "No dates available";

  const earliest = dates[0].raw ?? "";
  const latest = dates[dates.length - 1].raw ?? "";

  if (earliest === latest) return earliest;
  // Show abbreviated range
  const yearStart = earliest.match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1] ?? earliest;
  const yearEnd = latest.match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1] ?? latest;
  if (yearStart === yearEnd) return yearStart;
  return `${yearStart} \u2013 ${yearEnd}`;
}

// ---------------------------------------------------------------------------
// EntityTimeline component
// ---------------------------------------------------------------------------

export function EntityTimeline({
  entity,
  relationships,
  allEntities,
  onClose,
}: EntityTimelineProps) {
  const [filterText, setFilterText] = useState("");

  const entityColor = getEntityColor(entity.entity_type);

  // Build a lookup map for entity resolution
  const entityMap = useMemo(() => {
    const map = new Map<string, EntityResponse>();
    for (const e of allEntities) map.set(e.id, e);
    return map;
  }, [allEntities]);

  // Sort relationships chronologically (null-dated ones at end)
  const sortedRelationships = useMemo(() => {
    return [...relationships].sort(
      (a, b) =>
        parseTemporal(a.temporal_context) - parseTemporal(b.temporal_context),
    );
  }, [relationships]);

  // Filtered by connected entity name
  const filteredRelationships = useMemo(() => {
    if (!filterText.trim()) return sortedRelationships;
    const query = filterText.toLowerCase();
    return sortedRelationships.filter((r) => {
      const connectedId =
        r.source_entity_id === entity.id
          ? r.target_entity_id
          : r.source_entity_id;
      const connected = entityMap.get(connectedId);
      if (!connected) return false;
      return connected.name.toLowerCase().includes(query);
    });
  }, [sortedRelationships, filterText, entity.id, entityMap]);

  const dateRange = useMemo(
    () => computeDateRange(relationships),
    [relationships],
  );

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterText(e.target.value);
    },
    [],
  );

  const handleClearFilter = useCallback(() => {
    setFilterText("");
  }, []);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex-none px-5 py-5 border-b border-stone/15"
        style={{
          background: `linear-gradient(135deg, ${entityColor}20 0%, transparent 100%)`,
        }}
      >
        {/* Top row: name + close */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-semibold truncate"
              style={{ color: entityColor }}
            >
              {entity.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-charcoal/60 transition-colors shrink-0 ml-2"
            aria-label="Close timeline"
          >
            <X size={16} className="text-stone" />
          </button>
        </div>

        {/* Entity type badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${entityColor}15`,
              color: entityColor,
              border: `1px solid ${entityColor}30`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: entityColor }}
            />
            {formatEntityType(entity.entity_type)}
          </span>
        </div>

        {/* Description */}
        {entity.description_brief && (
          <p className="text-xs text-stone/70 leading-relaxed mb-2 line-clamp-3">
            {entity.description_brief}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-stone/60">
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {relationships.length} relationship
            {relationships.length !== 1 ? "s" : ""}
          </span>
          <span>{dateRange}</span>
        </div>
      </div>

      {/* Filter input */}
      <div className="flex-none px-4 py-2.5 border-b border-stone/10">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone/50"
          />
          <input
            type="text"
            value={filterText}
            onChange={handleFilterChange}
            placeholder="Filter by entity name..."
            className="w-full pl-8 pr-8 py-1.5 bg-charcoal/50 border border-stone/10 rounded-md text-xs text-smoke placeholder:text-stone/40 focus:outline-none focus:border-stone/30 transition-colors"
          />
          {filterText && (
            <button
              onClick={handleClearFilter}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone/50 hover:text-stone transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline entries */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {filteredRelationships.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-stone/50">
              {relationships.length === 0
                ? "No relationships found for this entity."
                : "No relationships match the current filter."}
            </p>
          </div>
        ) : (
          filteredRelationships.map((rel) => {
            const isSource = rel.source_entity_id === entity.id;
            const connectedId = isSource
              ? rel.target_entity_id
              : rel.source_entity_id;
            const connectedEntity = entityMap.get(connectedId) ?? null;

            return (
              <EntityTimelineEntry
                key={rel.id}
                relationship={rel}
                selectedEntity={entity}
                connectedEntity={connectedEntity}
                isSource={isSource}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
