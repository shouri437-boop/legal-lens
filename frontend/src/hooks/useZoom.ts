// ABOUTME: Utility function for creating D3 zoom and pan behavior for the graph canvas
// ABOUTME: Handles zoom events, programmatic zoom controls, and coordinate transformations

import {
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
} from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";
import type { ZoomTransform } from "d3-zoom";
import { useEffect, useRef, useCallback } from "react";

/**
 * Controller interface for programmatic zoom operations.
 * Provides methods to control zoom level via code (e.g., from UI buttons).
 */
export interface ZoomController {
  /**
   * Zooms in by a scale factor with smooth transition.
   * @param scaleFactor - Multiplier for current scale (default: 1.3)
   */
  zoomIn: (scaleFactor?: number) => void;

  /**
   * Zooms out by a scale factor with smooth transition.
   * @param scaleFactor - Divisor for current scale (default: 1.3)
   */
  zoomOut: (scaleFactor?: number) => void;

  /**
   * Resets zoom to initial state (scale: 1, translate: [0, 0]).
   */
  resetZoom: () => void;

  /**
   * Gets the current zoom transform.
   */
  getCurrentTransform: () => ZoomTransform;

  /**
   * Applies a specific zoom transform with animation.
   * Useful for zoom-to-cluster or zoom-to-fit operations.
   * @param transform - The target zoom transform
   * @param duration - Animation duration in milliseconds (default: 500)
   */
  applyTransform: (transform: ZoomTransform, duration?: number) => void;
}

interface UseZoomOptions {
  /** The SVG element to attach zoom behavior to */
  svgElement: SVGSVGElement | null;
  /** Callback fired when zoom transform changes */
  onTransformChange: (transform: ZoomTransform) => void;
  /** Width of the container for translate extent calculation */
  containerWidth: number;
  /** Height of the container for translate extent calculation */
  containerHeight: number;
  /** Minimum zoom scale (default: 0.1) */
  minScale?: number;
  /** Maximum zoom scale (default: 5) */
  maxScale?: number;
}

/**
 * Hook for creating D3 zoom behavior for interactive graph navigation.
 *
 * The zoom behavior enables:
 * 1. **Mouse Wheel Zoom**: Zoom in/out centered on cursor position
 * 2. **Pan**: Click and drag on empty space to pan the view
 * 3. **Programmatic Control**: Zoom in/out/reset via returned controller methods
 *
 * The zoom transform is applied to the graph container group, moving all nodes
 * and connections together while preserving their relative positions.
 *
 * @param options - Configuration options
 * @returns ZoomController for programmatic zoom operations, or null if svgElement is null
 */
export function useZoom({
  svgElement,
  onTransformChange,
  containerWidth,
  containerHeight,
  minScale = 0.1,
  maxScale = 5,
}: UseZoomOptions): ZoomController | null {
  // Track current transform for programmatic operations
  const currentTransformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomBehaviorRef = useRef<ZoomBehavior<
    SVGSVGElement,
    Record<string, unknown>
  > | null>(null);

  useEffect(() => {
    if (!svgElement || containerWidth === 0 || containerHeight === 0) {
      return;
    }

    // Calculate translate extent to prevent panning too far off-canvas
    // Allow panning 2x container size in each direction for flexibility
    const translateExtent: [[number, number], [number, number]] = [
      [-containerWidth * 2, -containerHeight * 2],
      [containerWidth * 3, containerHeight * 3],
    ];

    /**
     * Handles zoom events from mouse wheel and pan gestures.
     * Updates the current transform and notifies parent component.
     */
    function handleZoom(
      event: D3ZoomEvent<SVGSVGElement, Record<string, unknown>>,
    ) {
      currentTransformRef.current = event.transform;
      onTransformChange(event.transform);
    }

    // Create zoom behavior with constraints
    const zoomBehavior = zoom<SVGSVGElement, Record<string, unknown>>()
      .scaleExtent([minScale, maxScale])
      .translateExtent(translateExtent)
      .on("zoom", handleZoom);

    // Apply zoom behavior to SVG element
    const svg = select<SVGSVGElement, Record<string, unknown>>(svgElement);
    svg.call(zoomBehavior);

    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on(".zoom", null);
    };
  }, [
    svgElement,
    onTransformChange,
    containerWidth,
    containerHeight,
    minScale,
    maxScale,
  ]);

  /**
   * Applies a programmatic zoom transformation with smooth transition.
   */
  const applyProgrammaticZoom = useCallback(
    (transform: ZoomTransform, duration: number = 300) => {
      if (!svgElement || !zoomBehaviorRef.current) return;

      const svg = select<SVGSVGElement, Record<string, unknown>>(svgElement);
      svg
        .transition()
        .duration(duration)
        .call(zoomBehaviorRef.current.transform, transform);
    },
    [svgElement],
  );

  const zoomIn = useCallback(
    (scaleFactor = 1.3) => {
      const newScale = currentTransformRef.current.k * scaleFactor;
      // Respect scale extent limits
      if (newScale > maxScale) {
        return;
      }

      // Scale centered on current view
      const newTransform = currentTransformRef.current.scale(scaleFactor);
      applyProgrammaticZoom(newTransform);
    },
    [maxScale, applyProgrammaticZoom],
  );

  const zoomOut = useCallback(
    (scaleFactor = 1.3) => {
      const newScale = currentTransformRef.current.k / scaleFactor;
      // Respect scale extent limits
      if (newScale < minScale) {
        return;
      }

      // Scale centered on current view
      const newTransform = currentTransformRef.current.scale(1 / scaleFactor);
      applyProgrammaticZoom(newTransform);
    },
    [minScale, applyProgrammaticZoom],
  );

  const resetZoom = useCallback(() => {
    applyProgrammaticZoom(zoomIdentity, 500);
  }, [applyProgrammaticZoom]);

  const getCurrentTransform = useCallback(() => {
    return currentTransformRef.current;
  }, []);

  const applyTransform = useCallback(
    (transform: ZoomTransform, duration = 500) => {
      applyProgrammaticZoom(transform, duration);
    },
    [applyProgrammaticZoom],
  );

  if (!svgElement) {
    return null;
  }

  return {
    zoomIn,
    zoomOut,
    resetZoom,
    getCurrentTransform,
    applyTransform,
  };
}
