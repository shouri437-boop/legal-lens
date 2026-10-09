"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { GeospatialMap } from "@/components/Geospatial/GeospatialMap";
import { useGeospatialData } from "@/hooks/useGeospatialData";
import { AlertTriangle, Globe, Loader2, MapPin, RefreshCw } from "lucide-react";

export default function GeospatialPage() {
  const params = useParams();
  const caseId = params.id as string;
  const {
    status,
    locations,
    unmappableLocations,
    loading,
    generating,
    error,
    generate,
    refresh,
  } = useGeospatialData(caseId);

  const [showConfirmRefresh, setShowConfirmRefresh] = useState(false);

  const handleRefresh = () => {
    if (showConfirmRefresh) {
      refresh();
      setShowConfirmRefresh(false);
    } else {
      setShowConfirmRefresh(true);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Status Banner */}
      <div
        className="border-b p-4"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--color-jet)",
        }}
      >
        {/* Error alert */}
        {error && (
          <div
            className="mb-4 flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Not generated state */}
        {!status?.exists && !generating && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--color-glass-light)" }}
              >
                <Globe className="h-4.5 w-4.5 text-stone" />
              </div>
              <div>
                <p className="text-sm font-medium text-smoke">
                  Geospatial intelligence not yet generated
                </p>
                <p className="text-xs text-stone">
                  Extract and visualize location-based evidence from case data
                </p>
              </div>
            </div>
            <button
              onClick={() => generate()}
              disabled={loading || generating}
              className="liquid-glass-button flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-smoke disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              <span>Generate Geospatial Intelligence</span>
            </button>
          </div>
        )}

        {/* Generating state */}
        {(status?.status === "generating" || generating) && (
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--color-glass-light)" }}
            >
              <Loader2 className="h-4.5 w-4.5 animate-spin text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-smoke">
                Analyzing locations and movement patterns...
              </p>
              <p className="text-xs text-stone">
                This may take 1-2 minutes. You can leave this page.
              </p>
            </div>
          </div>
        )}

        {/* Complete state */}
        {status?.status === "complete" && !generating && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
              >
                <MapPin className="h-4.5 w-4.5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-smoke">
                  Geospatial analysis complete
                </p>
                <p className="text-xs text-stone">
                  {locations.length} of {status.location_count} locations mapped
                  {unmappableLocations.length > 0 &&
                    ` · ${unmappableLocations.length} unmappable`}
                  {status.last_generated &&
                    ` · Last updated: ${new Date(
                      status.last_generated,
                    ).toLocaleString()}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: "var(--border)",
                color: "var(--color-stone)",
              }}
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {showConfirmRefresh ? "Confirm Refresh?" : "Refresh"}
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        {status?.status === "complete" && locations.length > 0 ? (
          <GeospatialMap caseId={caseId} landmarks={locations} paths={[]} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <Globe className="mx-auto h-12 w-12 text-stone/40" />
              <p className="mt-4 text-sm text-stone">
                {status?.status === "generating" || generating
                  ? "Generating geospatial intelligence..."
                  : status?.status === "complete" &&
                      unmappableLocations.length > 0
                    ? "All extracted locations could not be geocoded"
                    : "No geospatial data available"}
              </p>
              {/* Show unmappable locations when analysis complete but nothing on map */}
              {status?.status === "complete" &&
                locations.length === 0 &&
                unmappableLocations.length > 0 && (
                  <div className="mt-4 rounded-lg border border-stone/20 p-4 text-left">
                    <p className="mb-2 text-xs font-medium text-stone">
                      Unmappable locations ({unmappableLocations.length}):
                    </p>
                    <ul className="space-y-1">
                      {unmappableLocations.map((name) => (
                        <li key={name} className="text-xs text-stone/70">
                          {name}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-stone/50">
                      These locations are case-specific and could not be
                      resolved to real-world coordinates.
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
