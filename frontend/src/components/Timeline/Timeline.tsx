"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { TimelineCore } from "./TimelineCore";
import { BuildTimelineButton } from "./BuildTimelineButton";
import { TimelineControls } from "./TimelineControls";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineSkeleton } from "./TimelineSkeleton";
import { EventDetailModal } from "../EventDetail/EventDetailModal";
import { SourceViewerModal } from "@/components/source-viewer/SourceViewerModal";
import { useTimelineData } from "@/hooks/useTimelineData";
import { useTimelineFilters } from "@/hooks/useTimelineFilters";
import { useTimelineSSE } from "@/hooks/useTimelineSSE";
import { useSourceNavigation } from "@/hooks/useSourceNavigation";
import type { TimelineProps, TimelineEvent } from "@/types/timeline.types";

export function Timeline({
  caseId,
  initialEvents = [],
  onEventClick,
  enableRealtimeUpdates = true,
  className,
}: TimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(
    null,
  );

  // Filter and zoom state
  const {
    zoomLevel,
    setZoomLevel,
    selectedLayers,
    setSelectedLayers,
    filters,
  } = useTimelineFilters();

  // Data fetching
  const {
    data: timelineData,
    isLoading,
    error,
    refetch,
  } = useTimelineData(caseId, filters);

  // Real-time updates via SSE
  useTimelineSSE(caseId, {
    enabled: enableRealtimeUpdates,
    onEventCreated: () => refetch(),
    onEventUpdated: () => refetch(),
    onEventDeleted: () => refetch(),
  });

  // Source navigation for EventDetailModal source document clicks
  const {
    openFromFinding: detailOpenFromFinding,
    sourceContent: detailSourceContent,
    closeSource: detailCloseSource,
  } = useSourceNavigation(caseId);

  // Filter events by selected layers
  const filteredEvents = useMemo(() => {
    const events = timelineData?.events || initialEvents;
    return events.filter((event) => selectedLayers.includes(event.layer));
  }, [timelineData?.events, initialEvents, selectedLayers]);

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
    onEventClick?.(event);
  };

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Failed to load timeline
        </div>
        <p className="text-sm mt-2 text-muted-foreground">
          {error.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 rounded-md transition-colors font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalEvents = timelineData?.events.length || initialEvents.length;

  return (
    <div className={`relative ${className ?? ""}`}>
      <TimelineHeader
        dateRange={timelineData?.dateRange}
        layerCounts={timelineData?.layerCounts}
      />

      <BuildTimelineButton caseId={caseId} className="px-6 pt-3" />

      <TimelineControls
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        selectedLayers={selectedLayers}
        onLayersChange={setSelectedLayers}
        totalEvents={totalEvents}
        filteredEvents={filteredEvents.length}
      />

      <TimelineCore
        events={filteredEvents}
        zoomLevel={zoomLevel}
        caseId={caseId}
        onEventClick={handleEventClick}
      />

      {selectedEvent && (
        <EventDetailModal
          caseId={caseId}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onViewSource={detailOpenFromFinding}
        />
      )}

      {/* Source Viewer Modal for EventDetailModal source clicks (z above modal's z-100) */}
      {detailSourceContent &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          >
            <div className="w-full max-w-5xl h-[85vh]">
              <SourceViewerModal
                content={detailSourceContent}
                onClose={detailCloseSource}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
