import { TimelineApiResponse, TimelineFilters } from "@/types/timeline.types";
import { PERFORMANCE_CONFIG } from "@/constants/timeline.constants";

interface CacheEntry {
  data: TimelineApiResponse;
  timestamp: number;
}

class TimelineCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = PERFORMANCE_CONFIG.MAX_CACHE_SIZE;

  private generateKey(caseId: string, filters: TimelineFilters): string {
    return `${caseId}-${JSON.stringify(filters)}`;
  }

  get(caseId: string, filters: TimelineFilters): CacheEntry | null {
    const key = this.generateKey(caseId, filters);
    return this.cache.get(key) || null;
  }

  set(
    caseId: string,
    filters: TimelineFilters,
    data: TimelineApiResponse,
  ): void {
    const key = this.generateKey(caseId, filters);

    // Implement LRU eviction
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(caseId: string): void {
    // Remove all entries for this case
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.startsWith(caseId)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > PERFORMANCE_CONFIG.CACHE_TTL) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// Singleton instance
const timelineCache = new TimelineCache();

// Cleanup old entries every 5 minutes
if (typeof window !== "undefined") {
  setInterval(
    () => {
      timelineCache.cleanup();
    },
    5 * 60 * 1000,
  );
}

export function getCachedTimelineData(
  caseId: string,
  filters: TimelineFilters,
): CacheEntry | null {
  return timelineCache.get(caseId, filters);
}

export function setCachedTimelineData(
  caseId: string,
  filters: TimelineFilters,
  data: TimelineApiResponse,
): void {
  timelineCache.set(caseId, filters, data);
}

export function invalidateTimelineCache(caseId: string): void {
  timelineCache.invalidate(caseId);
}

export function clearTimelineCache(): void {
  timelineCache.clear();
}
