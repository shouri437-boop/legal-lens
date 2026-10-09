/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps global typings use any */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  Globe,
  MapIcon,
  X,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Calendar,
  Link2,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import type {
  Landmark,
  GeospatialPath,
  MapView,
} from "@/types/geospatial.types";
import {
  fetchLocationDetail,
  type LocationDetailResponse,
} from "@/lib/api/geospatial";
import { useSourceNavigation } from "@/hooks/useSourceNavigation";
import { useEntityResolver } from "@/hooks/useEntityResolver";
import { EntityBadge } from "@/components/ui/entity-badge";
import { SourceViewerModal } from "@/components/source-viewer/SourceViewerModal";
import { listFiles } from "@/lib/api/files";

interface GeospatialMapProps {
  caseId: string;
  landmarks: Landmark[];
  paths: GeospatialPath[];
}

// Landmark type colors
const LANDMARK_COLORS: Record<string, string> = {
  crime_scene: "#FF6B6B",
  witness_location: "#4A90E2",
  evidence_location: "#F5A623",
  suspect_location: "#7B68EE",
  other: "#8A8A82",
};

// Map type IDs for Google Maps
type GoogleMapTypeId = "roadmap" | "satellite" | "hybrid" | "terrain";

export function GeospatialMap({
  caseId,
  landmarks,
  paths,
}: GeospatialMapProps) {
  const [mapView, setMapView] = useState<MapView>("2d");
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(
    null,
  );
  const [hoveredLandmark, setHoveredLandmark] = useState<string | null>(null);
  const [showStreetView, setShowStreetView] = useState(false);
  const [streetViewLandmark, setStreetViewLandmark] = useState<Landmark | null>(
    null,
  );
  const [selectedLocationDetail, setSelectedLocationDetail] =
    useState<LocationDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(true);

  // Source navigation for opening citations in the source viewer
  const {
    openSource,
    sourceContent: geoSourceContent,
    closeSource: geoCloseSource,
    isLoading: sourceLoading,
  } = useSourceNavigation(caseId);

  // Entity resolution for displaying entity names instead of UUIDs
  const { resolveEntities, isLoading: entitiesLoading } =
    useEntityResolver(caseId);

  // File list for resolving citation file_id to original_filename
  const { data: filesData } = useQuery({
    queryKey: ["case-files", caseId],
    queryFn: () => listFiles(caseId, 1, 100),
    staleTime: 5 * 60 * 1000,
    enabled: !!caseId,
  });

  const fileNameById = useMemo(() => {
    const lookup: Record<string, string> = {};
    if (filesData?.files) {
      for (const file of filesData.files) {
        lookup[file.id] = file.original_filename;
      }
    }
    return lookup;
  }, [filesData]);

  // Get API key from environment
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Calculate center point from landmarks
  const center = useMemo(() => {
    if (landmarks.length === 0) {
      return { lat: 37.7749, lng: -122.4194 }; // Default to San Francisco
    }
    const centerLat =
      landmarks.reduce((sum, l) => sum + l.location.lat, 0) / landmarks.length;
    const centerLng =
      landmarks.reduce((sum, l) => sum + l.location.lng, 0) / landmarks.length;
    return { lat: centerLat, lng: centerLng };
  }, [landmarks]);

  // Map type based on view
  const mapTypeId: GoogleMapTypeId = mapView === "3d" ? "satellite" : "roadmap";

  // Handle landmark click
  const handleLandmarkClick = useCallback(
    async (landmark: Landmark) => {
      setSelectedLandmark(landmark);
      setSelectedLocationDetail(null);

      // Fetch full location detail from backend
      try {
        setLoadingDetail(true);
        const detail = await fetchLocationDetail(caseId, landmark.id);
        setSelectedLocationDetail(detail);
      } catch (error) {
        console.error("Failed to fetch location detail:", error);
      } finally {
        setLoadingDetail(false);
      }
    },
    [caseId],
  );

  // Close dialog
  const handleBackdropClick = useCallback(() => {
    setSelectedLandmark(null);
  }, []);

  // Open Street View
  const handleOpenStreetView = useCallback((landmark: Landmark) => {
    setStreetViewLandmark(landmark);
    setShowStreetView(true);
  }, []);

  // If no API key, show error
  if (!apiKey) {
    return (
      <div
        className="w-full h-full flex items-center justify-center rounded-xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="text-center p-8">
          <Globe
            size={64}
            className="mx-auto mb-4"
            style={{ color: "var(--muted-foreground)" }}
          />
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Google Maps API Key Required
          </h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your frontend/.env
            file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        // Hardware acceleration for smoother performance
        transform: "translateZ(0)",
        willChange: mapView === "3d" ? "transform" : "auto",
      }}
    >
      <APIProvider apiKey={apiKey}>
        {/* Main Map */}
        {!showStreetView && (
          <Map
            defaultCenter={center}
            defaultZoom={13}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            disableDefaultUI={false}
            // Google's built-in demo Map ID: enables AdvancedMarker without a
            // Cloud-console Map ID. An unregistered custom ID renders a blank map.
            mapId="DEMO_MAP_ID"
            style={{ width: "100%", height: "100%" }}
            tilt={mapView === "3d" ? 30 : 0}
            heading={mapView === "3d" ? 0 : 0}
            options={{
              // Hide default map type control (we have a custom toggle)
              mapTypeControl: false,
              // Performance optimizations
              renderingType: mapView === "3d" ? "RASTER" : "VECTOR",
              isFractionalZoomEnabled: false,
              // Reduce quality slightly for better performance in 3D
              ...(mapView === "3d" && {
                maxZoom: 20,
                minZoom: 10,
              }),
            }}
          >
            {/* Render landmarks as markers */}
            {landmarks.map((landmark) => {
              const color =
                LANDMARK_COLORS[landmark.type] || LANDMARK_COLORS.other;
              const isHovered = hoveredLandmark === landmark.id;
              const isSelected = selectedLandmark?.id === landmark.id;

              return (
                <AdvancedMarker
                  key={landmark.id}
                  position={landmark.location}
                  onClick={() => handleLandmarkClick(landmark)}
                  onMouseEnter={() => setHoveredLandmark(landmark.id)}
                  onMouseLeave={() => setHoveredLandmark(null)}
                  zIndex={isSelected ? 30 : isHovered ? 20 : 10}
                >
                  <div
                    className="relative flex items-center justify-center rounded-full cursor-pointer"
                    style={{
                      width: isSelected ? "52px" : isHovered ? "48px" : "44px",
                      height: isSelected ? "52px" : isHovered ? "48px" : "44px",
                      backgroundColor: color,
                      boxShadow:
                        isSelected || isHovered
                          ? `0 0 24px ${color}90, 0 4px 16px rgba(0, 0, 0, 0.3)`
                          : `0 4px 12px rgba(0, 0, 0, 0.2)`,
                      border: `3px solid ${isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.9)"}`,
                      transition: "all 0.2s ease-out",
                      // Hardware acceleration
                      transform: "translateZ(0)",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <MapPin
                      size={isSelected ? 26 : isHovered ? 24 : 22}
                      color="white"
                      strokeWidth={2.5}
                    />
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Render paths as polylines */}
            <PathsOverlay paths={paths} landmarks={landmarks} />

            {/* Auto-fit map bounds to show all landmarks */}
            <FitBoundsToLandmarks landmarks={landmarks} />
          </Map>
        )}

        {/* Street View */}
        {showStreetView && streetViewLandmark && (
          <StreetViewComponent
            landmark={streetViewLandmark}
            onClose={() => {
              setShowStreetView(false);
              setStreetViewLandmark(null);
            }}
          />
        )}

        {/* View Toggle Controls */}
        <div
          className="absolute top-4 right-4 flex gap-2 p-2 rounded-lg shadow-lg z-10"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            onClick={() => setMapView("2d")}
            className={clsx(
              "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
              mapView === "2d"
                ? "text-(--foreground)"
                : "text-(--muted-foreground)",
            )}
            style={{
              backgroundColor:
                mapView === "2d" ? "var(--muted)" : "transparent",
            }}
          >
            <MapIcon size={16} />
            2D
          </button>
          <button
            onClick={() => setMapView("3d")}
            className={clsx(
              "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
              mapView === "3d"
                ? "text-(--foreground)"
                : "text-(--muted-foreground)",
            )}
            style={{
              backgroundColor:
                mapView === "3d" ? "var(--muted)" : "transparent",
            }}
          >
            <Globe size={16} />
            Satellite
          </button>
        </div>

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 rounded-lg shadow-lg z-10 overflow-hidden"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            onClick={() => setLegendExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
            style={{ color: "var(--foreground)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="text-sm font-semibold">Landmark Types</span>
            <ChevronDown
              size={16}
              className="transition-transform duration-200"
              style={{
                color: "var(--muted-foreground)",
                transform: legendExpanded ? "rotate(0deg)" : "rotate(180deg)",
              }}
            />
          </button>
          {legendExpanded && (
            <div className="px-4 pb-3 space-y-2">
              {Object.entries(LANDMARK_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-xs capitalize"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {type.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Landmark Detail Dialog — portaled to body to escape transform containing block */}
        {selectedLandmark &&
          createPortal(
            <div
              className="fixed inset-0 flex items-center justify-center p-4 z-50"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
              }}
              onClick={handleBackdropClick}
            >
              <div
                className="relative max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-xl shadow-2xl"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div
                  className="sticky top-0 px-6 py-4 flex items-start justify-between"
                  style={{
                    backgroundColor: "var(--card)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor:
                            LANDMARK_COLORS[selectedLandmark.type],
                        }}
                      >
                        <MapPin size={18} color="white" />
                      </div>
                      <h2
                        className="text-xl font-bold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {selectedLandmark.name}
                      </h2>
                    </div>
                    <p
                      className="text-sm capitalize mb-3"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {selectedLandmark.type.replace("_", " ")}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenStreetView(selectedLandmark)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        style={{
                          backgroundColor: "var(--muted)",
                          color: "var(--foreground)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--muted)";
                        }}
                      >
                        <Navigation size={14} />
                        Street View
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLandmark(null)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  {/* Section 1: Events at this Location */}
                  <div className="mb-6">
                    <h4 className="mb-3 flex items-center text-sm font-semibold text-neutral-200">
                      <Calendar className="mr-2 h-4 w-4" />
                      Events at this Location (
                      {selectedLocationDetail?.events.length || 0})
                    </h4>
                    {loadingDetail ? (
                      <p className="text-xs text-neutral-400">
                        Loading events...
                      </p>
                    ) : selectedLocationDetail &&
                      selectedLocationDetail.events.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLocationDetail.events.map((event, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
                          >
                            <p className="text-sm font-medium text-neutral-200">
                              {event.title}
                            </p>
                            <p className="mt-1 text-xs text-neutral-400">
                              {event.description}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                              <span>
                                {new Date(event.timestamp).toLocaleString()}
                              </span>
                              <span className="capitalize">
                                Layer: {event.layer}
                              </span>
                              <span>
                                Confidence:{" "}
                                {(event.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        No events at this location
                      </p>
                    )}
                  </div>

                  {/* Section 2: Citations */}
                  <div className="mb-6">
                    <h4 className="mb-3 flex items-center text-sm font-semibold text-neutral-200">
                      <FileText className="mr-2 h-4 w-4" />
                      Citations ({selectedLocationDetail?.citations.length || 0}
                      )
                    </h4>
                    {loadingDetail ? (
                      <p className="text-xs text-neutral-400">
                        Loading citations...
                      </p>
                    ) : selectedLocationDetail &&
                      selectedLocationDetail.citations.length > 0 ? (
                      <div className="space-y-3">
                        {selectedLocationDetail.citations.map(
                          (citation, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-neutral-300">
                                    {fileNameById[citation.file_id] ??
                                      "Source Document"}
                                  </p>
                                  <p className="mt-1 text-xs text-neutral-500">
                                    {citation.locator}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    openSource({
                                      file_id: citation.file_id,
                                      locator: citation.locator,
                                      excerpt: citation.excerpt,
                                    })
                                  }
                                  disabled={sourceLoading}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  {sourceLoading ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2
                                        size={10}
                                        className="animate-spin"
                                      />
                                      Opening...
                                    </span>
                                  ) : (
                                    "View"
                                  )}
                                </button>
                              </div>
                              <div className="mt-2 rounded bg-neutral-950/50 p-2">
                                <p className="text-xs italic text-neutral-400">
                                  &ldquo;{citation.excerpt}&rdquo;
                                </p>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        No citations available
                      </p>
                    )}
                  </div>

                  {/* Section 3: Temporal Analysis */}
                  <div className="mb-6">
                    <h4 className="mb-3 flex items-center text-sm font-semibold text-neutral-200">
                      <Clock className="mr-2 h-4 w-4" />
                      Temporal Analysis
                    </h4>
                    {loadingDetail ? (
                      <p className="text-xs text-neutral-400">
                        Loading temporal data...
                      </p>
                    ) : selectedLocationDetail?.temporal_period ? (
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                        <p className="text-xs text-neutral-400">
                          Location was relevant during:
                        </p>
                        <p className="mt-1 text-sm font-medium text-neutral-200">
                          {selectedLocationDetail.temporal_period.start
                            ? new Date(
                                selectedLocationDetail.temporal_period.start,
                              ).toLocaleDateString()
                            : "Unknown start"}
                          {" → "}
                          {selectedLocationDetail.temporal_period.end
                            ? new Date(
                                selectedLocationDetail.temporal_period.end,
                              ).toLocaleDateString()
                            : "Unknown end"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        No temporal data available
                      </p>
                    )}
                  </div>

                  {/* Section 4: Related Entities */}
                  <div>
                    <h4 className="mb-3 flex items-center text-sm font-semibold text-neutral-200">
                      <Link2 className="mr-2 h-4 w-4" />
                      Related Entities (
                      {selectedLocationDetail?.source_entity_ids.length || 0})
                    </h4>
                    {loadingDetail ? (
                      <p className="text-xs text-neutral-400">
                        Loading entities...
                      </p>
                    ) : selectedLocationDetail &&
                      selectedLocationDetail.source_entity_ids.length > 0 ? (
                      <div className="space-y-2">
                        {entitiesLoading ? (
                          <p className="text-xs text-neutral-400">
                            Resolving entities...
                          </p>
                        ) : (
                          resolveEntities(
                            selectedLocationDetail.source_entity_ids,
                          ).map((entity) => (
                            <EntityBadge
                              key={entity.id}
                              name={entity.name}
                              entityType={entity.entity_type}
                              color={entity.color}
                            />
                          ))
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        No related entities
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Source viewer modal — portaled to body above detail dialog */}
        {geoSourceContent &&
          createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
              onClick={geoCloseSource}
            >
              <div
                className="w-full max-w-5xl h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <SourceViewerModal
                  content={geoSourceContent}
                  onClose={geoCloseSource}
                  className="w-full h-full"
                />
              </div>
            </div>,
            document.body,
          )}
      </APIProvider>
    </div>
  );
}

// Auto-fits map viewport to contain all landmarks with padding
const BOUNDS_PADDING = 60;

function FitBoundsToLandmarks({ landmarks }: { landmarks: Landmark[] }) {
  const map = useMap();

  useEffect(() => {
    if (
      !map ||
      landmarks.length === 0 ||
      typeof window === "undefined" ||
      !(window as any).google?.maps
    )
      return;

    const googleMaps = (window as any).google.maps;
    const bounds = new googleMaps.LatLngBounds();

    for (const landmark of landmarks) {
      bounds.extend(landmark.location);
    }

    // For a single landmark, set center + reasonable zoom instead of fitBounds
    // (fitBounds on a single point zooms to max)
    if (landmarks.length === 1) {
      map.setCenter(landmarks[0].location);
      map.setZoom(15);
      return;
    }

    map.fitBounds(bounds, BOUNDS_PADDING);
  }, [map, landmarks]);

  return null;
}

// Component to render paths as polylines
function PathsOverlay({
  paths,
  landmarks,
}: {
  paths: GeospatialPath[];
  landmarks: Landmark[];
}) {
  const map = useMap();

  useMemo(() => {
    if (!map || typeof window === "undefined" || !(window as any).google?.maps)
      return;

    const googleMaps = (window as any).google.maps;

    // Clear existing polylines
    const polylines: any[] = [];

    paths.forEach((path) => {
      const fromLandmark = landmarks.find((l) => l.id === path.from);
      const toLandmark = landmarks.find((l) => l.id === path.to);

      if (!fromLandmark || !toLandmark) return;

      const polyline = new googleMaps.Polyline({
        path: [fromLandmark.location, toLandmark.location],
        geodesic: true,
        strokeColor: path.color || "#8A8A82",
        strokeOpacity: 0.7,
        strokeWeight: 3,
        icons: [
          {
            icon: {
              path: googleMaps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              strokeColor: path.color || "#8A8A82",
            },
            offset: "100%",
          },
        ],
        map: map,
        // Performance optimization
        clickable: false,
        draggable: false,
      });

      polylines.push(polyline);
    });

    return () => {
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, paths, landmarks]);

  return null;
}

// Street View Component
function StreetViewComponent({
  landmark,
  onClose,
}: {
  landmark: Landmark;
  onClose: () => void;
}) {
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full">
      <div
        id="street-view"
        className="w-full h-full"
        ref={(node) => {
          if (
            node &&
            typeof window !== "undefined" &&
            (window as any).google?.maps?.StreetViewPanorama
          ) {
            try {
              const googleMaps = (window as any).google.maps;
              new googleMaps.StreetViewPanorama(node, {
                position: landmark.location,
                pov: { heading: 0, pitch: 0 },
                zoom: 1,
              });
            } catch (err) {
              console.error("Street View error:", err);
              setError(true);
            }
          }
        }}
      />

      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div className="text-center p-8">
            <p style={{ color: "var(--muted-foreground)" }}>
              Street View not available for this location
            </p>
          </div>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-lg shadow-lg transition-colors z-10"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--muted)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--card)";
        }}
      >
        <X size={20} />
      </button>

      {/* Info */}
      {!error && (
        <div
          className="absolute bottom-4 left-4 px-4 py-3 rounded-lg shadow-lg"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <Navigation size={16} style={{ color: "var(--foreground)" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {landmark.name}
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            Street View • Use mouse to look around
          </p>
        </div>
      )}
    </div>
  );
}
