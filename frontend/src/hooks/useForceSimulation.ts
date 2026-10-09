/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// SUPERSEDED: This hook was used by the old knowledge-graph.tsx monolith.
// Replaced by useGraphSimulation.ts (Plan 03). Preserved for reference.
// ABOUTME: Custom React hook for managing D3 force simulation physics
// ABOUTME: Handles simulation initialization, tick updates, and cleanup for force-directed graph layout

import { useEffect, useRef, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
} from "d3-force";
import type { GraphNode, GraphConnection } from "@/types/knowledge-graph";

interface UseForceSimulationProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  width: number;
  height: number;
  onTick?: () => void;
  onSimulationCreated?: (
    simulation: Simulation<GraphNode, GraphConnection>,
  ) => void;
  /** Custom function to calculate node radius for collision detection */
  getNodeRadius?: (node: GraphNode) => number;
  /** Link distance (default: 120) */
  linkDistance?: number;
  /** Link strength (default: 0.5) */
  linkStrength?: number;
  /** Charge strength - negative for repulsion (default: -300) */
  chargeStrength?: number;
  /** Maximum distance for charge force (default: 400) */
  chargeDistanceMax?: number;
  /** Collision radius padding (default: 3) */
  collisionPadding?: number;
}

/**
 * Custom hook that initializes and manages a D3 force simulation for graph layout.
 *
 * The simulation applies multiple forces to position nodes:
 * - Link force: Creates spring-like connections between related nodes
 * - Many-body force: Applies repulsion between all nodes (with distance limit for performance)
 * - Center force: Pulls the entire graph toward the center of the viewport
 * - Collision force: Prevents nodes from overlapping
 *
 * @param props - Configuration including nodes, connections, dimensions, tick callback, and simulation ready callback
 * @returns Function to get current simulation instance
 */
export function useForceSimulation({
  nodes,
  connections,
  width,
  height,
  onTick,
  onSimulationCreated,
  getNodeRadius,
  linkDistance = 120,
  linkStrength = 0.5,
  chargeStrength = -300,
  chargeDistanceMax = 400,
  collisionPadding = 3,
}: UseForceSimulationProps) {
  const simulationRef = useRef<Simulation<GraphNode, GraphConnection> | null>(
    null,
  );

  useEffect(() => {
    // Skip if no data provided
    if (nodes.length === 0) {
      return;
    }

    if (width === 0 || height === 0) {
      return;
    }

    // D3 force simulation is designed to mutate nodes in-place, adding x, y, vx, vy properties.
    // The caller is responsible for providing mutable copies of the data.
    // React will see these changes and re-render when we call the onTick callback.

    // Initialize D3 force simulation
    const simulation = forceSimulation<GraphNode>(nodes)
      // Link force: connects nodes based on the connections array
      .force(
        "link",
        forceLink<GraphNode, GraphConnection>(connections)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(linkStrength),
      )
      // Many-body force: nodes repel each other
      .force(
        "charge",
        forceManyBody<GraphNode>()
          .strength(chargeStrength)
          .distanceMax(chargeDistanceMax),
      )
      // Center force: pulls graph toward viewport center
      .force("center", forceCenter<GraphNode>(width / 2, height / 2))
      // Collision force: prevents node overlap
      .force(
        "collide",
        forceCollide<GraphNode>()
          .radius((node) => {
            const baseRadius = getNodeRadius ? getNodeRadius(node) : 30;
            return baseRadius + collisionPadding;
          })
          .strength(0.7),
      );

    // Handle simulation tick events
    simulation.on("tick", () => {
      if (onTick) {
        onTick();
      }
    });

    // Store simulation reference for external access
    simulationRef.current = simulation;

    // Notify callback that simulation is ready
    if (onSimulationCreated) {
      onSimulationCreated(simulation);
    }

    // Cleanup function: stop simulation when component unmounts or dependencies change
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [
    nodes,
    connections,
    width,
    height,
    onTick,
    onSimulationCreated,
    getNodeRadius,
    linkDistance,
    linkStrength,
    chargeStrength,
    chargeDistanceMax,
    collisionPadding,
  ]);

  // Return a stable getter function for accessing the simulation
  const getSimulation = useCallback(() => simulationRef.current, []);

  return getSimulation;
}
