import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "./useDebounce";
import {
  TimelineZoomLevel,
  TimelineLayer,
  TimelineFilters,
} from "@/types/timeline.types";
import { PERFORMANCE_CONFIG } from "@/constants/timeline.constants";

export function useTimelineFilters() {
  const [zoomLevel, setZoomLevel] = useState<TimelineZoomLevel>("month");
  const [selectedLayers, setSelectedLayers] = useState<TimelineLayer[]>([
    "evidence",
    "legal",
    "strategy",
    "financial",
  ]);
  const [dateRange, setDateRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [showUserCorrectedOnly, setShowUserCorrectedOnly] = useState(false);

  // Debounce search query to reduce API calls
  const debouncedSearchQuery = useDebounce(
    searchQuery,
    PERFORMANCE_CONFIG.DEBOUNCE_DELAY,
  );

  // Memoized filters object
  const filters: TimelineFilters = useMemo(
    () => ({
      layers: selectedLayers,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      searchQuery: debouncedSearchQuery || undefined,
      minConfidence: minConfidence > 0 ? minConfidence : undefined,
      showUserCorrectedOnly: showUserCorrectedOnly || undefined,
    }),
    [
      selectedLayers,
      dateRange.startDate,
      dateRange.endDate,
      debouncedSearchQuery,
      minConfidence,
      showUserCorrectedOnly,
    ],
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setZoomLevel("month");
    setSelectedLayers(["evidence", "legal", "strategy", "financial"]);
    setDateRange({});
    setSearchQuery("");
    setMinConfidence(0);
    setShowUserCorrectedOnly(false);
  }, []);

  // Check if any non-default filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      selectedLayers.length < 4 ||
      !!dateRange.startDate ||
      !!dateRange.endDate ||
      !!searchQuery ||
      minConfidence > 0 ||
      showUserCorrectedOnly
    );
  }, [
    selectedLayers,
    dateRange.startDate,
    dateRange.endDate,
    searchQuery,
    minConfidence,
    showUserCorrectedOnly,
  ]);

  return {
    // State
    zoomLevel,
    selectedLayers,
    dateRange,
    searchQuery,
    minConfidence,
    showUserCorrectedOnly,

    // Setters
    setZoomLevel,
    setSelectedLayers,
    setDateRange,
    setSearchQuery,
    setMinConfidence,
    setShowUserCorrectedOnly,

    // Computed
    filters,
    hasActiveFilters,
    resetFilters,
  };
}
