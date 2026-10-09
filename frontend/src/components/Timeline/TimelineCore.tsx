"use client";

import {
  useScroll,
  useTransform,
  motion,
  AnimatePresence,
} from "framer-motion";
import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatEventDate } from "@/lib/utils/dateFormatters";
import { TimelineEvent, TimelineZoomLevel } from "@/types/timeline.types";
import { TimelineEventCard } from "./TimelineEventCard";
import { SourceViewerModal } from "@/components/source-viewer/SourceViewerModal";
import { useSourceNavigation } from "@/hooks/useSourceNavigation";
import { ZOOM_CONFIG } from "@/constants/timeline.constants";
import { cn } from "@/lib/utils";

interface TimelineCoreProps {
  events: TimelineEvent[];
  zoomLevel: TimelineZoomLevel;
  caseId: string;
  onEventClick?: (event: TimelineEvent) => void;
  className?: string;
}

interface GroupedEvents {
  [key: string]: TimelineEvent[];
}

export function TimelineCore({
  events,
  zoomLevel,
  caseId,
  onEventClick,
  className,
}: TimelineCoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Source navigation for citation clicks
  const {
    openSource: timelineOpenSource,
    sourceContent: timelineSourceContent,
    closeSource: timelineCloseSource,
  } = useSourceNavigation(caseId);

  // Group events by zoom level
  const groupedEvents = useMemo(() => {
    const groups: GroupedEvents = {};
    const { groupingKey } = ZOOM_CONFIG[zoomLevel];

    events.forEach((event) => {
      const eventDate = new Date(event.date);
      const key = groupingKey(eventDate);

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });

    // Sort events within each group by date
    Object.keys(groups).forEach((key) => {
      groups[key].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    });

    return groups;
  }, [events, zoomLevel]);

  // Sort group keys chronologically
  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedEvents).sort((a, b) => {
      const dateA = new Date(groupedEvents[a][0].date);
      const dateB = new Date(groupedEvents[b][0].date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [groupedEvents]);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref, events, zoomLevel]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  // Format title based on first event in the group
  const formatGroupTitle = (groupKey: string) => {
    const firstEvent = groupedEvents[groupKey][0];
    const date = new Date(firstEvent.date);
    const { dateFormat } = ZOOM_CONFIG[zoomLevel];
    return formatEventDate(date, dateFormat);
  };

  return (
    <div
      className={cn(
        "relative w-full font-sans px-6 bg-background max-w-5xl mx-auto",
        className,
      )}
      ref={containerRef}
    >
      {sortedGroupKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-sm text-muted-foreground">
            No timeline events found
          </div>
          <p className="text-sm mt-2 text-muted-foreground">
            Try adjusting your filters, or build the timeline from the documents
            using the button above
          </p>
        </div>
      ) : (
        <div ref={ref} className="relative pb-20">
          <AnimatePresence mode="popLayout">
            {sortedGroupKeys.map((groupKey, groupIndex) => {
              const groupEvents = groupedEvents[groupKey];

              return (
                <motion.div
                  key={groupKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: groupIndex * 0.05 }}
                  className="flex justify-start pt-10 md:pt-20 md:gap-6"
                >
                  {/* Timeline marker and date */}
                  <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
                    <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full flex items-center justify-center border dark:shadow-none bg-white/95 dark:bg-[rgba(17,17,17,0.9)] border-blue-300/25 dark:border-blue-800/30">
                      <div
                        className="h-3.5 w-3.5 rounded-full"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(59,130,246,0.5) 0%, rgba(37,99,235,0.5) 100%)",
                        }}
                      />
                    </div>

                    <h3 className="hidden md:block text-lg md:pl-20 md:text-3xl font-bold tracking-tight text-foreground">
                      {formatGroupTitle(groupKey)}
                    </h3>
                  </div>

                  {/* Event cards */}
                  <div className="relative pl-20 pr-4 md:pl-4 w-full space-y-4">
                    <h3 className="md:hidden block text-xl mb-4 text-left font-bold tracking-tight text-foreground">
                      {formatGroupTitle(groupKey)}
                    </h3>

                    {groupEvents.map((event, eventIndex) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: groupIndex * 0.05 + eventIndex * 0.02,
                        }}
                      >
                        <TimelineEventCard
                          event={event}
                          onClick={() => onEventClick?.(event)}
                          onViewCitation={(citation) =>
                            timelineOpenSource(citation)
                          }
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Animated progress line */}
          <div
            style={{
              height: height + "px",
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(59, 130, 246, 0.1) 10%, rgba(59, 130, 246, 0.1) 90%, transparent 100%)",
            }}
            className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px]"
          >
            <motion.div
              style={{
                height: heightTransform,
                opacity: opacityTransform,
                background:
                  "linear-gradient(to top, rgba(37, 99, 235, 0.35) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 100%)",
              }}
              className="absolute inset-x-0 top-0 w-[2px] rounded-full"
            />
          </div>
        </div>
      )}

      {/* Source Viewer Modal for timeline citation clicks */}
      {timelineSourceContent &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          >
            <div className="w-full max-w-5xl h-[85vh]">
              <SourceViewerModal
                content={timelineSourceContent}
                onClose={timelineCloseSource}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
