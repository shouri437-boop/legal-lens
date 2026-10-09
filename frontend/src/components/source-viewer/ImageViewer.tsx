// ABOUTME: Zoomable image viewer with pan/zoom controls and metadata display.
// ABOUTME: Uses CSS transforms for zoom and mouse drag for panning.

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

// ---------------------------------------------------------------------------
// ImageViewer
// ---------------------------------------------------------------------------

interface ImageViewerProps {
  /** Signed URL to the image file. */
  imageUrl: string;
  /** Display file name. */
  fileName: string;
  /** Optional key-value metadata to display below the image. */
  metadata?: Record<string, string>;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export function ImageViewer({
  imageUrl,
  fileName,
  metadata,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Natural image dimensions
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, prev - ZOOM_STEP);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse drag for panning when zoomed
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...pan };
    },
    [zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Scroll wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex flex-col h-full">
      {/* Image container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center bg-charcoal/50 ${
          zoom > 1 ? "cursor-grab" : "cursor-default"
        } ${isDragging ? "cursor-grabbing" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={fileName}
          onLoad={handleImageLoad}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? "none" : "transform 200ms ease-out",
          }}
          draggable={false}
        />
      </div>

      {/* Controls and metadata bar */}
      <div className="flex-none p-4 border-t border-stone/15">
        {/* Zoom controls */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-1.5 rounded-lg bg-charcoal/50 hover:bg-charcoal transition-colors disabled:opacity-40"
            aria-label="Zoom out"
          >
            <ZoomOut size={14} className="text-stone" />
          </button>

          <span className="text-xs text-stone font-mono tabular-nums w-12 text-center">
            {zoomPercent}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-1.5 rounded-lg bg-charcoal/50 hover:bg-charcoal transition-colors disabled:opacity-40"
            aria-label="Zoom in"
          >
            <ZoomIn size={14} className="text-stone" />
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-charcoal/50 hover:bg-charcoal transition-colors ml-2"
            aria-label="Reset zoom"
          >
            <RotateCcw size={14} className="text-stone" />
          </button>
        </div>

        {/* Metadata display */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-stone">File:</span>
            <span className="text-smoke font-mono truncate">{fileName}</span>
          </div>
          {naturalSize && (
            <div className="flex items-center gap-2">
              <span className="text-stone">Dimensions:</span>
              <span className="text-smoke font-mono">
                {naturalSize.width} x {naturalSize.height}
              </span>
            </div>
          )}
          {metadata &&
            Object.entries(metadata).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-stone capitalize">{key}:</span>
                <span className="text-smoke truncate">{value}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
