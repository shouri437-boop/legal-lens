import {
  TimelineApiResponse,
  TimelineApiResponseSchema,
  TimelineEvent,
  TimelineEventSchema,
  TimelineFilters,
  TimelineLayer,
} from "@/types/timeline.types";
import { API_CONFIG } from "@/constants/timeline.constants";
import { getToken } from "@/lib/auth-client";

/** Known timeline layers for safe type narrowing from backend string values. */
const VALID_LAYERS = new Set<string>([
  "evidence",
  "legal",
  "strategy",
  "financial",
]);

/** Map a backend TimelineEventResponse object to the frontend TimelineEvent shape. */
function transformBackendEvent(
  backendEvent: Record<string, unknown>,
): Record<string, unknown> {
  const rawLayer = (backendEvent.layer as string) ?? "evidence";
  const layer: TimelineLayer = VALID_LAYERS.has(rawLayer)
    ? (rawLayer as TimelineLayer)
    : "evidence";

  // Extract finding IDs from citations array (backend stores [{finding_id: uuid}, ...]).
  // source_entity_ids are KG entity UUIDs — distinct from source finding IDs.
  const rawCitations = backendEvent.citations;
  const findingIds: string[] = Array.isArray(rawCitations)
    ? rawCitations
        .map((c: unknown) => {
          if (typeof c === "object" && c !== null && "finding_id" in c) {
            return (c as { finding_id: unknown }).finding_id;
          }
          return undefined;
        })
        .filter((id: unknown): id is string => typeof id === "string")
    : [];

  return {
    id: backendEvent.id as string,
    caseId: backendEvent.case_id as string,
    title: backendEvent.title as string,
    description: (backendEvent.description as string | undefined) ?? undefined,
    date: (backendEvent.event_date as string) ?? "",
    layer,
    sourceIds: findingIds,
    entityIds: (backendEvent.source_entity_ids as string[]) ?? [],
    confidence: 0.8,
    isUserCorrected: false,
    eventType: (backendEvent.event_type as string | undefined) ?? undefined,
    metadata: {
      eventType: backendEvent.event_type,
      citations: backendEvent.citations,
    },
    createdAt: (backendEvent.created_at as string) ?? "",
    updatedAt: (backendEvent.created_at as string) ?? "",
  };
}

class TimelineApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.TIMELINE_BASE_PATH;
  }

  /**
   * Build authorization headers using the JWT token from Better Auth.
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Fetch timeline events with filters.
   * Transforms backend TimelineEventResponse objects to frontend TimelineEvent shape.
   */
  async getTimelineEvents(
    caseId: string,
    filters: TimelineFilters,
  ): Promise<TimelineApiResponse> {
    const params = new URLSearchParams();

    if (filters.layers && filters.layers.length > 0) {
      params.append("layers", filters.layers.join(","));
    }
    if (filters.startDate) {
      params.append("startDate", filters.startDate);
    }
    if (filters.endDate) {
      params.append("endDate", filters.endDate);
    }
    if (filters.searchQuery) {
      params.append("q", filters.searchQuery);
    }
    if (filters.minConfidence !== undefined) {
      params.append("minConfidence", String(filters.minConfidence));
    }
    if (filters.showUserCorrectedOnly) {
      params.append("userCorrectedOnly", "true");
    }

    const url = `${this.baseUrl}/${caseId}/timeline?${params.toString()}`;
    const headers = await this.getAuthHeaders();

    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch timeline events: ${response.statusText}`,
      );
    }

    const rawData = await response.json();

    // Transform backend events to frontend format
    const rawEvents = (rawData.events ?? []) as Record<string, unknown>[];
    const transformedEvents = rawEvents.map(transformBackendEvent);

    const transformed = {
      events: transformedEvents,
      totalCount: rawData.totalCount ?? 0,
      dateRange: rawData.dateRange ?? { earliest: "", latest: "" },
      layerCounts: rawData.layerCounts ?? {},
    };

    // Validate response schema
    const validated = TimelineApiResponseSchema.parse(transformed);
    return validated;
  }

  /**
   * Create a new timeline event
   */
  async createTimelineEvent(
    caseId: string,
    event: Omit<TimelineEvent, "id" | "caseId" | "createdAt" | "updatedAt">,
  ): Promise<TimelineEvent> {
    const url = `${this.baseUrl}/${caseId}/timeline`;

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create timeline event: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return TimelineEventSchema.parse(data.event);
  }

  /**
   * Update an existing timeline event
   */
  async updateTimelineEvent(
    caseId: string,
    event: TimelineEvent,
  ): Promise<TimelineEvent> {
    const url = `${this.baseUrl}/${caseId}/timeline/${event.id}`;

    const response = await this.fetchWithTimeout(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to update timeline event: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return TimelineEventSchema.parse(data.event);
  }

  /**
   * Delete a timeline event
   */
  async deleteTimelineEvent(caseId: string, eventId: string): Promise<void> {
    const url = `${this.baseUrl}/${caseId}/timeline/${eventId}`;

    const response = await this.fetchWithTimeout(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to delete timeline event: ${response.statusText}`,
      );
    }
  }

  /**
   * Trigger automated timeline extraction
   */
  async extractTimelineEvents(
    caseId: string,
    options?: {
      fileIds?: string[];
      forceReprocess?: boolean;
    },
  ): Promise<{
    taskId: string;
    estimatedDuration: number;
    filesQueued: number;
  }> {
    const url = `${this.baseUrl}/${caseId}/timeline/extract`;

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options || {}),
    });

    if (!response.ok) {
      throw new Error(`Failed to start extraction: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get extraction task status
   */
  async getExtractionStatus(
    caseId: string,
    taskId: string,
  ): Promise<{
    taskId: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    filesProcessed: number;
    eventsExtracted: number;
    errors?: string[];
  }> {
    const url = `${this.baseUrl}/${caseId}/timeline/extract/${taskId}`;

    const response = await this.fetchWithTimeout(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get extraction status: ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      API_CONFIG.REQUEST_TIMEOUT,
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const timelineApi = new TimelineApiClient();
