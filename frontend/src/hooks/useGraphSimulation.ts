// ABOUTME: D3 force simulation lifecycle management for the Knowledge Graph.
// ABOUTME: Creates, configures (5 forces), starts, and stops the simulation using D3 selection refs for tick updates (zero React re-renders).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceRadial,
  type Simulation,
} from "d3-force";
import {
  zoom as d3Zoom,
  zoomIdentity,
  type ZoomBehavior,
  type D3ZoomEvent,
} from "d3-zoom";
import { select, type Selection } from "d3-selection";
import { drag as d3Drag } from "d3-drag";
import { scalePow } from "d3-scale";
import "d3-transition";

import type {
  EntityResponse,
  RelationshipResponse,
  ForceNode,
  ForceLink,
} from "@/types/knowledge-graph";
import {
  FORCE_CONFIG,
  EDGE_STYLE,
  SVG_CONFIG,
  ENTITY_TYPE_STYLE,
  getEntityColor,
  getEntityShape,
  getEntityIconPaths,
  getNodeRadius,
} from "@/lib/knowledge-graph-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseGraphSimulationProps {
  entities: EntityResponse[];
  relationships: RelationshipResponse[];
  width: number;
  height: number;
  svgRef: RefObject<SVGSVGElement | null>;
}

interface UseGraphSimulationReturn {
  forceNodes: ForceNode[];
  forceLinks: ForceLink[];
  simulationRef: RefObject<Simulation<ForceNode, ForceLink> | null>;
  nodeGroupRef: RefObject<Selection<
    SVGGElement,
    ForceNode,
    SVGGElement,
    unknown
  > | null>;
  linkGroupRef: RefObject<Selection<
    SVGLineElement,
    ForceLink,
    SVGGElement,
    unknown
  > | null>;
  labelGroupRef: RefObject<Selection<
    SVGTextElement,
    ForceNode,
    SVGGElement,
    unknown
  > | null>;
  edgeLabelGroupRef: RefObject<Selection<
    SVGGElement,
    ForceLink,
    SVGGElement,
    unknown
  > | null>;
  zoomRef: RefObject<ZoomBehavior<SVGSVGElement, unknown> | null>;
  currentZoomScale: number;
  isSimulationRunning: boolean;
  toggleSimulation: () => void;
  resetZoom: () => void;
  zoomToNode: (nodeId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants for rect sizing
// ---------------------------------------------------------------------------

/** Ratio of rect half-width to equivalent circle radius for visual area balance. */
const RECT_SIDE_RATIO = 1.6;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGraphSimulation({
  entities,
  relationships,
  width,
  height,
  svgRef,
}: UseGraphSimulationProps): UseGraphSimulationReturn {
  // D3 selection refs (stable across renders)
  const simulationRef = useRef<Simulation<ForceNode, ForceLink> | null>(null);
  const nodeGroupRef = useRef<Selection<
    SVGGElement,
    ForceNode,
    SVGGElement,
    unknown
  > | null>(null);
  const linkGroupRef = useRef<Selection<
    SVGLineElement,
    ForceLink,
    SVGGElement,
    unknown
  > | null>(null);
  const labelGroupRef = useRef<Selection<
    SVGTextElement,
    ForceNode,
    SVGGElement,
    unknown
  > | null>(null);
  const edgeLabelGroupRef = useRef<Selection<
    SVGGElement,
    ForceLink,
    SVGGElement,
    unknown
  > | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const mainGroupRef = useRef<Selection<
    SVGGElement,
    unknown,
    null,
    undefined
  > | null>(null);

  // Store width/height in refs so the main simulation effect doesn't depend on them
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  widthRef.current = width;
  heightRef.current = height;

  // Stable boolean that flips once when container dimensions become valid.
  // Used as a dependency trigger to ensure the simulation is created after
  // the ResizeObserver provides real measurements (prevents race condition
  // where data arrives before layout completes).
  const hasDimensions = width > 0 && height > 0;

  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [currentZoomScale, setCurrentZoomScale] = useState(1);
  const manuallyStoppedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Data transformation: EntityResponse[] -> ForceNode[], RelationshipResponse[] -> ForceLink[]
  // -------------------------------------------------------------------------

  const forceNodes = useMemo<ForceNode[]>(() => {
    if (entities.length === 0) return [];

    return entities.map((entity) => ({
      id: entity.id,
      entity,
      radius: getNodeRadius(entity.degree),
      color: getEntityColor(entity.entity_type),
    }));
  }, [entities]);

  const forceLinks = useMemo<ForceLink[]>(() => {
    if (relationships.length === 0) return [];

    // Build deduplicated edge map
    const edgeMap = new Map<
      string,
      { relationships: RelationshipResponse[]; count: number }
    >();

    for (const rel of relationships) {
      // Canonical key: sort entity IDs alphabetically
      const ids = [rel.source_entity_id, rel.target_entity_id].sort();
      const edgeKey = `${ids[0]}|||${ids[1]}`;

      const existing = edgeMap.get(edgeKey);
      if (existing) {
        existing.relationships.push(rel);
        existing.count += 1;
      } else {
        edgeMap.set(edgeKey, { relationships: [rel], count: 1 });
      }
    }

    const links: ForceLink[] = [];
    for (const [key, data] of edgeMap) {
      const [sourceId, targetId] = key.split("|||");
      links.push({
        id: key,
        source: sourceId,
        target: targetId,
        relationships: data.relationships,
        count: data.count,
      });
    }
    return links;
  }, [relationships]);

  // -------------------------------------------------------------------------
  // Simulation + SVG rendering setup
  // -------------------------------------------------------------------------

  useEffect(() => {
    const w = widthRef.current;
    const h = heightRef.current;
    if (!svgRef.current || w <= 0 || h <= 0) return;
    if (forceNodes.length === 0) {
      // Clear SVG if no data
      select(svgRef.current).selectAll("g.kg-main-group").remove();
      return;
    }

    // -- Clear previous content --
    const svgSel = select(svgRef.current);
    svgSel.selectAll("g.kg-main-group").remove();

    // -- Zoom behavior --
    // Updates main group transform AND the background pattern transform for
    // zoom-scaling dots without a massive rect inside the zoom group.
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent(SVG_CONFIG.zoomExtent)
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (mainGroupRef.current) {
          mainGroupRef.current.attr("transform", event.transform.toString());
        }
        // Scale the dot pattern to match zoom so dots appear to move with the graph
        const pattern = svgSel.select<SVGPatternElement>("#kg-dot-pattern");
        if (!pattern.empty()) {
          pattern.attr(
            "patternTransform",
            `translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`,
          );
        }
        setCurrentZoomScale(event.transform.k);
      });
    svgSel.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // -- Main transform group --
    const mainGroup = svgSel
      .append("g")
      .attr("class", "kg-main-group") as Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    >;
    mainGroupRef.current = mainGroup;

    // -- Defs: gradients + single shared glow filter --
    const defs = svgSel.select<SVGDefsElement>("defs");

    // Clean up prior definitions to avoid stale duplicates
    defs.selectAll("[id^='kg-node-']").remove();
    defs.selectAll("[id^='kg-grad-']").remove();

    // Create gradient for each entity type
    for (const [entityType, style] of Object.entries(ENTITY_TYPE_STYLE)) {
      // Linear gradient: 135deg equivalent (x1=0%, y1=0%, x2=100%, y2=100%)
      const grad = defs
        .append("linearGradient")
        .attr("id", `kg-grad-${entityType}`)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%");
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", `hsl(${style.tint})`)
        .attr("stop-opacity", 0.9);
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", `hsl(${style.tint})`)
        .attr("stop-opacity", 0.6);
    }

    // Two shared glow filters: ambient (constant) and hover (stronger).
    // Uses SourceGraphic color — much cheaper than N per-type filters.
    defs.selectAll("#kg-node-glow").remove();
    defs.selectAll("#kg-node-glow-hover").remove();

    // Ambient glow: subtle halo visible at all times (CC aesthetic)
    const ambientGlow = defs
      .append("filter")
      .attr("id", "kg-node-glow")
      .attr("x", "-60%")
      .attr("y", "-60%")
      .attr("width", "220%")
      .attr("height", "220%");
    ambientGlow
      .append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", 6)
      .attr("result", "blur");
    ambientGlow
      .append("feComponentTransfer")
      .attr("in", "blur")
      .attr("result", "dimmedBlur")
      .append("feFuncA")
      .attr("type", "linear")
      .attr("slope", 0.25);
    const ambientMerge = ambientGlow.append("feMerge");
    ambientMerge.append("feMergeNode").attr("in", "dimmedBlur");
    ambientMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Hover glow: stronger halo for mouse-over emphasis
    const hoverGlow = defs
      .append("filter")
      .attr("id", "kg-node-glow-hover")
      .attr("x", "-80%")
      .attr("y", "-80%")
      .attr("width", "260%")
      .attr("height", "260%");
    hoverGlow
      .append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", 10)
      .attr("result", "blur");
    hoverGlow
      .append("feComponentTransfer")
      .attr("in", "blur")
      .attr("result", "dimmedBlur")
      .append("feFuncA")
      .attr("type", "linear")
      .attr("slope", 0.5);
    const hoverMerge = hoverGlow.append("feMerge");
    hoverMerge.append("feMergeNode").attr("in", "dimmedBlur");
    hoverMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // -- Composite edge weight: combines max strength, avg confidence, and corroboration bonus --
    function computeEdgeWeight(link: ForceLink): number {
      if (link.relationships.length === 0) return 50; // defensive fallback

      const maxStrength = Math.max(
        ...link.relationships.map((r) => r.strength || 0),
      );
      const avgConfidence =
        link.relationships.reduce((s, r) => s + (r.confidence ?? 50), 0) /
        link.relationships.length;
      // +10 per corroboration (max +30), added as absolute bonus
      const corroborationBonus = Math.min(link.count * 10, 30);
      const blended =
        maxStrength * 0.6 + avgConfidence * 0.2 + corroborationBonus;
      return Math.min(blended, 100);
    }

    // -- Stroke width scale (sqrt for perceptual balance) --
    const strengthScale = scalePow()
      .exponent(0.5)
      .domain([0, 100])
      .range([EDGE_STYLE.minWidth, EDGE_STYLE.maxWidth])
      .clamp(true);

    // -- Link group --
    const linkGroup = mainGroup.append("g").attr("class", "kg-links");
    const linkElements = linkGroup
      .selectAll<SVGLineElement, ForceLink>("line")
      .data(forceLinks, (d: ForceLink) => d.id)
      .join("line")
      .attr("stroke", EDGE_STYLE.defaultColor)
      .attr("stroke-width", (d) => strengthScale(computeEdgeWeight(d)))
      .attr("stroke-opacity", EDGE_STYLE.defaultOpacity);
    linkGroupRef.current = linkElements as unknown as Selection<
      SVGLineElement,
      ForceLink,
      SVGGElement,
      unknown
    >;

    // -- Edge label group (each label is a <g> with <rect> bg + <text>) --
    const edgeLabelGroup = mainGroup
      .append("g")
      .attr("class", "kg-edge-labels");
    const edgeLabelElements = edgeLabelGroup
      .selectAll<SVGGElement, ForceLink>("g.kg-edge-label")
      .data(forceLinks, (d: ForceLink) => d.id)
      .join("g")
      .attr("class", "kg-edge-label")
      .style("pointer-events", "none")
      .style("user-select", "none")
      // Start hidden -- progressive disclosure logic controls visibility
      .attr("opacity", 0);

    // Background pill behind edge label text
    edgeLabelElements
      .append("rect")
      .attr("fill", "rgba(5,5,5,0.7)")
      .attr("rx", 3)
      .attr("ry", 3);

    // Edge label text
    edgeLabelElements
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#8A8A82")
      .attr("font-size", SVG_CONFIG.edgeLabelFontSize)
      .text((d) => {
        const primaryLabel = d.relationships[0]?.label ?? "";
        if (d.count > 1) {
          return `${primaryLabel} +${d.count - 1}`;
        }
        return primaryLabel;
      });

    // Size the background rects to fit the text
    edgeLabelElements.each(function () {
      const g = select(this);
      const textEl = g.select<SVGTextElement>("text").node();
      if (textEl) {
        const bbox = textEl.getBBox();
        g.select("rect")
          .attr("x", bbox.x - 4)
          .attr("y", bbox.y - 2)
          .attr("width", bbox.width + 8)
          .attr("height", bbox.height + 4);
      }
    });

    edgeLabelGroupRef.current = edgeLabelElements as Selection<
      SVGGElement,
      ForceLink,
      SVGGElement,
      unknown
    >;

    // -- Node group (each node is a <g> containing shape + icon) --
    const nodeGroup = mainGroup.append("g").attr("class", "kg-nodes");
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, ForceNode>("g.kg-node")
      .data(forceNodes, (d: ForceNode) => d.id)
      .join("g")
      .attr("class", "kg-node")
      .style("cursor", "pointer");

    // Render shapes with gradient fill, no border by default (CC aesthetic).
    // Glow is applied on hover via D3 event handlers; border on selection.
    nodeElements.each(function (d) {
      const g = select(this);
      const shape = getEntityShape(d.entity.entity_type);
      const entityKey = d.entity.entity_type.toLowerCase();
      const gradientUrl = `url(#kg-grad-${entityKey in ENTITY_TYPE_STYLE ? entityKey : "other"})`;

      if (shape === "rect") {
        const halfW = d.radius * RECT_SIDE_RATIO * 0.5;
        const halfH = d.radius * 0.9;
        g.append("rect")
          .attr("x", -halfW)
          .attr("y", -halfH)
          .attr("width", halfW * 2)
          .attr("height", halfH * 2)
          .attr("rx", 6)
          .attr("ry", 6)
          .attr("fill", gradientUrl)
          .attr("stroke", "none")
          .attr("stroke-width", 1.5)
          .attr("filter", "url(#kg-node-glow)");
      } else {
        g.append("circle")
          .attr("r", d.radius)
          .attr("fill", gradientUrl)
          .attr("stroke", "none")
          .attr("stroke-width", 1.5)
          .attr("filter", "url(#kg-node-glow)");
      }

      // Embed Lucide icon inside the node
      const iconPaths = getEntityIconPaths(d.entity.entity_type);
      const iconSize = d.radius * 0.5; // icon occupies ~50% of radius
      const iconScale = iconSize / 12; // Lucide viewBox is 24x24, so 12 = half
      const iconGroup = g
        .append("g")
        .attr(
          "transform",
          `translate(${-12 * iconScale},${-12 * iconScale}) scale(${iconScale})`,
        )
        .attr("fill", "none")
        .attr("stroke", "#ffffff")
        .attr("stroke-opacity", 0.7)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      for (const pathD of iconPaths) {
        iconGroup.append("path").attr("d", pathD);
      }
    });

    nodeGroupRef.current = nodeElements as Selection<
      SVGGElement,
      ForceNode,
      SVGGElement,
      unknown
    >;

    // -- Label group --
    const labelGroup = mainGroup.append("g").attr("class", "kg-labels");
    const labelElements = labelGroup
      .selectAll<SVGTextElement, ForceNode>("text")
      .data(forceNodes, (d: ForceNode) => d.id)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#D4D3CE")
      .attr("font-size", SVG_CONFIG.labelFontSize)
      .style("pointer-events", "none")
      .style("user-select", "none")
      .text((d) => {
        const name = d.entity.name;
        return name.length > 20 ? name.slice(0, 18) + "..." : name;
      });
    labelGroupRef.current = labelElements as unknown as Selection<
      SVGTextElement,
      ForceNode,
      SVGGElement,
      unknown
    >;

    // -- Drag behavior --
    const dragBehavior = d3Drag<SVGGElement, ForceNode>()
      .on("start", (event, d) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });
    nodeElements.call(dragBehavior);

    // -- Force simulation --
    const maxConnections = Math.max(
      ...forceNodes.map((n) => n.entity.degree),
      1,
    );
    const maxRadius = Math.min(w, h) * 0.35;
    const minRadius = FORCE_CONFIG.radial.minRadius;

    const simulation = forceSimulation<ForceNode>(forceNodes)
      .force(
        "link",
        forceLink<ForceNode, ForceLink>(forceLinks)
          .id((d) => d.id)
          .distance(FORCE_CONFIG.link.distance)
          .strength(FORCE_CONFIG.link.strength),
      )
      .force(
        "charge",
        forceManyBody<ForceNode>().strength(FORCE_CONFIG.charge.strength),
      )
      .force(
        "center",
        forceCenter(w / 2, h / 2).strength(FORCE_CONFIG.center.strength),
      )
      .force(
        "collide",
        forceCollide<ForceNode>().radius(
          (d) => d.radius + FORCE_CONFIG.collision.padding,
        ),
      )
      .force(
        "radial",
        forceRadial<ForceNode>(
          (d) => {
            // High degree = small radius (center), low degree = large radius (periphery)
            return (
              maxRadius -
              (d.entity.degree / maxConnections) * (maxRadius - minRadius)
            );
          },
          w / 2,
          h / 2,
        ).strength((d) => {
          return (
            FORCE_CONFIG.radial.strengthBase +
            (d.entity.degree / maxConnections) *
              FORCE_CONFIG.radial.strengthScale
          );
        }),
      )
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    // -- Tick handler: update DOM via D3 refs, NOT React state --
    simulation.on("tick", () => {
      linkGroupRef.current
        ?.attr("x1", (d) => ((d.source as ForceNode).x ?? 0).toString())
        .attr("y1", (d) => ((d.source as ForceNode).y ?? 0).toString())
        .attr("x2", (d) => ((d.target as ForceNode).x ?? 0).toString())
        .attr("y2", (d) => ((d.target as ForceNode).y ?? 0).toString());

      edgeLabelGroupRef.current?.attr("transform", (d) => {
        const sx = (d.source as ForceNode).x ?? 0;
        const sy = (d.source as ForceNode).y ?? 0;
        const tx = (d.target as ForceNode).x ?? 0;
        const ty = (d.target as ForceNode).y ?? 0;
        return `translate(${(sx + tx) / 2},${(sy + ty) / 2})`;
      });

      nodeGroupRef.current?.attr(
        "transform",
        (d) => `translate(${d.x ?? 0},${d.y ?? 0})`,
      );

      labelGroupRef.current
        ?.attr("x", (d) => d.x ?? 0)
        .attr("y", (d) => (d.y ?? 0) + d.radius + SVG_CONFIG.labelOffset);
    });

    simulation.on("end", () => {
      if (!manuallyStoppedRef.current) {
        setIsSimulationRunning(false);
      }
    });

    // Restart simulation
    manuallyStoppedRef.current = false;
    setIsSimulationRunning(true);

    // -- Cleanup --
    return () => {
      simulation.stop();
      simulationRef.current = null;
      svgSel.on(".zoom", null);
      svgSel.selectAll("g.kg-main-group").remove();
      defs.selectAll("#kg-node-glow").remove();
      defs.selectAll("#kg-node-glow-hover").remove();
      defs.selectAll("[id^='kg-grad-']").remove();
    };
    // hasDimensions ensures the simulation is created once dimensions are valid
    // (fixes race condition: data can arrive before ResizeObserver measures the container)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, relationships, hasDimensions]);

  // -------------------------------------------------------------------------
  // Separate resize effect: recenters forces without tearing down D3 elements
  // -------------------------------------------------------------------------

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim || width <= 0 || height <= 0) return;

