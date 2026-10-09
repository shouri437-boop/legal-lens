/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
// SUPERSEDED: This monolithic component has been decomposed into components/knowledge-graph/*
// See: KnowledgeGraphCanvas.tsx, GraphSvg.tsx, FilterPanel.tsx, EntityTimeline.tsx
// Preserved for reference but no longer actively imported.

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Filter,
  FileText,
  Image,
  Video,
  Music,
  File,
  ExternalLink,
} from "lucide-react";
import { CanvasZoomControls } from "@/components/ui/canvas-zoom-controls";
import { useDetailSidebarDispatch } from "@/hooks";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceRadial,
  type Simulation,
  type SimulationLinkDatum,
} from "d3-force";
import {
  zoom as d3Zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
} from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";
import { clsx } from "clsx";

import type {
  GraphNode,
  GraphConnection,
  Transform,
  Position,
  Entity,
  Evidence,
  EntityType,
  EvidenceType,
} from "@/types/knowledge-graph";

interface ForceNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  connection: GraphConnection;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  entityCount: number;
  evidenceCount: number;
  relationshipCount: number;
  onAddRelationship?: (sourceId: string, targetId: string) => void;
}

const ENTITY_COLORS: Record<EntityType, string> = {
  person: "#4A90E2", // Professional blue - trustworthy, human-centric
  organization: "#7B68EE", // Royal purple - authority, corporate
  location: "#50C878", // Emerald green - places, geography
  event: "#FF6B6B", // Coral red - action, temporal events
  document: "#F5A623", // Amber - information, records
  evidence: "#95A5A6", // Slate gray - neutral evidence
};

const EVIDENCE_COLORS: Record<EvidenceType, string> = {
  text: "#F5A623", // Amber - written content
  image: "#E74C3C", // Vibrant red - visual media
  video: "#9B59B6", // Purple - rich media
  audio: "#1ABC9C", // Teal - sound, audio
  document: "#3498DB", // Blue - formal documents
};

const EVIDENCE_ICONS: Record<
  EvidenceType,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Music,
  document: File,
};

