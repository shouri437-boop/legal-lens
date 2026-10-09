import { TimelineLayer, TimelineZoomLevel } from "@/types/timeline.types";

// Layer styling configuration — colors aligned with Command Center agent accents
export const LAYER_CONFIG: Record<
  TimelineLayer,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    hexColor: string;
    icon: string;
    label: string;
  }
> = {
  evidence: {
    color: "text-[#d65c70] dark:text-[#d65c70]",
    bgColor: "bg-[#d65c70]/10 dark:bg-[#d65c70]/10",
    borderColor: "border-[#d65c70]/50 dark:border-[#d65c70]/40",
    hexColor: "#d65c70", // Evidence agent accent — hsl(350, 60%, 60%)
    icon: "FileText",
    label: "Evidence",
  },
  legal: {
    color: "text-[#6c9ada] dark:text-[#6c9ada]",
    bgColor: "bg-[#6c9ada]/10 dark:bg-[#6c9ada]/10",
    borderColor: "border-[#6c9ada]/50 dark:border-[#6c9ada]/40",
    hexColor: "#6c9ada", // Legal agent accent — hsl(215, 60%, 64%)
    icon: "Scale",
    label: "Legal",
  },
  strategy: {
    color: "text-[#e2935a] dark:text-[#e2935a]",
    bgColor: "bg-[#e2935a]/10 dark:bg-[#e2935a]/10",
    borderColor: "border-[#e2935a]/50 dark:border-[#e2935a]/40",
    hexColor: "#e2935a", // Strategy agent accent — hsl(25, 70%, 62%)
    icon: "Target",
    label: "Strategy",
  },
  financial: {
    color: "text-[#47d198] dark:text-[#47d198]",
    bgColor: "bg-[#47d198]/10 dark:bg-[#47d198]/10",
    borderColor: "border-[#47d198]/50 dark:border-[#47d198]/40",
    hexColor: "#47d198", // Financial agent accent — hsl(155, 60%, 55%)
    icon: "DollarSign",
    label: "Financial",
  },
};

// Zoom level configuration
export const ZOOM_CONFIG: Record<
  TimelineZoomLevel,
  {
    dateFormat: string;
    groupingKey: (date: Date) => string;
    label: string;
  }
> = {
  day: {
    dateFormat: "MMM d, yyyy",
    groupingKey: (date) => date.toISOString().split("T")[0],
    label: "Daily",
  },
  week: {
    dateFormat: "MMM d, yyyy",
    groupingKey: (date) => {
      const weekStart = new Date(date);
      weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
      return weekStart.toISOString().split("T")[0];
    },
    label: "Weekly",
  },
  month: {
    dateFormat: "MMMM yyyy",
    groupingKey: (date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    label: "Monthly",
  },
  year: {
    dateFormat: "yyyy",
    groupingKey: (date) => String(date.getUTCFullYear()),
    label: "Yearly",
  },
};

// Performance thresholds
export const PERFORMANCE_CONFIG = {
  VIRTUALIZATION_THRESHOLD: 50, // Enable virtualization above this many events
  DEBOUNCE_DELAY: 300, // ms for filter changes
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 10, // Max cached timeline responses
  SSE_RECONNECT_DELAY: 1000, // ms before SSE reconnection
  MAX_SSE_RECONNECT_ATTEMPTS: 5,
};

// API configuration
export const API_CONFIG = {
  TIMELINE_BASE_PATH:
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/api/cases",
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  REQUEST_TIMEOUT: 30000, // 30 seconds
};
