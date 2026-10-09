// ABOUTME: App-wide resizable right detail sidebar with content registry.
// ABOUTME: Renders content based on discriminated union descriptors from context.

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useDetailSidebar,
  useDetailSidebarDispatch,
  useResizeHandle,
} from "@/hooks";
import { EvidenceSourcePanel } from "./evidence-source-panel";
import { KnowledgeGraphEntityPanel } from "@/components/knowledge-graph/KnowledgeGraphEntityPanel";
import { HypothesisDetailPanel } from "@/components/verdict/HypothesisDetailPanel";
import { ContradictionDetailPanel } from "@/components/verdict/ContradictionDetailPanel";
import { GapDetailPanel } from "@/components/verdict/GapDetailPanel";
import type { SidebarContentDescriptor } from "@/types/detail-sidebar";
import { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX } from "@/types/detail-sidebar";

// ---------------------------------------------------------------------------
// Content Registry
// ---------------------------------------------------------------------------

/**
 * Maps a content descriptor to its rendered component.
 * To add a content type: add a union member in detail-sidebar.ts and a case here.
 */
function renderContent(descriptor: SidebarContentDescriptor): React.ReactNode {
  switch (descriptor.type) {
    case "knowledge-graph-evidence":
      return <EvidenceSourcePanel content={descriptor.props.content} />;
    case "knowledge-graph-entity":
      return (
        <KnowledgeGraphEntityPanel
          caseId={descriptor.props.caseId}
          entity={descriptor.props.entity}
          relationships={descriptor.props.relationships}
          allEntities={descriptor.props.allEntities}
          onEntitySelect={descriptor.props.onEntitySelect}
          onViewFinding={descriptor.props.onViewFinding}
        />
      );
    case "verdict-hypothesis":
      return (
        <HypothesisDetailPanel
          caseId={descriptor.props.caseId}
          hypothesis={descriptor.props.hypothesis}
          onViewFinding={descriptor.props.onViewFinding}
        />
      );
    case "verdict-contradiction":
      return (
        <ContradictionDetailPanel
          caseId={descriptor.props.caseId}
          contradiction={descriptor.props.contradiction}
          onViewFinding={descriptor.props.onViewFinding}
        />
      );
    case "verdict-gap":
      return <GapDetailPanel gap={descriptor.props.gap} />;
  }
}

/**
 * Returns a CSS scope class for the sidebar container so that
 * scoped CSS variables (e.g. --cc-accent) resolve correctly.
 */
function getCssScope(descriptor: SidebarContentDescriptor): string | undefined {
  switch (descriptor.type) {
    case "knowledge-graph-evidence":
      return undefined;
    case "knowledge-graph-entity":
      return undefined;
    case "verdict-hypothesis":
    case "verdict-contradiction":
    case "verdict-gap":
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// DetailSidebar Component
// ---------------------------------------------------------------------------

export function DetailSidebar() {
  const { content, isCollapsed, widthPercent } = useDetailSidebar();
  const { toggleCollapsed, setWidthPercent } = useDetailSidebarDispatch();

  const { onPointerDown } = useResizeHandle({
    minPercent: SIDEBAR_WIDTH_MIN,
    maxPercent: SIDEBAR_WIDTH_MAX,
    onResize: setWidthPercent,
  });

  // Nothing to show
  if (!content) return null;

  const cssScope = !isCollapsed ? getCssScope(content) : undefined;

  return (
    <aside
      className={`relative flex-none flex flex-col${cssScope ? ` ${cssScope}` : ""}`}
      style={{
        width: isCollapsed ? "0%" : `${widthPercent}%`,
        backgroundColor: isCollapsed ? "transparent" : "var(--card)",
        borderLeft: isCollapsed ? "none" : "1px solid var(--border)",
      }}
    >
      {/* Toggle button — always at the center of the sidebar's left edge.
          When collapsed (0 width), that edge IS the right viewport edge. */}
      <button
        onClick={toggleCollapsed}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-50
                   flex items-center justify-center w-6 h-12 rounded-l-md
                   transition-colors duration-150"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRight: "none",
          color: "var(--muted-foreground)",
        }}
        aria-label={
          isCollapsed ? "Open detail sidebar" : "Collapse detail sidebar"
        }
      >
        {isCollapsed ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Resize handle (left edge) — only when expanded */}
      {!isCollapsed && (
        <div
          onPointerDown={onPointerDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10
                     hover:bg-white/10 transition-colors duration-150"
          aria-label="Resize sidebar"
        />
      )}

      {/* Content area — only when expanded */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent(content)}
        </div>
      )}
    </aside>
  );
}
