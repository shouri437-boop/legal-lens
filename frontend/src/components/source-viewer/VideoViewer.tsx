// ABOUTME: HTML5 video player with custom timestamp marker support on the seekbar.
// ABOUTME: Supports seek-to-timestamp and marker click navigation.

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import type { VideoMarker } from "./SourceViewerModal";

// ---------------------------------------------------------------------------
// VideoViewer
// ---------------------------------------------------------------------------

interface VideoViewerProps {
  /** Signed URL to the video file. */
  videoUrl: string;
  /** Timestamp in seconds to seek to when set. */
  initialTimestamp?: number;
  /** Timestamp markers to display on the seekbar. */
  markers?: VideoMarker[];
}

/** Format seconds into mm:ss display string. */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VideoViewer({
  videoUrl,
  initialTimestamp,
  markers = [],
}: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Seek to initialTimestamp when it changes
  useEffect(() => {
    if (videoRef.current && initialTimestamp !== undefined) {
      videoRef.current.currentTime = initialTimestamp;
    }
  }, [initialTimestamp]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => setIsPlaying(false), []);

  const handleSeekbarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!videoRef.current || duration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      videoRef.current.currentTime = ratio * duration;
    },
    [duration],
  );

  const handleMarkerClick = useCallback((time: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Video element */}
      <div className="flex-1 bg-charcoal/80 flex items-center justify-center min-h-0">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full rounded"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          playsInline
        />
      </div>

      {/* Controls bar */}
      <div className="flex-none p-4 border-t border-stone/15">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayPause}
            className="p-2 rounded-lg bg-charcoal/50 hover:bg-charcoal transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={16} className="text-smoke" />
            ) : (
              <Play size={16} className="text-smoke" />
            )}
          </button>

          {/* Seekbar with markers */}
          <div
            className="flex-1 relative h-4 group cursor-pointer flex items-center"
            onClick={handleSeekbarClick}
          >
            {/* Track background */}
            <div className="w-full h-1.5 bg-charcoal/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-smoke/60 rounded-full transition-[width] duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Marker dots */}
            {markers.map((marker, idx) => {
              const markerPercent =
                duration > 0 ? (marker.time / duration) * 100 : 0;
              return (
                <button
                  key={`${marker.time}-${idx}`}
                  onClick={(e) => handleMarkerClick(marker.time, e)}
                  className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500 -translate-x-1/2 hover:scale-150 transition-transform"
                  style={{ left: `${markerPercent}%` }}
                  title={`${formatTime(marker.time)} - ${marker.label}`}
                  aria-label={`Jump to ${formatTime(marker.time)}: ${marker.label}`}
                />
              );
            })}
          </div>

          {/* Time display */}
          <span className="text-xs text-stone font-mono tabular-nums shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Marker list (if any) */}
        {markers.length > 0 && (
          <div className="mt-3 space-y-1">
            {markers.map((marker, idx) => (
              <button
                key={`list-${marker.time}-${idx}`}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = marker.time;
                  }
                }}
                className="flex items-center gap-2 w-full text-left p-1.5 rounded hover:bg-charcoal/40 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs text-stone font-mono tabular-nums shrink-0">
                  {formatTime(marker.time)}
                </span>
                <span className="text-xs text-smoke truncate">
                  {marker.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
