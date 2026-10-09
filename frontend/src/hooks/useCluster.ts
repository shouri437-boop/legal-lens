/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// SUPERSEDED: This hook was used by the old knowledge-graph.tsx monolith.
// Replaced by useGraphSelection.ts (Plan 03). Preserved for reference.
// ABOUTME: Hook for managing graph cluster selection state and operations
// ABOUTME: Provides adjacency map creation, cluster computation, and state management for node clusters

import { useMemo, useState, useCallback } from "react";
import type { GraphNode, GraphConnection } from "@/types/knowledge-graph";

/**
 * Helper to get node ID from source/target which can be string or GraphNode
 */
const getNodeId = (nodeOrId: string | GraphNode): string => {
  return typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
};

/**
 * Represents the state of a selected cluster in the graph
 */
export interface ClusterState {
  /** ID of the selected/clicked node */
  selectedNodeId: string | null;
  /** Set of all node IDs in the cluster (selected + connected) */
  clusterNodeIds: Set<string>;
  /** Set of connection indices that are within the cluster */
  clusterConnectionIndices: Set<number>;
}

/**
 * Initial empty cluster state
 */
const INITIAL_CLUSTER_STATE: ClusterState = {
  selectedNodeId: null,
  clusterNodeIds: new Set(),
  clusterConnectionIndices: new Set(),
};

/**
 * Hook for managing graph cluster selection and highlighting
 *
 * @param nodes - Array of graph nodes
 * @param connections - Array of graph connections
 * @returns Cluster state and operations
 */
export function useCluster(nodes: GraphNode[], connections: GraphConnection[]) {
  // Cluster selection state
  const [clusterState, setClusterState] = useState<ClusterState>(
    INITIAL_CLUSTER_STATE,
  );

  // Build adjacency map for O(1) neighbor lookups
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    // Initialize empty sets for all nodes
    nodes.forEach((node) => {
      map.set(node.id, new Set<string>());
    });

    // Populate with connections (bidirectional)
    connections.forEach((conn) => {
      const sourceId = getNodeId(conn.source);
      const targetId = getNodeId(conn.target);

      // Add bidirectional connections
      map.get(sourceId)?.add(targetId);
      map.get(targetId)?.add(sourceId);
    });

    return map;
  }, [nodes, connections]);

  /**
   * Compute cluster data for a given node
   * Includes the node itself and all directly connected nodes
   */
  const computeCluster = useCallback(
    (nodeId: string): ClusterState => {
      const neighbors = adjacencyMap.get(nodeId) || new Set<string>();
      const clusterNodeIds = new Set([nodeId, ...neighbors]);

      // Find all connections within the cluster
      const clusterConnectionIndices = new Set<number>();
      connections.forEach((conn, index) => {
        const sourceId = getNodeId(conn.source);
        const targetId = getNodeId(conn.target);

        // Connection is in cluster if both ends are cluster nodes
        if (clusterNodeIds.has(sourceId) && clusterNodeIds.has(targetId)) {
          clusterConnectionIndices.add(index);
        }
      });

      return {
        selectedNodeId: nodeId,
        clusterNodeIds,
        clusterConnectionIndices,
      };
    },
    [adjacencyMap, connections],
  );

  /**
   * Select a node and highlight its cluster
   */
  const selectNode = useCallback(
    (nodeId: string) => {
      if (clusterState.selectedNodeId === nodeId) {
        // Clicking same node again clears selection
        setClusterState(INITIAL_CLUSTER_STATE);
      } else {
        // Select new cluster
        const newCluster = computeCluster(nodeId);
        setClusterState(newCluster);
      }
    },
    [clusterState.selectedNodeId, computeCluster],
  );

  /**
   * Clear the current cluster selection
   */
  const clearSelection = useCallback(() => {
    setClusterState(INITIAL_CLUSTER_STATE);
  }, []);

  /**
   * Check if a node is in the current cluster
   */
  const isNodeInCluster = useCallback(
    (nodeId: string): boolean => {
      return clusterState.clusterNodeIds.has(nodeId);
    },
    [clusterState.clusterNodeIds],
  );

  /**
   * Check if a connection is in the current cluster
   */
  const isConnectionInCluster = useCallback(
    (connectionIndex: number): boolean => {
      return clusterState.clusterConnectionIndices.has(connectionIndex);
    },
    [clusterState.clusterConnectionIndices],
  );

  /**
   * Get opacity value for a node based on cluster state
   */
  const getNodeOpacity = useCallback(
    (nodeId: string): number => {
      if (clusterState.selectedNodeId === null) {
        return 1.0; // No selection, full opacity
      }
      return isNodeInCluster(nodeId) ? 1.0 : 0.15;
    },
    [clusterState.selectedNodeId, isNodeInCluster],
  );

  /**
   * Get opacity value for a connection based on cluster state
   */
  const getConnectionOpacity = useCallback(
    (connectionIndex: number): number => {
      // When no cluster is selected, use uniform opacity for all connections
      if (clusterState.selectedNodeId === null) {
        return 0.6; // Fixed opacity for clean visualization
      }

      // Check if connection is in cluster
      if (!isConnectionInCluster(connectionIndex)) {
        // Fade out connections not in cluster
        return 0.2;
      }

      // Full opacity for cluster connections
      return 0.8;
    },
    [clusterState.selectedNodeId, isConnectionInCluster],
  );

  /**
   * Get scale factor for a node (selected node is scaled up)
   */
  const getNodeScale = useCallback(
    (nodeId: string): number => {
      return nodeId === clusterState.selectedNodeId ? 1.3 : 1.0;
    },
    [clusterState.selectedNodeId],
  );

  /**
   * Get all nodes in the current cluster
   */
  const getClusterNodes = useCallback((): GraphNode[] => {
    if (clusterState.selectedNodeId === null) {
      return [];
    }
    return nodes.filter((node) => clusterState.clusterNodeIds.has(node.id));
  }, [nodes, clusterState]);

  /**
   * Get the number of direct connections for a specific node
   */
  const getConnectionCount = useCallback(
    (nodeId: string): number => {
      return adjacencyMap.get(nodeId)?.size || 0;
    },
    [adjacencyMap],
  );

  /**
   * Compute connection statistics for all nodes
   * Used for smart scaling of node sizes
   */
  const connectionStats = useMemo(() => {
    const counts = nodes.map((node) => adjacencyMap.get(node.id)?.size || 0);
    if (counts.length === 0) {
      return { min: 0, max: 0, average: 0, p50: 0, p75: 0, p90: 0, p95: 0 };
    }

    // Sort for percentile calculations
    const sorted = [...counts].sort((a, b) => a - b);
    const len = sorted.length;

    // Calculate percentiles
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * len) - 1;
      return sorted[Math.max(0, Math.min(index, len - 1))];
    };

    const min = sorted[0];
    const max = sorted[len - 1];
    const sum = counts.reduce((a, b) => a + b, 0);
    const average = sum / len;

    return {
      min,
      max,
      average,
      p50: getPercentile(50), // median
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
    };
  }, [nodes, adjacencyMap]);

  return {
    // State
    clusterState,

    // Operations
    selectNode,
    clearSelection,

    // Queries
    isNodeInCluster,
    isConnectionInCluster,
    getNodeOpacity,
    getConnectionOpacity,
    getNodeScale,
    getClusterNodes,
    getConnectionCount,

    // Statistics
    connectionStats,

    // Raw data
    adjacencyMap,
  };
}
