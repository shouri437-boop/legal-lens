/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// SUPERSEDED: This hook was used by the old knowledge-graph.tsx monolith.
// Replaced by useGraphSimulation.ts (Plan 03). Preserved for reference.
// ABOUTME: Utility function for creating D3 drag behavior for graph nodes
// ABOUTME: Handles drag start, drag, and drag end events with proper physics simulation integration

import { drag, type D3DragEvent } from "d3-drag";
import type { Simulation } from "d3-force";
import type { GraphNode, GraphConnection } from "@/types/knowledge-graph";

/**
 * Options for creating a drag behavior with click detection
 */
export interface DragBehaviorOptions {
  /** The D3 force simulation instance */
  simulation: Simulation<GraphNode, GraphConnection> | null;
  /** Callback for when a node is clicked (not dragged) */
  onNodeClick?: (node: GraphNode) => void;
  /** Distance threshold in pixels to distinguish click from drag (default: 5) */
  clickThreshold?: number;
}

/**
 * Creates a D3 drag behavior for interactive node manipulation.
 *
 * The drag behavior implements three phases:
 * 1. **Drag Start**: Fixes the node position and reheats the simulation for responsive physics
 * 2. **Drag**: Updates the node's fixed position to follow the cursor
 * 3. **Drag End**: Releases the node and cools down the simulation
 *
 * This creates a natural feel where dragging a node causes the surrounding nodes
 * to adjust their positions in response to the new layout.
 *
 * @param simulation - The D3 force simulation instance
 * @returns D3 drag behavior that can be applied to SVG elements, or null if simulation is null
 */
export function createDragBehavior(
  simulation: Simulation<GraphNode, GraphConnection> | null,
) {
  return createDragBehaviorWithClick({ simulation });
}

/**
 * Creates a D3 drag behavior with click detection for interactive node manipulation.
 *
 * The behavior distinguishes between clicks and drags based on the distance moved.
 * If the distance is less than the threshold, it's treated as a click.
 *
 * @param options - Configuration options for the drag behavior
 * @returns D3 drag behavior that can be applied to SVG elements, or null if simulation is null
 */
export function createDragBehaviorWithClick({
  simulation,
  onNodeClick,
  clickThreshold = 5,
}: DragBehaviorOptions) {
  if (!simulation) {
    return null;
  }

  // Track starting position for click detection
  let dragStartX: number | null = null;
  let dragStartY: number | null = null;

  /**
   * Handles the start of a drag operation.
   * Sets fixed position and increases simulation energy for responsive updates.
   */
  function dragStarted(
    event: D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
    d: GraphNode,
  ) {
    // Store starting position for click detection
    dragStartX = event.x;
    dragStartY = event.y;

    // Only reheat simulation if this is the only active drag
    // event.active tracks the number of concurrent drag operations
    if (!event.active && simulation) {
      simulation.alphaTarget(0.3).restart();
    }

    // Fix the node position at its current location
    // fx and fy are D3's fixed position properties
    const nodeWithPosition = d as GraphNode & {
      x?: number;
      y?: number;
      fx?: number | null;
      fy?: number | null;
    };
    nodeWithPosition.fx = nodeWithPosition.x;
    nodeWithPosition.fy = nodeWithPosition.y;
  }

  /**
   * Handles the drag motion.
   * Updates the node's fixed position to the current cursor location.
   */
  function dragged(
    event: D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
    d: GraphNode,
  ) {
    // Update fixed position to cursor coordinates
    // The simulation will use these values instead of calculating new positions
    const nodeWithPosition = d as GraphNode & {
      fx?: number | null;
      fy?: number | null;
    };
    nodeWithPosition.fx = event.x;
    nodeWithPosition.fy = event.y;
  }

  /**
   * Handles the end of a drag operation.
   * Releases the fixed position and cools down the simulation.
   * Also detects clicks based on drag distance.
   */
  function dragEnded(
    event: D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
    d: GraphNode,
  ) {
    // Calculate drag distance for click detection
    if (dragStartX !== null && dragStartY !== null) {
      const dragDistance = Math.sqrt(
        Math.pow(event.x - dragStartX, 2) + Math.pow(event.y - dragStartY, 2),
      );

      // If distance is below threshold, treat as click
      if (dragDistance < clickThreshold && onNodeClick) {
        onNodeClick(d);
      }
    }

    // Reset starting position
    dragStartX = null;
    dragStartY = null;

    // Cool down simulation when no more active drags
    if (!event.active && simulation) {
      simulation.alphaTarget(0);
    }

    // Release the fixed position - node will now respond to forces again
    // Set to null (not undefined) to remove the constraint
    const nodeWithPosition = d as GraphNode & {
      fx?: number | null;
      fy?: number | null;
    };
    nodeWithPosition.fx = null;
    nodeWithPosition.fy = null;
  }

  // Create and return the drag behavior with typed event handlers
  return drag<SVGCircleElement, GraphNode>()
    .on("start", dragStarted)
    .on("drag", dragged)
    .on("end", dragEnded);
}
