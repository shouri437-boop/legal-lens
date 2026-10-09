// ABOUTME: Core D3 force-directed graph SVG canvas for knowledge graph visualization.
// ABOUTME: Uses stored D3 selection refs for tick updates -- all dynamic rendering is via D3, not React JSX.

"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { select } from "d3-selection";
import { clsx } from "clsx";
import { Pause, Play } from "lucide-react";

import { CanvasZoomControls } from "@/components/ui/canvas-zoom-controls";
import { useGraphSimulation } from "@/hooks/useGraphSimulation";
import { useGraphSelection } from "@/hooks/useGraphSelection";
import {
  SVG_CONFIG,
  getEntityStyle,
  getEntityColor,
} from "@/lib/knowledge-graph-config";
import type {
  EntityResponse,
  RelationshipResponse,
  ForceNode,
  ForceLink,
} from "@/types/knowledge-graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphSvgProps {
  entities: EntityResponse[];
  relationships: RelationshipResponse[];
  onEntitySelect: (entityId: string | null) => void;
  selectedEntityId: string | null;
  searchMatchIds?: Set<string>;
  /** When set, triggers a smooth zoom+pan to center on this entity in the viewport. */
  focusEntityId?: string | null;
  className?: string;
}

/** Shape of the node tooltip state. */
interface NodeTooltip {
  x: number;
  y: number;
  node: ForceNode;
}

/** Shape of the edge tooltip state. */
interface EdgeTooltip {
  x: number;
  y: number;
  link: ForceLink;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate text to maxLen characters with ellipsis. */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "\u2026" : text;
}

/** Clamp tooltip position to stay within the viewport with a margin. */
function clampTooltipPosition(
  mouseX: number,
  mouseY: number,
  tooltipWidth: number,
  tooltipHeight: number,
): { left: number; top: number } {
  const margin = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  let left = mouseX + margin;
  let top = mouseY + margin;

  // Flip to left side if overflowing right
  if (left + tooltipWidth > vw - margin) {
    left = mouseX - tooltipWidth - margin;
  }
  // Flip above if overflowing bottom
  if (top + tooltipHeight > vh - margin) {
    top = mouseY - tooltipHeight - margin;
  }

  return { left: Math.max(margin, left), top: Math.max(margin, top) };
}

