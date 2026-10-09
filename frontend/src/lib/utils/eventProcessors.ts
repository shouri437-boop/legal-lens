import { TimelineEvent, TimelineLayer } from "@/types/timeline.types";

/**
 * Sort events chronologically
 */
export function sortEventsByDate(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

/**
 * Group events by date key
 */
export function groupEventsByDate(
  events: TimelineEvent[],
  groupingFn: (date: Date) => string,
): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};

  events.forEach((event) => {
    const date = new Date(event.date);
    const key = groupingFn(date);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(event);
  });

  return groups;
}

/**
 * Filter events by confidence threshold
 */
export function filterByConfidence(
  events: TimelineEvent[],
  minConfidence: number,
): TimelineEvent[] {
  return events.filter((event) => event.confidence >= minConfidence);
}

/**
 * Filter events by layers
 */
export function filterByLayers(
  events: TimelineEvent[],
  layers: TimelineLayer[],
): TimelineEvent[] {
  return events.filter((event) => layers.includes(event.layer));
}

/**
 * Search events by query
 */
export function searchEvents(
  events: TimelineEvent[],
  query: string,
): TimelineEvent[] {
  const lowerQuery = query.toLowerCase();

  return events.filter((event) => {
    return (
      event.title.toLowerCase().includes(lowerQuery) ||
      event.description?.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get event statistics
 */
export function getEventStatistics(events: TimelineEvent[]) {
  const layerCounts: Record<TimelineLayer, number> = {
    evidence: 0,
    legal: 0,
    strategy: 0,
    financial: 0,
  };

  let totalConfidence = 0;
  let userCorrectedCount = 0;

  events.forEach((event) => {
    layerCounts[event.layer]++;
    totalConfidence += event.confidence;
    if (event.isUserCorrected) {
      userCorrectedCount++;
    }
  });

  return {
    total: events.length,
    layerCounts,
    averageConfidence: events.length > 0 ? totalConfidence / events.length : 0,
    userCorrectedCount,
    userCorrectedPercentage:
      events.length > 0 ? (userCorrectedCount / events.length) * 100 : 0,
  };
}
