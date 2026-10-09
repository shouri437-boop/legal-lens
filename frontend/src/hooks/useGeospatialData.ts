// ABOUTME: React hook for geospatial data management with status tracking, generation triggering, and polling.
// ABOUTME: Transforms API LocationResponse to frontend Landmark type; provides generate/refresh/refetch functions.

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchGeospatialStatus,
  fetchLocations,
  generateGeospatialIntelligence,
  deleteGeospatialData,
  type GeospatialStatus,
} from "@/lib/api/geospatial";
import type { Landmark } from "@/types/geospatial.types";

export function useGeospatialData(caseId: string) {
  const [status, setStatus] = useState<GeospatialStatus | null>(null);
  const [locations, setLocations] = useState<Landmark[]>([]);
  const [unmappableLocations, setUnmappableLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch status and locations
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check status first
      const statusData = await fetchGeospatialStatus(caseId);
      setStatus(statusData);

      // If complete, fetch locations
      if (statusData.exists && statusData.status === "complete") {
        const locationsData = await fetchLocations(caseId);

        // Split into mappable (have coordinates) and unmappable
        const mappable: Landmark[] = [];
        const unmappable: string[] = [];

        for (const loc of locationsData) {
          if (loc.coordinates) {
            mappable.push({
              id: loc.id,
              name: loc.name,
              location: { lat: loc.coordinates.lat, lng: loc.coordinates.lng },
              type: loc.location_type as Landmark["type"],
              events: [],
            });
          } else {
            unmappable.push(loc.name);
          }
        }

        setLocations(mappable);
        setUnmappableLocations(unmappable);
      } else {
        setLocations([]);
        setUnmappableLocations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error("Geospatial data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // Generate intelligence
  const generate = useCallback(
    async (force = false) => {
      try {
        setGenerating(true);
        setError(null);
        await generateGeospatialIntelligence(caseId, force);
        setStatus({ exists: true, status: "generating", location_count: 0 });

        // Poll for completion. Backend returns "generating" while in-flight,
        // "complete" when done, or "not_started" if the task failed.
        let attempts = 0;
        const maxAttempts = 300; // 3s * 300 = 15min timeout (long documents)
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusData = await fetchGeospatialStatus(caseId);
            setStatus(statusData);

            if (statusData.status === "complete") {
              clearInterval(pollInterval);
              setGenerating(false);
              await fetchData();
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setGenerating(false);
              setError(statusData.error || "Geospatial analysis failed.");
            } else if (statusData.status === "not_started") {
              // Backend task finished without writing locations (error path)
              clearInterval(pollInterval);
              setGenerating(false);
              setError(
                "Geospatial analysis failed. Check backend logs for details.",
              );
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setGenerating(false);
              setError("Geospatial analysis timed out after 15 minutes.");
            }
            // "generating" → keep polling
          } catch {
            clearInterval(pollInterval);
            setGenerating(false);
            setError("Lost connection while checking analysis status.");
          }
        }, 3000);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate intelligence",
        );
        setGenerating(false);
        console.error("Geospatial generation error:", err);
      }
    },
    [caseId, fetchData],
  );

  // Refresh (delete + regenerate)
  const refresh = useCallback(async () => {
    try {
      setError(null);
      await deleteGeospatialData(caseId);
      await generate(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
      console.error("Geospatial refresh error:", err);
    }
  }, [caseId, generate]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    status,
    locations,
    unmappableLocations,
    loading,
    generating,
    error,
    generate,
    refresh,
    refetch: fetchData,
  };
}
