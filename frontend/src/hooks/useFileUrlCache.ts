// ABOUTME: Hook for caching signed file URLs to avoid regenerating them repeatedly
// ABOUTME: URLs are cached for 1 hour (well before the 24h expiration)
// ABOUTME: Persists cache to localStorage to survive page reloads

import { useCallback } from "react";

interface CachedUrl {
  url: string;
  timestamp: number;
  expiresIn: number; // seconds
}

interface UrlCache {
  [key: string]: CachedUrl; // key format: "caseId:fileId"
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const STORAGE_KEY = "legal_lens_file_url_cache";

// Module-level cache to share state between hook instances and avoid frequent localStorage reads
let memoryCache: UrlCache | null = null;

function getMemoryCache(): UrlCache {
  if (memoryCache) return memoryCache;

  if (typeof window === "undefined") {
    return {};
  }

  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (item) {
      memoryCache = JSON.parse(item);
      // Prune expired items on load
      const now = Date.now();
      let changed = false;
      Object.keys(memoryCache!).forEach((key) => {
        const entry = memoryCache![key];
        if (now - entry.timestamp > CACHE_DURATION) {
          delete memoryCache![key];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
      }
    } else {
      memoryCache = {};
    }
  } catch (e) {
    console.warn("Failed to load cache from localStorage", e);
    memoryCache = {};
  }

  return memoryCache!;
}

function saveToStorage(cache: UrlCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to save cache to localStorage", e);
  }
}

export function useFileUrlCache() {
  const getCacheKey = useCallback((caseId: string, fileId: string) => {
    return `${caseId}:${fileId}`;
  }, []);

  const getCachedUrl = useCallback(
    (caseId: string, fileId: string): string | null => {
      const cache = getMemoryCache();
      const key = getCacheKey(caseId, fileId);
      const cached = cache[key];

      if (!cached) return null;

      const now = Date.now();
      const age = now - cached.timestamp;

      // Check if cache is still valid (within 1 hour)
      if (age < CACHE_DURATION) {
        return cached.url;
      }

      // Cache expired, remove it
      delete cache[key];
      saveToStorage(cache);
      return null;
    },
    [getCacheKey],
  );

  const setCachedUrl = useCallback(
    (
      caseId: string,
      fileId: string,
      url: string,
      expiresIn: number = 86400,
    ) => {
      const cache = getMemoryCache();
      const key = getCacheKey(caseId, fileId);
      cache[key] = {
        url,
        timestamp: Date.now(),
        expiresIn,
      };
      saveToStorage(cache);
    },
    [getCacheKey],
  );

  const clearCache = useCallback(() => {
    memoryCache = {};
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn("Failed to clear cache from localStorage", e);
      }
    }
  }, []);

  const clearCacheForFile = useCallback(
    (caseId: string, fileId: string) => {
      const cache = getMemoryCache();
      const key = getCacheKey(caseId, fileId);
      if (cache[key]) {
        delete cache[key];
        saveToStorage(cache);
      }
    },
    [getCacheKey],
  );

  return {
    getCachedUrl,
    setCachedUrl,
    clearCache,
    clearCacheForFile,
  };
}
