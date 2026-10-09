/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// SUPERSEDED: These helpers were used by the old knowledge-graph.tsx monolith.
// Replaced by knowledge-graph-config.ts (Plan 01). Preserved for reference.
// ABOUTME: Helper utilities for D3 graph operations
// ABOUTME: Provides node sizing, opacity calculations, and other D3-related utilities

import type {
  GraphNode,
  EntityType,
  EvidenceType,
} from "@/types/knowledge-graph";

/**
 * Default opacity configuration for connections
 */
export const DEFAULT_OPACITY_CONFIG = {
  min: 0.2,
  max: 0.8,
  default: 0.6,
};

/**
 * Calculate node radius based on connection count
 * Nodes with more connections are larger
 */
export function getNodeRadiusByDegree(degree: number): number {
  const minRadius = 20;
  const maxRadius = 50;
  const scaleFactor = 2;

  // Logarithmic scaling for better visual distribution
  const radius = minRadius + Math.log(degree + 1) * scaleFactor;
  return Math.min(radius, maxRadius);
}

/**
 * Calculate node radius based on node type
 * Different types can have different base sizes
 */
export function getNodeRadiusByType(node: GraphNode): number {
  if (node.type === "entity") {
    return 30; // Entities are circles
  } else if (node.type === "evidence") {
    return 30; // Evidence are squares (same size for consistency)
  }
  return 25; // Default
}

/**
 * Get color for entity type
 */
export function getEntityColor(type: EntityType): string {
  const colors: Record<EntityType, string> = {
    person: "#3B82F6",
    organization: "#8B5CF6",
    location: "#10B981",
    event: "#F59E0B",
    document: "#6366F1",
    evidence: "#EC4899",
  };
  return colors[type] || "#6B7280";
}

/**
 * Get color for evidence type
 */
export function getEvidenceColor(type: EvidenceType): string {
  const colors: Record<EvidenceType, string> = {
    text: "#F59E0B",
    image: "#EC4899",
    video: "#8B5CF6",
    audio: "#10B981",
    document: "#6366F1",
  };
  return colors[type] || "#6B7280";
}

/**
 * Calculate connection opacity based on relationship strength
 */
export function getConnectionOpacityByStrength(
  strength: number,
  config = DEFAULT_OPACITY_CONFIG,
): number {
  // Strength is 0-1, map to opacity range
  return config.min + strength * (config.max - config.min);
}

/**
 * Enhanced connection opacity with non-linear scaling
 * Emphasizes stronger connections more dramatically
 */
export function getEnhancedConnectionOpacity(
  strength: number,
  config = DEFAULT_OPACITY_CONFIG,
): number {
  // Apply power function for non-linear emphasis
  const emphasized = Math.pow(strength, 0.7);
  return config.min + emphasized * (config.max - config.min);
}

/**
 * Calculate percentile thresholds for a set of values
 */
export interface PercentileThresholds {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export function calculatePercentileThresholds(
  values: number[],
): PercentileThresholds {
  if (values.length === 0) {
    return { p25: 0, p50: 0, p75: 0, p90: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * len) - 1;
    return sorted[Math.max(0, Math.min(index, len - 1))];
  };

  return {
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
  };
}

/**
 * Get connection opacity based on percentile thresholds
 * Provides better visual distribution across many connections
 */
export function getConnectionOpacityByPercentile(
  strength: number,
  thresholds: PercentileThresholds,
  config = DEFAULT_OPACITY_CONFIG,
): number {
  // Map strength to opacity based on percentile position
  if (strength >= thresholds.p90) {
    return config.max;
  } else if (strength >= thresholds.p75) {
    return config.max * 0.8;
  } else if (strength >= thresholds.p50) {
    return config.max * 0.6;
  } else if (strength >= thresholds.p25) {
    return config.max * 0.4;
  } else {
    return config.min;
  }
}

/**
 * Calculate distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Check if a point is within a circle
 */
export function isPointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  return distance(px, py, cx, cy) <= radius;
}

/**
 * Check if a point is within a rectangle
 */
export function isPointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  width: number,
  height: number,
): boolean {
  return px >= rx && px <= rx + width && py >= ry && py <= ry + height;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}
