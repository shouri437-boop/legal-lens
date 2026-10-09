import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TimelineApiResponse,
  TimelineFilters,
  TimelineEvent,
} from "@/types/timeline.types";
import { timelineApi } from "@/lib/api/timelineApi";
import {
  getCachedTimelineData,
  setCachedTimelineData,
} from "@/lib/cache/timelineCache";
import { PERFORMANCE_CONFIG } from "@/constants/timeline.constants";

export function useTimelineData(caseId: string, filters: TimelineFilters) {
  const queryClient = useQueryClient();

  // Main data query with caching
  const query = useQuery({
    queryKey: ["timeline", caseId, filters],
    queryFn: async (): Promise<TimelineApiResponse> => {
      // Try cache first
      const cached = getCachedTimelineData(caseId, filters);
      if (
        cached &&
        Date.now() - cached.timestamp < PERFORMANCE_CONFIG.CACHE_TTL
      ) {
        return cached.data;
      }

      // Fetch from API
      const data = await timelineApi.getTimelineEvents(caseId, filters);

      // Validate response
      if (!data || !Array.isArray(data.events)) {
        throw new Error("Invalid timeline data received");
      }

      // Update cache
      setCachedTimelineData(caseId, filters, data);

      return data;
    },
    staleTime: PERFORMANCE_CONFIG.CACHE_TTL,
    gcTime: PERFORMANCE_CONFIG.CACHE_TTL * 2,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Optimistic update mutation
  const updateMutation = useMutation({
    mutationFn: async (event: TimelineEvent) => {
      return await timelineApi.updateTimelineEvent(caseId, event);
    },
    onMutate: async (updatedEvent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["timeline", caseId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TimelineApiResponse>([
        "timeline",
        caseId,
        filters,
      ]);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<TimelineApiResponse>(
          ["timeline", caseId, filters],
          {
            ...previousData,
            events: previousData.events.map((event) =>
              event.id === updatedEvent.id ? updatedEvent : event,
            ),
          },
        );
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          ["timeline", caseId, filters],
          context.previousData,
        );
      }
      console.error("Failed to update timeline event:", error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["timeline", caseId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await timelineApi.deleteTimelineEvent(caseId, eventId);
    },
    onMutate: async (deletedEventId) => {
      await queryClient.cancelQueries({ queryKey: ["timeline", caseId] });

      const previousData = queryClient.getQueryData<TimelineApiResponse>([
        "timeline",
        caseId,
        filters,
      ]);

      if (previousData) {
        queryClient.setQueryData<TimelineApiResponse>(
          ["timeline", caseId, filters],
          {
            ...previousData,
            events: previousData.events.filter(
              (event) => event.id !== deletedEventId,
            ),
            totalCount: previousData.totalCount - 1,
          },
        );
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["timeline", caseId, filters],
          context.previousData,
        );
      }
      console.error("Failed to delete timeline event:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline", caseId] });
    },
  });

  return {
    ...query,
    updateEvent: updateMutation.mutate,
    deleteEvent: deleteMutation.mutate,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
