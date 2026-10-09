"use client";

import React from "react";
import { Calendar, TrendingUp } from "lucide-react";
import { formatEventDate } from "@/lib/utils/dateFormatters";
import { TimelineLayer } from "@/types/timeline.types";
import { LAYER_CONFIG } from "@/constants/timeline.constants";
import { cn } from "@/lib/utils";

interface TimelineHeaderProps {
  dateRange?: {
    earliest: string;
    latest: string;
  };
  layerCounts?: Record<TimelineLayer, number>;
  className?: string;
}

export function TimelineHeader({
  dateRange,
  layerCounts,
  className,
}: TimelineHeaderProps) {
  const totalEvents = layerCounts
    ? Object.values(layerCounts).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div
      className={cn(
        "border-b bg-background dark:bg-charcoal border-border",
        className,
      )}
    >
      <div className="py-3 px-6">
        {/* Title and description */}
        <div className="mb-4">
          <h1 className="text-base font-medium mb-0.5 tracking-tight text-foreground">
            Case Timeline
          </h1>
          <p className="text-xs max-w-2xl tracking-body text-stone">
            Chronological visualization of case events extracted from documents,
            organized by evidence, legal proceedings, and strategic actions.
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total events card */}
          <div className="rounded-lg p-4 border bg-white/95 dark:bg-[rgba(17,17,17,0.6)] border-blue-300/30 dark:border-blue-800/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Total Events
              </span>
              <TrendingUp className="w-4 h-4 text-blue-400/70 dark:text-blue-500/60" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {totalEvents}
            </div>
          </div>

          {/* Date range card */}
          {dateRange && dateRange.earliest && dateRange.latest && (
            <div className="rounded-lg p-4 border bg-white/95 dark:bg-[rgba(17,17,17,0.6)] border-purple-300/30 dark:border-purple-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Date Range
                </span>
                <Calendar className="w-4 h-4 text-purple-400/70 dark:text-purple-500/60" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatEventDate(dateRange.earliest, "MMM d, yyyy")}
              </div>
              <div className="text-xs text-muted-foreground">
                to {formatEventDate(dateRange.latest, "MMM d, yyyy")}
              </div>
            </div>
          )}

          {/* Layer breakdown cards */}
          {layerCounts &&
            (Object.keys(layerCounts) as TimelineLayer[])
              .slice(0, 2)
              .map((layer) => {
                const config = LAYER_CONFIG[layer];
                const count = layerCounts[layer] || 0;

                return (
                  <div
                    key={layer}
                    className="rounded-lg p-4 border bg-white/95 dark:bg-[rgba(17,17,17,0.6)]"
                    style={{
                      borderColor: config.hexColor + "20",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-sm font-medium opacity-70"
                        style={{ color: config.hexColor }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div
                      className="text-xl font-bold opacity-80"
                      style={{ color: config.hexColor }}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