function KnowledgeGraph({
  nodes,
  connections,
  entityCount,
  evidenceCount,
  relationshipCount,
  onAddRelationship,
}: KnowledgeGraphProps) {
  // Helper function to get node ID from source/target
  const getNodeId = (nodeOrId: string | GraphNode): string => {
    return typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<Simulation<ForceNode, ForceLink> | null>(null);
  const forceNodesRef = useRef<ForceNode[]>([]);
  const forceLinksRef = useRef<ForceLink[]>([]);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const draggingNodeRef = useRef<string | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<
    SVGSVGElement,
    Record<string, unknown>
  > | null>(null);

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [tempConnection, setTempConnection] = useState<{
    from: Position;
    to: Position;
  } | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, Position>>(
    new Map(),
  );
  const [localConnections, setLocalConnections] = useState<GraphConnection[]>(
    [],
  );
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const manuallyStoppedRef = useRef(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(
    null,
  );

  // Detail sidebar dispatch for evidence source panel
  const { setContent, clearContent, setCollapsed } = useDetailSidebarDispatch();

  // Sync selected evidence to the app-wide detail sidebar
  useEffect(() => {
    if (selectedEvidence) {
      setContent({
        type: "knowledge-graph-evidence",
        props: {
          evidence: selectedEvidence,
        },
      });
    } else {
      clearContent();
    }
  }, [selectedEvidence, setContent, clearContent]);

  // Clear sidebar on unmount (navigation away from KG)
  useEffect(() => {
    return () => {
      clearContent();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize dimensions
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }

    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize force simulation (only once)
  useEffect(() => {
    if (
      !simulationRef.current &&
      dimensions.width > 0 &&
      dimensions.height > 0
    ) {
      simulationRef.current = forceSimulation<ForceNode>([])
        .force(
          "link",
          forceLink<ForceNode, ForceLink>([])
            .id((d) => d.id)
            .distance(180) // Increased base distance
            .strength(0.5),
        )
        .force(
          "charge",
          forceManyBody<ForceNode>().strength(-500).distanceMax(600),
        )
        .force(
          "center",
          forceCenter(dimensions.width / 2, dimensions.height / 2).strength(
            0.05,
          ),
        )
        .force(
          "collide",
          forceCollide<ForceNode>().radius(60).strength(0.9).iterations(3),
        )
        .force(
          "radial",
          forceRadial<ForceNode>(
            Math.min(dimensions.width, dimensions.height) * 0.35,
            dimensions.width / 2,
            dimensions.height / 2,
          ).strength(0.05),
        )
        .alphaMin(0.001)
        .alphaDecay(0.0228)
        .velocityDecay(0.4)
        .on("tick", () => {
          // Update positions in state
          const newPositions = new Map<string, Position>();
          forceNodesRef.current.forEach((node) => {
            if (node.x !== undefined && node.y !== undefined) {
              newPositions.set(node.id, { x: node.x, y: node.y });
            }
          });

          // Trigger re-render via state update
          requestAnimationFrame(() => {
            setNodePositions(newPositions);
          });
        })
        .on("end", () => {
          // Simulation has stabilized naturally
          if (!manuallyStoppedRef.current) {
            console.log("Simulation stabilized naturally");
            setIsSimulationRunning(false);
          }
        });
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, [dimensions.width, dimensions.height]);

  // Combine original connections with locally created ones
  const allConnections = useMemo(
    () => [...connections, ...localConnections],
    [connections, localConnections],
  );
  const totalRelationshipCount = relationshipCount + localConnections.length;

  // Build connection count map for dynamic force calculations
  const connectionCountMap = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((node) => map.set(node.id, 0));

    allConnections.forEach((conn) => {
      const sourceId = getNodeId(conn.source);
      const targetId = getNodeId(conn.target);
      map.set(sourceId, (map.get(sourceId) || 0) + 1);
      map.set(targetId, (map.get(targetId) || 0) + 1);
    });

    return map;
  }, [nodes, allConnections]);

  // Update simulation when data changes
  useEffect(() => {
    if (!simulationRef.current) return;

    // Convert nodes to force nodes with better initial positioning
    const forceNodes: ForceNode[] = nodes.map((node, index) => {
      const existing = forceNodesRef.current.find((n) => n.id === node.id);

      if (existing && existing.x !== undefined && existing.y !== undefined) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          fx: existing.fx,
          fy: existing.fy,
        };
      }

      // Better initial positioning in a circle to prevent drift
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
      return {
        ...node,
        x: dimensions.width / 2 + radius * Math.cos(angle),
        y: dimensions.height / 2 + radius * Math.sin(angle),
      };
    });

    // Convert connections to force links - use allConnections
    const forceLinks: ForceLink[] = allConnections.map((conn) => ({
      source: conn.source,
      target: conn.target,
      connection: conn,
    }));

    forceNodesRef.current = forceNodes;
    forceLinksRef.current = forceLinks;

    // Update simulation
    const sim = simulationRef.current;
    sim.nodes(forceNodes);

    // Update link force with dynamic distance and strength
    const linkForce = sim.force("link") as
      | ReturnType<typeof forceLink<ForceNode, ForceLink>>
      | undefined;
    if (linkForce) {
      linkForce
        .links(forceLinks)
        .distance((d) => {
          // Dynamic link distance based on node connectivity
          const sourceNode = d.source as ForceNode;
          const targetNode = d.target as ForceNode;

          const sourceConnections = connectionCountMap.get(sourceNode.id) || 0;
          const targetConnections = connectionCountMap.get(targetNode.id) || 0;

          // Higher connectivity = shorter links (pulls toward center)
          const avgConnections = (sourceConnections + targetConnections) / 2;
          const baseDistance = 180;
          const scaleFactor = Math.max(0.6, 1 - avgConnections * 0.08);

          return baseDistance * scaleFactor;
        })
        .strength((d) => {
          // Stronger links for high-connectivity nodes
          const sourceNode = d.source as ForceNode;
          const targetNode = d.target as ForceNode;

          const sourceConnections = connectionCountMap.get(sourceNode.id) || 0;
          const targetConnections = connectionCountMap.get(targetNode.id) || 0;

          const avgConnections = (sourceConnections + targetConnections) / 2;
          return 0.3 + avgConnections * 0.05;
        });
    }

    // Update charge force with dynamic strength
    const chargeForce = sim.force("charge") as
      | ReturnType<typeof forceManyBody<ForceNode>>
      | undefined;
    if (chargeForce) {
      chargeForce.strength((d) => {
        const connections = connectionCountMap.get(d.id) || 0;

        // High-connectivity nodes have less repulsion (stay central)
        const baseStrength = -500;
        const scaleFactor = Math.max(0.5, 1 - connections * 0.1);

        return baseStrength * scaleFactor;
      });
    }

    // Update collision force with dynamic radius
    const collideForce = sim.force("collide") as
      | ReturnType<typeof forceCollide<ForceNode>>
      | undefined;
    if (collideForce) {
      collideForce.radius((d) => {
        const connections = connectionCountMap.get(d.id) || 0;
        const baseRadius = 60;
        return baseRadius + connections * 5;
      });
    }

    // Update radial force with dynamic radius
    const radialForce = sim.force("radial") as
      | ReturnType<typeof forceRadial<ForceNode>>
      | undefined;
    if (radialForce) {
      radialForce
        .radius((d) => {
          const connections = connectionCountMap.get(d.id) || 0;

          // Low connectivity = pushed further from center
          const minRadius = 50;
          const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.4;
          return connections > 0
            ? minRadius + (maxRadius - minRadius) / connections
            : maxRadius;
        })
        .strength((d) => {
          const connections = connectionCountMap.get(d.id) || 0;
          return connections === 0 ? 0.15 : 0.05;
        })
        .x(dimensions.width / 2)
        .y(dimensions.height / 2);
    }

    // Update center force to current dimensions
    const centerForce = sim.force("center") as
      | ReturnType<typeof forceCenter>
      | undefined;
    if (centerForce) {
      centerForce.x(dimensions.width / 2).y(dimensions.height / 2);
    }

    // Only restart simulation if not manually stopped
    if (!manuallyStoppedRef.current) {
      sim.alpha(0.3).restart();
      // Use microtask to avoid setState during render
      Promise.resolve().then(() => {
        setIsSimulationRunning(true);
      });
    }
  }, [
    nodes,
    allConnections,
    dimensions.width,
    dimensions.height,
    connectionCountMap,
  ]);

  // Setup zoom and pan behavior
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0)
      return;

    const svg = select<SVGSVGElement, Record<string, unknown>>(svgRef.current);

    const zoomBehavior = d3Zoom<SVGSVGElement, Record<string, unknown>>()
      .scaleExtent([0.1, 4])
      .filter((event: MouseEvent | WheelEvent | TouchEvent) => {
        // Allow zoom on wheel
        if (event.type === "wheel") return true;
        // Allow pan on background drag (not on nodes)
        if (event.type === "mousedown" || event.type === "touchstart") {
          const target = event.target as Element;
          return !target.closest(".node-group");
        }
        return true;
      })
      .on(
        "zoom",
        (event: D3ZoomEvent<SVGSVGElement, Record<string, unknown>>) => {
          transformRef.current = {
            x: event.transform.x,
            y: event.transform.y,
            k: event.transform.k,
          };
          setTransform(transformRef.current);
        },
      );

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on(".zoom", null);
    };
  }, [dimensions.width, dimensions.height]);

  // Node drag behavior with click detection
  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      let hasMoved = false;

      draggingNodeRef.current = nodeId;
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();

      const handleMouseMove = (e: MouseEvent) => {
        if (!draggingNodeRef.current) return;

        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > 5 || dy > 5) {
          hasMoved = true;
        }

        const x =
          (e.clientX - rect.left - transformRef.current.x) /
          transformRef.current.k;
        const y =
          (e.clientY - rect.top - transformRef.current.y) /
          transformRef.current.k;

        const forceNode = forceNodesRef.current.find((n) => n.id === nodeId);
        if (forceNode) {
          forceNode.fx = x;
          forceNode.fy = y;

          // Only restart simulation if it's running
          if (simulationRef.current && isSimulationRunning) {
            simulationRef.current.alpha(0.3).restart();
          } else if (simulationRef.current) {
            // If frozen, just update position without simulation
            forceNode.x = x;
            forceNode.y = y;
            setNodePositions((prev) => {
              const newPositions = new Map(prev);
              newPositions.set(nodeId, { x, y });
              return newPositions;
            });
          }
        }
      };

      const handleMouseUp = () => {
        if (draggingNodeRef.current) {
          const forceNode = forceNodesRef.current.find(
            (n) => n.id === draggingNodeRef.current,
          );
          if (forceNode) {
            // Release fixed position
            forceNode.fx = null;
            forceNode.fy = null;
          }

          // If didn't move much, treat as click
          if (!hasMoved) {
            setSelectedNode(nodeId);

            // If evidence panel is open and an evidence node is clicked, show it
            const clickedNode = nodes.find((n) => n.id === nodeId);
            if (selectedEvidence && clickedNode?.type === "evidence") {
              setSelectedEvidence(clickedNode.data as Evidence);
              setCollapsed(false);
            }
          }

          draggingNodeRef.current = null;
        }

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isSimulationRunning, nodes, selectedEvidence, setCollapsed],
  );

  // Handle connection creation
  const handleStartConnection = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConnectingFrom(nodeId);

      const node = forceNodesRef.current.find((n) => n.id === nodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        setTempConnection({
          from: { x: node.x, y: node.y },
          to: { x: node.x, y: node.y },
        });
      }
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (connectingFrom && tempConnection && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x =
          (e.clientX - rect.left - transformRef.current.x) /
          transformRef.current.k;
        const y =
          (e.clientY - rect.top - transformRef.current.y) /
          transformRef.current.k;

        setTempConnection({
          ...tempConnection,
          to: { x, y },
        });
      }
    },
    [connectingFrom, tempConnection],
  );

  const handleCompleteConnection = useCallback(
    (targetNodeId: string) => {
      if (connectingFrom && connectingFrom !== targetNodeId) {
        // Get node names for the relationship label
        const sourceNode = nodes.find((n) => n.id === connectingFrom);
        const targetNode = nodes.find((n) => n.id === targetNodeId);

        if (!sourceNode || !targetNode) return;

        // Create a new relationship locally
        const newRelationship: GraphConnection = {
          id: `temp-${Date.now()}`,
          source: connectingFrom,
          target: targetNodeId,
          relationship: {
            id: `temp-rel-${Date.now()}`,
            sourceEntityId: connectingFrom,
            targetEntityId: targetNodeId,
            type: "custom",
            label: "Connected to",
            strength: 0.5,
            createdAt: new Date(),
          },
        };

        // Add to local connections
        setLocalConnections((prev) => [...prev, newRelationship]);

        // Call parent callback if provided (for backend integration)
        if (onAddRelationship) {
          onAddRelationship(connectingFrom, targetNodeId);
        }

        // Show success feedback
        console.log(
          "Relationship created:",
          connectingFrom,
          "->",
          targetNodeId,
        );
      }

      setConnectingFrom(null);
      setTempConnection(null);
    },
    [connectingFrom, nodes, onAddRelationship],
  );

  // Zoom controls
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = select<SVGSVGElement, Record<string, unknown>>(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = select<SVGSVGElement, Record<string, unknown>>(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = select<SVGSVGElement, Record<string, unknown>>(svgRef.current);
    svg
      .transition()
      .duration(500)
      .call(zoomBehaviorRef.current.transform, zoomIdentity);
  };

  const handleToggleSimulation = useCallback(() => {
    if (!simulationRef.current) return;

    if (isSimulationRunning) {
      // Stop simulation - set alpha to 0 to stop immediately
      simulationRef.current.alpha(0);
      simulationRef.current.stop();
      manuallyStoppedRef.current = true;
      setIsSimulationRunning(false);
      console.log("Simulation stopped");
    } else {
      // Restart simulation gently
      manuallyStoppedRef.current = false;
      simulationRef.current.alpha(0.1).restart();
      setIsSimulationRunning(true);
      console.log("Simulation started");
    }
  }, [isSimulationRunning]);

  // Render node
  const renderNode = (node: GraphNode) => {
    const position = nodePositions.get(node.id) || node.position;
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;
    const isConnecting = connectingFrom === node.id;

    // Handle entity nodes
    if (node.type === "entity") {
      const entity = node.data as Entity;
      const color = ENTITY_COLORS[entity.type] || "#6B7280";

      return (
        <g
          key={node.id}
          className="node-group"
          transform={`translate(${position.x}, ${position.y})`}
          onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={(e) => {
            if (connectingFrom && connectingFrom !== node.id) {
              e.stopPropagation();
              handleCompleteConnection(node.id);
            }
          }}
          style={{ cursor: connectingFrom ? "crosshair" : "grab" }}
        >
          {/* Node circle with gradient */}
          <defs>
            <radialGradient id={`gradient-${node.id}`}>
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.85" />
            </radialGradient>
          </defs>
          <circle
            r={isSelected ? 35 : isHovered ? 32 : 30}
            fill={`url(#gradient-${node.id})`}
            stroke={
              isConnecting
                ? "#F5F4EF"
                : isSelected
                  ? "#F8F7F4"
                  : isHovered
                    ? "#D4D3CE"
                    : color
            }
            strokeWidth={isConnecting ? 4 : isSelected ? 4 : isHovered ? 3 : 2}
            opacity={1}
            filter={isSelected || isHovered ? "url(#node-glow)" : undefined}
          />

          {/* Node label */}
          <text
            y={50}
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize="12"
            fontWeight={isSelected ? "600" : "400"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {entity.name}
          </text>

          {/* Type badge */}
          <text
            y={0}
            textAnchor="middle"
            fill="var(--color-smoke)"
            fontSize="10"
            fontWeight="600"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {entity.type.charAt(0).toUpperCase()}
          </text>

          {/* Connection button */}
          {(isHovered || isSelected) && (
            <g
              onClick={(e) => {
                e.stopPropagation();
                if (connectingFrom === node.id) {
                  setConnectingFrom(null);
                  setTempConnection(null);
                } else {
                  handleStartConnection(node.id, e);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={35}
                cy={0}
                r={12}
                fill={isConnecting ? "#4A90E2" : "#F5F4EF"}
                stroke={isConnecting ? "#F8F7F4" : "#4A90E2"}
                strokeWidth={2}
              />
              <text
                x={35}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isConnecting ? "#F8F7F4" : "#4A90E2"}
                fontSize="14"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                +
              </text>
            </g>
          )}
        </g>
      );
    }

    // Handle evidence nodes
    if (node.type === "evidence") {
      const evidence = node.data as Evidence;
      const color = EVIDENCE_COLORS[evidence.type] || "#6B7280";
      const IconComponent = EVIDENCE_ICONS[evidence.type] || File;

      return (
        <g
          key={node.id}
          className="node-group"
          transform={`translate(${position.x}, ${position.y})`}
          onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={(e) => {
            if (connectingFrom && connectingFrom !== node.id) {
              e.stopPropagation();
              handleCompleteConnection(node.id);
            }
          }}
          style={{ cursor: connectingFrom ? "crosshair" : "grab" }}
        >
          {/* Evidence node - square shape with gradient */}
          <defs>
            <linearGradient
              id={`gradient-${node.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <rect
            x={isSelected ? -35 : isHovered ? -32 : -30}
            y={isSelected ? -35 : isHovered ? -32 : -30}
            width={isSelected ? 70 : isHovered ? 64 : 60}
            height={isSelected ? 70 : isHovered ? 64 : 60}
            rx={8}
            fill={`url(#gradient-${node.id})`}
            stroke={
              isConnecting
                ? "#F5F4EF"
                : isSelected
                  ? "#F8F7F4"
                  : isHovered
                    ? "#D4D3CE"
                    : color
            }
            strokeWidth={isConnecting ? 4 : isSelected ? 4 : isHovered ? 3 : 2}
            opacity={1}
            filter={isSelected || isHovered ? "url(#node-glow)" : undefined}
          />

          {/* Evidence icon */}
          <foreignObject
            x={-12}
            y={-12}
            width={24}
            height={24}
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
              }}
            >
              <IconComponent size={20} color="var(--color-smoke)" />
            </div>
          </foreignObject>

          {/* Evidence label */}
          <text
            y={50}
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize="11"
            fontWeight={isSelected ? "600" : "400"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {evidence.title.length > 20
              ? evidence.title.substring(0, 20) + "..."
              : evidence.title}
          </text>

          {/* Connection button */}
          {(isHovered || isSelected) && (
            <g
              onClick={(e) => {
                e.stopPropagation();
                if (connectingFrom === node.id) {
                  setConnectingFrom(null);
                  setTempConnection(null);
                } else {
                  handleStartConnection(node.id, e);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={35}
                cy={0}
                r={12}
                fill={isConnecting ? "#4A90E2" : "#F5F4EF"}
                stroke={isConnecting ? "#F8F7F4" : "#4A90E2"}
                strokeWidth={2}
              />
              <text
                x={35}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isConnecting ? "#F8F7F4" : "#4A90E2"}
                fontSize="14"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                +
              </text>
            </g>
          )}
        </g>
      );
    }

    return null;
  };

  // Render connection
  const renderConnection = (conn: GraphConnection) => {
    const sourceId = getNodeId(conn.source);
    const targetId = getNodeId(conn.target);

    const sourcePos = nodePositions.get(sourceId);
    const targetPos = nodePositions.get(targetId);

    if (!sourcePos || !targetPos) return null;

    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    // Color code connections based on relationship type
    const getConnectionColor = (type: string) => {
      switch (type) {
        case "employment":
          return "#4A90E2"; // Blue
        case "ownership":
          return "#7B68EE"; // Purple
        case "location":
          return "#50C878"; // Green
        case "transaction":
          return "#FF6B6B"; // Red
        case "evidence":
          return "#F5A623"; // Amber
        case "governance":
          return "#9B59B6"; // Purple
        default:
          return "#8A8A82"; // Stone gray
      }
    };

    const connectionColor = getConnectionColor(conn.relationship.type);

    return (
      <g key={conn.id}>
        {/* Connection line */}
        <line
          x1={sourcePos.x}
          y1={sourcePos.y}
          x2={targetPos.x}
          y2={targetPos.y}
          stroke={connectionColor}
          strokeWidth={2}
          opacity={0.6}
          strokeDasharray="5,5"
        />

        {/* Connection label */}
        <text
          x={midX}
          y={midY}
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="10"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {conn.relationship.label}
        </text>
      </g>
    );
  };

  return (
    <div
      className="relative w-full h-full rounded-lg shadow-2xl flex overflow-hidden border-2 border-warm-gray/30 dark:border-stone/30 bg-background dark:bg-jet"
      style={{
        minHeight: "600px",
      }}
    >
      {/* Background pattern - Light mode */}
      <div
        className="absolute inset-0 pointer-events-none dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(107, 101, 96, 0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Background pattern - Dark mode */}
      <div
        className="absolute inset-0 pointer-events-none hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(138, 138, 130, 0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Main Graph Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-none px-6 py-3 border-b border-warm-gray/15 dark:border-stone/15 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-medium text-foreground mb-1">
                Knowledge Graph
              </h2>
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span>{entityCount} entities</span>
                <span>•</span>
                <span>{evidenceCount} evidence items</span>
                <span>•</span>
                <span>{totalRelationshipCount} relationships</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {connectingFrom && (
                <div className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  Click another node to connect
                </div>
              )}
              <button
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Filters"
              >
                <Filter className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Graph Container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          onMouseMove={handleMouseMove}
          onClick={() => {
            if (connectingFrom) {
              setConnectingFrom(null);
              setTempConnection(null);
            }
          }}
        >
          <svg
            ref={svgRef}
            className="w-full h-full bg-background dark:bg-charcoal"
            style={{
              cursor: connectingFrom ? "crosshair" : "grab",
            }}
          >
            {/* Dotted background pattern */}
            <defs>
              <pattern
                id="dotted-background"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="2"
                  cy="2"
                  r="1"
                  fill="var(--color-stone)"
                  opacity="0.2"
                />
              </pattern>

              {/* Glow filter for selected/hovered nodes */}
              <filter
                id="node-glow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotted-background)" />

            {/* Transform group */}
            <g
              transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
            >
              {/* Connections layer */}
              <g className="edges-layer">
                {allConnections.map((conn) => renderConnection(conn))}

                {/* Temporary connection line */}
                {tempConnection && (
                  <line
                    x1={tempConnection.from.x}
                    y1={tempConnection.from.y}
                    x2={tempConnection.to.x}
                    y2={tempConnection.to.y}
                    stroke="#4A90E2"
                    strokeWidth={3}
                    opacity={0.8}
                    strokeDasharray="8,4"
                  />
                )}
              </g>

              {/* Nodes layer */}
              <g className="nodes-layer">
                {nodes.map((node) => renderNode(node))}
              </g>
            </g>
          </svg>

          <CanvasZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            extraControls={
              <button
                onClick={handleToggleSimulation}
                className={clsx(
                  "w-10 h-10 rounded-lg text-foreground flex items-center justify-center transition-colors border border-warm-gray/20 dark:border-stone/20",
                  isSimulationRunning
                    ? "bg-white/90 dark:bg-jet/90 hover:bg-white dark:hover:bg-jet"
                    : "bg-accent/20 hover:bg-accent/30",
                )}
                title={isSimulationRunning ? "Freeze Graph" : "Unfreeze Graph"}
              >
                {isSimulationRunning ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
            }
          />

          {/* Legend - Top Left */}
          <div className="absolute top-4 left-4 p-4 rounded-lg shadow-lg border border-warm-gray/20 dark:border-stone/20 bg-white/95 dark:bg-[rgba(17,17,17,0.95)]">
            <h3 className="text-foreground font-medium text-sm mb-3">
              Node Legend
            </h3>

            {/* Entity Types */}
            <div className="mb-3">
              <p className="text-muted-foreground text-xs mb-2">
                Entities (Circles)
              </p>
              <div className="space-y-1.5">
                {Object.entries(ENTITY_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <svg width="20" height="20">
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        fill={color}
                        opacity="0.9"
                      />
                    </svg>
                    <span className="text-foreground text-xs capitalize">
                      {type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence Types */}
            <div>
              <p className="text-muted-foreground text-xs mb-2">
                Evidence (Squares)
              </p>
              <div className="space-y-1.5">
                {Object.entries(EVIDENCE_COLORS).map(([type]) => {
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <svg width="20" height="20">
                        <rect
                          x="2"
                          y="2"
                          width="16"
                          height="16"
                          rx="2"
                          fill={EVIDENCE_COLORS[type as EvidenceType]}
                          opacity="0.9"
                        />
                      </svg>
                      <span className="text-foreground text-xs capitalize">
                        {type}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Node info panel - only show when node is selected */}
          {selectedNode && (
            <div className="absolute top-4 right-4 p-4 rounded-lg shadow-lg max-w-xs border border-warm-gray/20 dark:border-stone/20 bg-white/95 dark:bg-[rgba(17,17,17,0.95)]">
              <div className="text-foreground">
                {(() => {
                  const node = nodes.find((n) => n.id === selectedNode);
                  if (!node) return null;

                  if (node.type === "entity") {
                    const entity = node.data as Entity;
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <svg width="16" height="16">
                            <circle
                              cx="8"
                              cy="8"
                              r="6"
                              fill={ENTITY_COLORS[entity.type]}
                              opacity="0.9"
                            />
                          </svg>
                          <span className="text-xs text-muted-foreground capitalize">
                            {entity.type}
                          </span>
                        </div>
                        <h3 className="font-medium text-lg mb-2">
                          {entity.name}
                        </h3>
                        {entity.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {entity.description}
                          </p>
                        )}
                        <button
                          onClick={() => setSelectedNode(null)}
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          Close
                        </button>
                      </>
                    );
                  }

                  if (node.type === "evidence") {
                    const evidence = node.data as Evidence;
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <svg width="16" height="16">
                            <rect
                              x="2"
                              y="2"
                              width="12"
                              height="12"
                              rx="2"
                              fill={EVIDENCE_COLORS[evidence.type]}
                              opacity="0.9"
                            />
                          </svg>
                          <span className="text-xs text-muted-foreground capitalize">
                            {evidence.type}
                          </span>
                        </div>
                        <h3 className="font-medium text-lg mb-2">
                          {evidence.title}
                        </h3>
                        {evidence.content && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {evidence.content.length > 100
                              ? evidence.content.substring(0, 100) + "..."
                              : evidence.content}
                          </p>
                        )}
                        {evidence.url && (
                          <p className="text-xs text-muted-foreground/60 mb-2">
                            {evidence.url}
                          </p>
                        )}
                        {evidence.metadata && (
                          <div className="text-xs text-muted-foreground mb-3">
                            {Object.entries(evidence.metadata)
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <div key={key}>
                                  <span className="capitalize">{key}:</span>{" "}
                                  {String(value)}
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedEvidence(evidence);
                              setCollapsed(false);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Details
                          </button>
                          <button
                            onClick={() => setSelectedNode(null)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    );
                  }

                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
