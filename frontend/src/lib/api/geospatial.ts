// ABOUTME: API client for geospatial endpoints (status, generate, locations).
// ABOUTME: Uses shared api client for JWT auth; provides status tracking and location data fetching.

import { api } from "@/lib/api-client";

export interface GeospatialStatus {
  exists: boolean;
  status: "not_started" | "generating" | "complete" | "failed";
  location_count: number;
  last_generated?: string;
  /** Why the last generation failed (status "failed"). */
  error?: string;
}

export interface LocationResponse {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number } | null;
  location_type: string;
  event_count: number;
  citation_count: number;
}

export interface LocationDetailResponse {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number } | null;
  location_type: string;
  events: Array<{
    title: string;
    description: string;
    timestamp: string;
    layer: string;
    confidence: number;
  }>;
  citations: Array<{
    file_id: string;
    locator: string;
    excerpt: string;
  }>;
  temporal_period: {
    start: string | null;
    end: string | null;
  } | null;
  source_entity_ids: string[];
}

/**
 * Fetch geospatial analysis status for a case.
 * Returns existence, status, and count information.
 */
export async function fetchGeospatialStatus(
  caseId: string,
): Promise<GeospatialStatus> {
  return api.get<GeospatialStatus>(`/api/cases/${caseId}/geospatial/status`);
}

/**
 * Trigger geospatial intelligence generation for a case.
 * @param force - Force regeneration even if data already exists
 * @returns 202 Accepted with status and case_id
 */
export async function generateGeospatialIntelligence(
  caseId: string,
  force = false,
): Promise<{ status: string; case_id: string }> {
  return api.post(
    `/api/cases/${caseId}/geospatial/generate?force=${force}`,
    {},
  );
}

/**
 * Fetch all locations for a case with optional type filter.
 * @param locationTypeFilter - Filter by location type (e.g., "crime_scene")
 */
export async function fetchLocations(
  caseId: string,
  locationTypeFilter?: string,
): Promise<LocationResponse[]> {
  const params = locationTypeFilter
    ? `?location_type=${locationTypeFilter}`
    : "";
  const response = await api.get<{ locations: LocationResponse[] }>(
    `/api/cases/${caseId}/locations${params}`,
  );
  return response.locations;
}

/**
 * Fetch detailed information for a single location.
 * Includes events, citations, temporal associations, and source entity IDs.
 */
export async function fetchLocationDetail(
  caseId: string,
  locationId: string,
): Promise<LocationDetailResponse> {
  return api.get<LocationDetailResponse>(
    `/api/cases/${caseId}/locations/${locationId}`,
  );
}

/**
 * Delete all geospatial data for a case.
 * Returns deletion confirmation and count of deleted locations.
 */
export async function deleteGeospatialData(
  caseId: string,
): Promise<{ deleted: boolean; location_count: number }> {
  return api.delete(`/api/cases/${caseId}/geospatial`);
}
