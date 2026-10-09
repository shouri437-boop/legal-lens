import { TimelineEvent } from "@/types/timeline.types";

/**
 * Calculate similarity score between two events (0-1)
 */
function calculateSimilarity(
  event1: TimelineEvent,
  event2: TimelineEvent,
): number {
  let score = 0;

  // Same date (exact match)
  if (event1.date === event2.date) {
    score += 0.4;
  }
  // Same day (within 24 hours)
  else if (
    Math.abs(
      new Date(event1.date).getTime() - new Date(event2.date).getTime(),
    ) <
    24 * 60 * 60 * 1000
  ) {
    score += 0.2;
  }

  // Similar title (Levenshtein distance)
  const titleSimilarity = calculateStringSimilarity(event1.title, event2.title);
  score += titleSimilarity * 0.3;

  // Same layer
  if (event1.layer === event2.layer) {
    score += 0.2;
  }

  // Overlapping source documents
  if (event1.sourceIds && event2.sourceIds) {
    const overlap = event1.sourceIds.filter((id) =>
      event2.sourceIds!.includes(id),
    ).length;
    const total = new Set([...event1.sourceIds, ...event2.sourceIds]).size;
    score += (overlap / total) * 0.1;
  }

  return score;
}

/**
 * Simple string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find duplicate events using similarity threshold
 */
export function findDuplicateEvents(
  events: TimelineEvent[],
  similarityThreshold: number = 0.7,
): TimelineEvent[][] {
  const duplicateGroups: TimelineEvent[][] = [];
  const processed = new Set<string>();

  events.forEach((event1, index) => {
    if (processed.has(event1.id)) return;

    const group: TimelineEvent[] = [event1];
    processed.add(event1.id);

    events.slice(index + 1).forEach((event2) => {
      if (processed.has(event2.id)) return;

      const similarity = calculateSimilarity(event1, event2);
      if (similarity >= similarityThreshold) {
        group.push(event2);
        processed.add(event2.id);
      }
    });

    if (group.length > 1) {
      duplicateGroups.push(group);
    }
  });

  return duplicateGroups;
}

/**
 * Merge duplicate events into single consolidated event
 */
export function mergeEvents(events: TimelineEvent[]): TimelineEvent {
  if (events.length === 0) {
    throw new Error("Cannot merge empty event array");
  }

  if (events.length === 1) {
    return events[0];
  }

  // Prefer user-corrected events
  const userCorrected = events.find((e) => e.isUserCorrected);
  if (userCorrected) {
    return userCorrected;
  }

  // Sort by confidence and take highest
  const sorted = [...events].sort((a, b) => b.confidence - a.confidence);
  const primary = sorted[0];

  // Merge source IDs and entity IDs
  const allSourceIds = new Set<string>();
  const allEntityIds = new Set<string>();

  events.forEach((event) => {
    event.sourceIds?.forEach((id) => allSourceIds.add(id));
    event.entityIds?.forEach((id) => allEntityIds.add(id));
  });

  // Calculate merged confidence (average)
  const averageConfidence =
    events.reduce((sum, e) => sum + e.confidence, 0) / events.length;

  return {
    ...primary,
    sourceIds: Array.from(allSourceIds),
    entityIds: Array.from(allEntityIds),
    confidence: averageConfidence,
    metadata: {
      ...primary.metadata,
      mergedFrom: events.map((e) => e.id),
      mergedCount: events.length,
    },
  };
}

/**
 * Deduplicate events array
 */
export function deduplicateEvents(
  events: TimelineEvent[],
  similarityThreshold: number = 0.7,
): TimelineEvent[] {
  const duplicateGroups = findDuplicateEvents(events, similarityThreshold);
  const mergedEvents = duplicateGroups.map((group) => mergeEvents(group));

  // Get IDs of all events that were merged
  const mergedIds = new Set<string>();
  duplicateGroups.forEach((group) => {
    group.forEach((event) => mergedIds.add(event.id));
  });

  // Return merged events + non-duplicate events
  const nonDuplicates = events.filter((event) => !mergedIds.has(event.id));

  return [...mergedEvents, ...nonDuplicates];
}