/** Get display label for an entity type (capitalize + replace underscores). */
function formatEntityType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphSvg({
  entities,
  relationships,
  onEntitySelect,
  selectedEntityId,
  searchMatchIds,
  focusEntityId,
  className,
}: GraphSvgProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Container dimensions (updates on resize)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // -- D3 force simulation --
  const {
    forceLinks,
    nodeGroupRef,
    linkGroupRef,
    labelGroupRef,
    edgeLabelGroupRef,
    currentZoomScale,
    isSimulationRunning,
    toggleSimulation,
    resetZoom,
    zoomRef,
    zoomToNode,
  } = useGraphSimulation({
    entities,
    relationships,
    width: dimensions.width,
    height: dimensions.height,
    svgRef,
  });

  // -- Selection + search highlighting --
  const {
    selectedEntityId: internalSelectedId,
    selectEntity,
    forceSelect,
  } = useGraphSelection({
    nodeGroupRef,
    linkGroupRef,
    labelGroupRef,
    edgeLabelGroupRef,
    forceLinks,
    searchMatchIds,
  });

  // Sync external selectedEntityId prop into internal selection state so that
  // sidebar-triggered selections also apply D3 highlighting (connected nodes,
  // dimmed non-connected nodes, edge highlighting).
  useEffect(() => {
    forceSelect(selectedEntityId);
  }, [selectedEntityId, forceSelect]);

  // -- Progressive edge label disclosure (zoom threshold) --
  useEffect(() => {
    const edgeLabels = edgeLabelGroupRef.current;
    if (!edgeLabels) return;

    // If a node is selected, selection effect handles visibility
    if (internalSelectedId) return;

    const showLabels = currentZoomScale >= SVG_CONFIG.edgeLabelZoomThreshold;
    edgeLabels.attr("opacity", showLabels ? 1 : 0);
  }, [currentZoomScale, internalSelectedId, edgeLabelGroupRef]);

  // Keep refs to latest values so D3 closures can access current state
  const zoomScaleRef = useRef(currentZoomScale);
  zoomScaleRef.current = currentZoomScale;

  const selectedEntityIdRef = useRef(selectedEntityId);
  selectedEntityIdRef.current = selectedEntityId;

  // -- Tooltips (managed via React state since they're overlays, not in SVG) --
  const [nodeTooltip, setNodeTooltip] = useState<NodeTooltip | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<EdgeTooltip | null>(null);

  // Clear tooltips when the selected entity changes (prevents sticking when
  // sidebar opens and the underlying D3 elements shift positions)
  useEffect(() => {
    setNodeTooltip(null);
    setEdgeTooltip(null);
  }, [selectedEntityId]);

  // Zoom to focused entity when triggered (e.g. clicking a connected entity in sidebar)
  useEffect(() => {
    if (focusEntityId) {
      zoomToNode(focusEntityId);
    }
  }, [focusEntityId, zoomToNode]);

  // -- Wire up click and hover handlers AFTER D3 creates elements --
  useEffect(() => {
    const nodes = nodeGroupRef.current;
    const links = linkGroupRef.current;
    if (!nodes || !links) return;

    // Node click: select entity + notify parent
    // Use selectedEntityIdRef.current to avoid stale closure on selectedEntityId
    nodes.on("click", (_event: PointerEvent, d: ForceNode) => {
      selectEntity(d.id);
      // If clicking the already-selected entity, deselect (parent gets null)
      onEntitySelect(d.id === selectedEntityIdRef.current ? null : d.id);
    });

    // Node hover: show tooltip + stronger glow (CC aesthetic — ambient glow always on)
    nodes.on("mouseenter", function (event: MouseEvent, d: ForceNode) {
      setNodeTooltip({
        x: event.clientX,
        y: event.clientY,
        node: d,
      });
      // Switch from ambient to hover glow
      const shape = select(this).select<SVGElement>("circle, rect");
      if (!shape.empty()) {
        shape.attr("filter", "url(#kg-node-glow-hover)");
      }
    });

    nodes.on("mousemove", (event: MouseEvent, d: ForceNode) => {
      setNodeTooltip({
        x: event.clientX,
        y: event.clientY,
        node: d,
      });
    });

    nodes.on("mouseleave", function () {
      setNodeTooltip(null);
      // Restore ambient glow
      const shape = select(this).select<SVGElement>("circle, rect");
      if (!shape.empty()) {
        shape.attr("filter", "url(#kg-node-glow)");
      }
    });

    // Edge hover: show tooltip + show edge label on hover
    // Use edgeLabelGroupRef.current (always-current ref) instead of a captured
    // variable to avoid stale closure bugs where the D3 selection from a
    // previous render is referenced after data rebind.
    links.on("mouseenter", (event: MouseEvent, d: ForceLink) => {
      setEdgeTooltip({
        x: event.clientX,
        y: event.clientY,
        link: d,
      });
      // Show this edge's label on hover regardless of zoom
      const currentEdgeLabels = edgeLabelGroupRef.current;
      if (currentEdgeLabels) {
        currentEdgeLabels
          .filter((ld: ForceLink) => ld.id === d.id)
          .attr("opacity", 1);
      }
    });

    links.on("mousemove", (event: MouseEvent, d: ForceLink) => {
      setEdgeTooltip({
        x: event.clientX,
        y: event.clientY,
        link: d,
      });
    });

    links.on("mouseleave", (_event: MouseEvent, d: ForceLink) => {
      setEdgeTooltip(null);
      // Restore edge label visibility based on current zoom threshold
      const currentEdgeLabels = edgeLabelGroupRef.current;
      if (currentEdgeLabels) {
        const showByZoom =
          zoomScaleRef.current >= SVG_CONFIG.edgeLabelZoomThreshold;
        currentEdgeLabels
          .filter((ld: ForceLink) => ld.id === d.id)
          .attr("opacity", showByZoom ? 1 : 0);
      }
    });

    // Increase link hit area for easier hovering
    links.attr("stroke-linecap", "round").style("pointer-events", "stroke");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, relationships]);

  // -- Background click: deselect --
  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // Only deselect if clicking on the SVG background itself (not a node/link)
      const target = event.target as Element;
      if (
        target.tagName === "svg" ||
        target.classList.contains("kg-bg-rect") ||
        target.classList.contains("kg-main-group")
      ) {
        selectEntity(null);
        onEntitySelect(null);
      }
    },
    [selectEntity, onEntitySelect],
  );

  // -- Zoom in/out via CanvasZoomControls --
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = select<SVGSVGElement, unknown>(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
  }, [zoomRef]);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = select<SVGSVGElement, unknown>(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
  }, [zoomRef]);

  // -- Render --

  const simulationToggle: ReactNode = (
    <button
      onClick={toggleSimulation}
      className={clsx(
        "w-10 h-10 rounded-lg text-foreground flex items-center justify-center transition-colors border border-warm-gray/20 dark:border-stone/20",
        isSimulationRunning
          ? "bg-white/90 dark:bg-jet/90 hover:bg-white dark:hover:bg-jet"
          : "bg-accent/20 hover:bg-accent/30",
      )}
      title={isSimulationRunning ? "Freeze Graph" : "Unfreeze Graph"}
    >
      {isSimulationRunning ? (
        <Pause className="w-5 h-5" />
      ) : (
        <Play className="w-5 h-5" />
      )}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={clsx("relative w-full h-full overflow-hidden", className)}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: "var(--color-jet, #111111)" }}
        onClick={handleBackgroundClick}
      >
        {/* Static defs: dot background pattern */}
        <defs>
          <pattern
            id="kg-dot-pattern"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="10" r="1.2" fill="rgba(138,138,130,0.15)" />
          </pattern>
        </defs>
        {/* Background rect at 100% viewport, OUTSIDE zoom group.
            The pattern's patternTransform is updated in the zoom handler
            so dots scale with zoom without a massive rect inside the zoom group. */}
        <rect
          className="kg-bg-rect"
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#kg-dot-pattern)"
        />
        {/* D3 renders all dynamic content into the SVG via refs */}
      </svg>

      {/* Bottom instruction bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-jet/80 border border-stone/15 text-stone text-xs pointer-events-none select-none">
        Click nodes to explore relationships &middot; Scroll to zoom &middot;
        Drag to pan
      </div>

      {/* Zoom / simulation controls */}
      <CanvasZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={resetZoom}
        extraControls={simulationToggle}
      />

      {/* Node tooltip */}
      {nodeTooltip && <NodeTooltipOverlay tooltip={nodeTooltip} />}

      {/* Edge tooltip */}
      {edgeTooltip && <EdgeTooltipOverlay tooltip={edgeTooltip} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip overlays (positioned via fixed coordinates from mouse events)
// ---------------------------------------------------------------------------

function NodeTooltipOverlay({ tooltip }: { tooltip: NodeTooltip }) {
  const { x, y, node } = tooltip;
  const { entity } = node;
  const style = getEntityStyle(entity.entity_type);
  const accentColor = `hsl(${style.accent})`;
  // Estimate: max-w-72 = 288px, typical height ~100px
  const pos = clampTooltipPosition(x, y, 288, 100);

  return (
    <div
      className="fixed z-50 pointer-events-none rounded-xl bg-jet/95 backdrop-blur-sm border border-stone/25 text-smoke shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-w-72 overflow-hidden"
      style={pos}
    >
      {/* Accent stripe */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />

      <div className="px-3 py-2.5">
        {/* Entity name */}
        <div className="font-semibold text-base text-foreground mb-1.5">
          {entity.name}
        </div>

        {/* Type + connections as pill badges */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{
              backgroundColor: `hsl(${style.tint})`,
              color: accentColor,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            {formatEntityType(entity.entity_type)}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone/10 text-stone text-[11px] font-medium">
            {entity.degree} connection{entity.degree !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Description */}
        {entity.description_brief && (
          <div className="text-sm text-stone/80 leading-relaxed line-clamp-3">
            {truncate(entity.description_brief, 150)}
          </div>
        )}
      </div>
    </div>
  );
}

function EdgeTooltipOverlay({ tooltip }: { tooltip: EdgeTooltip }) {
  const { x, y, link } = tooltip;
  const primary = link.relationships[0];
  if (!primary) return null;

  // Use source entity type color for the accent stripe
  const sourceNode = link.source as ForceNode;
  const accentColor =
    sourceNode?.entity != null
      ? getEntityColor(sourceNode.entity.entity_type)
      : "#4b5563";
  // Estimate: max-w-[340px], typical height ~160px
  const pos = clampTooltipPosition(x, y, 340, 160);

  return (
    <div
      className="fixed z-50 pointer-events-none rounded-xl bg-jet/95 backdrop-blur-sm border border-stone/25 text-smoke shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-w-[340px] overflow-hidden"
      style={pos}
    >
      {/* Accent stripe */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />

      <div className="px-3 py-2.5">
        {/* Relationship label */}
        <div className="font-semibold text-base text-foreground mb-1.5">
          {primary.label}
          {link.count > 1 && (
            <span className="text-stone/60 font-normal ml-1.5 text-sm">
              +{link.count - 1} more
            </span>
          )}
        </div>

        {/* Metadata pill badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone/10 text-stone text-[11px] font-medium">
            {primary.relationship_type}
          </span>
          {primary.confidence != null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone/10 text-stone text-[11px] font-medium">
              {primary.confidence}% confidence
            </span>
          )}
          {primary.corroboration_count != null &&
            primary.corroboration_count > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone/10 text-stone text-[11px] font-medium">
                {primary.corroboration_count}x corroborated
              </span>
            )}
        </div>

        {/* Temporal context */}
        {primary.temporal_context && (
          <div className="text-xs text-stone/90 italic mb-1.5">
            {truncate(primary.temporal_context, 120)}
          </div>
        )}

        {/* Evidence excerpt in inset box */}
        {primary.evidence_excerpt && (
          <div className="text-sm text-smoke/80 leading-relaxed border-l-2 border-stone/30 pl-2.5 py-0.5 italic">
            &ldquo;{truncate(primary.evidence_excerpt, 200)}&rdquo;
          </div>
        )}

        {/* Multi-relationship list */}
        {link.count > 1 && (
          <div className="mt-2 pt-2 border-t border-stone/15">
            <div className="text-[11px] text-stone/70 uppercase tracking-wider font-medium mb-1">
              All relationships
            </div>
            {link.relationships.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-1.5 text-xs text-smoke/80 truncate mb-0.5"
              >
                <span
                  className="w-1 h-1 rounded-full shrink-0"
                  style={{
                    backgroundColor: getEntityColor(rel.relationship_type),
                  }}
                />
                {rel.label}
                <span className="text-stone/70">({rel.relationship_type})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
