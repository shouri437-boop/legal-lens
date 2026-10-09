// ABOUTME: Shared zoom control button panel for canvas components (ReactFlow, D3, etc).
// ABOUTME: Renders zoom in/out/reset buttons with optional fit-view and extra controls slot.

import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { clsx } from "clsx";

interface CanvasZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitView?: () => void;
  extraControls?: React.ReactNode;
  className?: string;
}

const buttonClass =
  "w-10 h-10 rounded-lg bg-white/90 dark:bg-jet/90 hover:bg-white dark:hover:bg-jet text-foreground flex items-center justify-center transition-colors border border-warm-gray/20 dark:border-stone/20";

export function CanvasZoomControls({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
  extraControls,
  className,
}: CanvasZoomControlsProps) {
  return (
    <div
      className={clsx(
        "absolute bottom-4 right-4 flex flex-col gap-2",
        className,
      )}
    >
      <button onClick={onZoomIn} className={buttonClass} title="Zoom In">
        <ZoomIn className="w-5 h-5" />
      </button>
      <button onClick={onZoomOut} className={buttonClass} title="Zoom Out">
        <ZoomOut className="w-5 h-5" />
      </button>
      <button onClick={onResetZoom} className={buttonClass} title="Reset Zoom">
        <RotateCcw className="w-5 h-5" />
      </button>
      {onFitView && (
        <button onClick={onFitView} className={buttonClass} title="Fit View">
          <Maximize2 className="w-5 h-5" />
        </button>
      )}
      {extraControls && (
        <>
          <div className="h-px bg-warm-gray/20 dark:bg-stone/20 my-1" />
          {extraControls}
        </>
      )}
    </div>
  );
}
