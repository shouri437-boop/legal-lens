// ABOUTME: Entity detail panel rendered inside the app-wide right DetailSidebar.
// ABOUTME: Shows entity header, relationship timeline, connected entities, and source documents.

"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, GitBranch, X, Link2, FileText } from "lucide-react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { EntityTimelineEntry } from "./EntityTimelineEntry";
import { getEntityColor } from "@/lib/knowledge-graph-config";
import { useFindingResolver } from "@/hooks/useFindingResolver";
import { partitionSources } from "@/lib/source-partition";
import {
  FileSourceEntry,
  ExcerptSourceEntry,
} from "@/components/ui/source-entries";
import type {
  EntityResponse,
  RelationshipResponse,
} from "@/types/knowledge-graph";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KnowledgeGraphEntityPanelProps {
  caseId: string;
  entity: EntityResponse;
  relationships: RelationshipResponse[];
  allEntities: EntityResponse[];
  onEntitySelect?: (entityId: string) => void;
  onViewFinding?: (findingId: string) => void;
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
  const ts = Date.parse(temporal);
  if (!isNaN(ts)) return ts;
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
  const yearStart = earliest.match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1] ?? earliest;
  const yearEnd = latest.match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1] ?? latest;
  if (yearStart === yearEnd) return yearStart;
  return `${yearStart} \u2013 ${yearEnd}`;
}

/** Deduplicate source finding IDs across all relationships. */
function collectSourceIds(
  entity: EntityResponse,
  relationships: RelationshipResponse[],
): string[] {
  const ids = new Set<string>();
  if (entity.source_finding_ids) {
    for (const id of entity.source_finding_ids) ids.add(id);
  }
  for (const rel of relationships) {
    if (rel.source_finding_ids) {
      for (const id of rel.source_finding_ids) ids.add(id);
    }
  }
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KnowledgeGraphEntityPanel({
  caseId,
  entity,
  relationships,
  allEntities,
  onEntitySelect,
  onViewFinding,
}: KnowledgeGraphEntityPanelProps) {
  const [filterText, setFilterText] = useState("");

  const entityColor = getEntityColor(entity.entity_type);

  // Build a lookup map for entity resolution
  const entityMap = useMemo(() => {
    const map = new Map<string, EntityResponse>();
    for (const e of allEntities) map.set(e.id, e);
    return map;
  }, [allEntities]);

  // Sort relationships chronologically
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

  // Connected entities (deduplicated)
  const connectedEntities = useMemo(() => {
    const seen = new Set<string>();
    const result: EntityResponse[] = [];
    for (const rel of relationships) {
      const connectedId =
        rel.source_entity_id === entity.id
          ? rel.target_entity_id
          : rel.source_entity_id;
      if (!seen.has(connectedId)) {
        seen.add(connectedId);
        const connected = entityMap.get(connectedId);
        if (connected) result.push(connected);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [relationships, entity.id, entityMap]);

  // Source document IDs
  const sourceIds = useMemo(
    () => collectSourceIds(entity, relationships),
    [entity, relationships],
  );

  // Resolve and partition sources into file-backed (clickable) and excerpt-only
  const { getFinding } = useFindingResolver(caseId);
  const { fileSources, excerptSources } = useMemo(
    () => partitionSources(sourceIds, getFinding),
    [sourceIds, getFinding],
  );
  const totalSources = fileSources.length + excerptSources.length;

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
        <div className="mb-3">
          <h3
            className="text-lg font-semibold truncate"
            style={{ color: entityColor }}
          >
            {entity.name}
          </h3>
          {entity.description_brief && (
            <p className="text-xs text-smoke/80 mt-0.5 leading-relaxed line-clamp-3">
              {entity.description_brief}
            </p>
          )}
        </div>

        {/* Type badge + stats */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
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

        <div className="flex items-center gap-4 text-xs text-stone/80">
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {relationships.length} relationship
            {relationships.length !== 1 ? "s" : ""}
          </span>
          <span>{dateRange}</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Relationships Timeline */}
        <CollapsibleSection
          title="Relationships Timeline"
          color={entityColor}
          icon={<GitBranch className="w-3.5 h-3.5" />}
          badge={relationships.length}
          defaultOpen
        >
          {/* Filter input */}
          <div className="relative mb-3">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone/50"
            />
            <input
              type="text"
              value={filterText}
              onChange={handleFilterChange}
              placeholder="Filter by entity name..."
              className="w-full pl-8 pr-8 py-1.5 bg-charcoal/50 border border-stone/10 rounded-md text-sm text-smoke placeholder:text-stone/40 focus:outline-none focus:border-stone/30 transition-colors"
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

          {/* Timeline entries */}
          {filteredRelationships.length === 0 ? (
            <p className="text-sm text-stone/50 py-4 text-center">
              {relationships.length === 0
                ? "No relationships found."
                : "No relationships match the filter."}
            </p>
          ) : (
            <div className="space-y-0">
              {filteredRelationships.map((rel) => {
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
                    onViewSource={
                      onViewFinding
                        ? (findingIds) => {
                            if (findingIds.length > 0) {
                              onViewFinding(findingIds[0]);
                            }
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* Connected Entities */}
        {connectedEntities.length > 0 && (
          <CollapsibleSection
            title="Connected Entities"
            color={entityColor}
            icon={<Link2 className="w-3.5 h-3.5" />}
            badge={connectedEntities.length}
          >
            <div className="flex flex-wrap gap-1.5">
              {connectedEntities.map((connected) => {
                const color = getEntityColor(connected.entity_type);
                return (
                  <button
                    key={connected.id}
                    type="button"
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded cursor-pointer transition-all hover:brightness-110"
                    style={{
                      background: `${color}15`,
                      color,
                      border: `1px solid ${color}30`,
                    }}
                    onClick={() => onEntitySelect?.(connected.id)}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium">{connected.name}</span>
                    <span className="text-stone/70 text-xs">
                      {formatEntityType(connected.entity_type)}
                    </span>
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Source Documents */}
        {totalSources > 0 && (
          <CollapsibleSection
            title="Source Documents"
            color={entityColor}
            icon={<FileText className="w-3.5 h-3.5" />}
            badge={totalSources}
          >
            <div className="space-y-1.5">
              {fileSources.map(({ sourceId, resolved }) => (
                <FileSourceEntry
                  key={sourceId}
                  sourceId={sourceId}
                  resolved={resolved}
                  onViewSource={
                    onViewFinding ? (id) => onViewFinding(id) : undefined
                  }
                  variant="panel"
                />
              ))}
              {excerptSources.map(({ sourceId, resolved }) => (
                <ExcerptSourceEntry
                  key={sourceId}
                  resolved={resolved}
                  variant="panel"
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Empty state */}
        {relationships.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-stone">
              No relationship data available for this entity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