    // Update center force to new midpoint
    sim.force(
      "center",
      forceCenter(width / 2, height / 2).strength(FORCE_CONFIG.center.strength),
    );

    // Update radial force center
    const maxConnections = Math.max(
      ...forceNodes.map((n) => n.entity.degree),
      1,
    );
    const maxRadius = Math.min(width, height) * 0.35;
    const minRadius = FORCE_CONFIG.radial.minRadius;
    sim.force(
      "radial",
      forceRadial<ForceNode>(
        (d) =>
          maxRadius -
          (d.entity.degree / maxConnections) * (maxRadius - minRadius),
        width / 2,
        height / 2,
      ).strength((d) => {
        return (
          FORCE_CONFIG.radial.strengthBase +
          (d.entity.degree / maxConnections) * FORCE_CONFIG.radial.strengthScale
        );
      }),
    );

    // Gently settle positions without a full restart
    sim.alpha(0.1).restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  const toggleSimulation = useCallback(() => {
    if (!simulationRef.current) return;

    if (isSimulationRunning) {
      simulationRef.current.alpha(0).stop();
      manuallyStoppedRef.current = true;
      setIsSimulationRunning(false);
    } else {
      manuallyStoppedRef.current = false;
      simulationRef.current.alpha(0.3).restart();
      setIsSimulationRunning(true);
    }
  }, [isSimulationRunning]);

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svgSel = select<SVGSVGElement, unknown>(svgRef.current);
    svgSel
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, zoomIdentity);
  }, [svgRef]);

  /** Smoothly zoom + pan so the node with `nodeId` is centered in the viewport. */
  const zoomToNode = useCallback(
    (nodeId: string) => {
      if (!svgRef.current || !zoomRef.current) return;
      const node = forceNodes.find((n) => n.id === nodeId);
      if (!node || node.x == null || node.y == null) return;

      const w = widthRef.current;
      const h = heightRef.current;
      if (w <= 0 || h <= 0) return;

      // Zoom to ~1.5x scale, centering the node
      const scale = 1.5;
      const tx = w / 2 - node.x * scale;
      const ty = h / 2 - node.y * scale;

      const svgSel = select<SVGSVGElement, unknown>(svgRef.current);
      svgSel
        .transition()
        .duration(600)
        .call(
          zoomRef.current.transform,
          zoomIdentity.translate(tx, ty).scale(scale),
        );
    },
    [svgRef, forceNodes],
  );

  return {
    forceNodes,
    forceLinks,
    simulationRef,
    nodeGroupRef,
    linkGroupRef,
    labelGroupRef,
    edgeLabelGroupRef,
    zoomRef,
    currentZoomScale,
    isSimulationRunning,
    toggleSimulation,
    resetZoom,
    zoomToNode,
  };
}
