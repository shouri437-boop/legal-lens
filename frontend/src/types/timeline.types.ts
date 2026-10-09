import { z } from "zod";

// Layer system
export const TimelineLayerSchema = z.enum([
  "evidence",
  "legal",
  "strategy",
  "financial",
]);
export type TimelineLayer = z.infer<typeof TimelineLayerSchema>;

// Zoom levels
export const TimelineZoomLevelSchema = z.enum(["day", "week", "month", "year"]);
export type TimelineZoomLevel = z.infer<typeof TimelineZoomLevelSchema>;

// Core event model - FIXED: Made all critical fields required
export const TimelineEventSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string(), // ISO 8601 format (may lack timezone offset from backend)
  layer: TimelineLayerSchema,
  sourceIds: z.array(z.string()).default([]),
  entityIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
  isUserCorrected: z.boolean().default(false),
  eventType: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// API Response types
export const TimelineApiResponseSchema = z.object({
  events: z.array(TimelineEventSchema),
  totalCount: z.number(),
  dateRange: z.object({
    earliest: z.string(),
    latest: z.string(),
  }),
  layerCounts: z.record(z.string(), z.number()),
  pagination: z
    .object({
      limit: z.number(),
      offset: z.number(),
      hasMore: z.boolean(),
    })
    .optional(),
});

export type TimelineApiResponse = z.infer<typeof TimelineApiResponseSchema>;

// Filter configuration
export interface TimelineFilters {
  layers: TimelineLayer[];
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  minConfidence?: number;
  showUserCorrectedOnly?: boolean;
}

// Component props
export interface TimelineProps {
  caseId: string;
  initialEvents?: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
  onEventUpdate?: (event: TimelineEvent) => Promise<void>;
  onEventDelete?: (eventId: string) => Promise<void>;
  enableRealtimeUpdates?: boolean;
  enableOfflineSupport?: boolean;
  className?: string;
}

// SSE Event types
export type TimelineSSEEventType =
  | "timeline-event-created"
  | "timeline-event-updated"
  | "timeline-event-deleted"
  | "timeline-extraction-started"
  | "timeline-extraction-progress"
  | "timeline-extraction-complete";

export interface TimelineSSEEvent {
  type: TimelineSSEEventType;
  caseId: string;
  data: unknown;
  timestamp: string;
}
