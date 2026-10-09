// ABOUTME: Audio waveform player using wavesurfer.js with transcript card display.
// ABOUTME: Supports play/pause, seek-to-timestamp, and active transcript highlighting.

"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import type { TranscriptEntry } from "./SourceViewerModal";

// ---------------------------------------------------------------------------
// AudioViewer
// ---------------------------------------------------------------------------

interface AudioViewerProps {
  /** Signed URL to the audio file. */
  audioUrl: string;
  /** Timestamp in seconds to seek to when set. */
  initialTimestamp?: number;
  /** Transcript entries with speaker and time data. */
  transcriptEntries?: TranscriptEntry[];
}

/** Format seconds into mm:ss display string. */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function AudioViewer({
  audioUrl,
  initialTimestamp,
  transcriptEntries = [],
}: AudioViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<import("wavesurfer.js").default | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sorted transcript entries for chronological display
  const sortedTranscript = useMemo(
    () => [...transcriptEntries].sort((a, b) => a.time - b.time),
    [transcriptEntries],
  );

  // Determine which transcript entry is currently active based on playback time
  const activeTranscriptIndex = useMemo(() => {
    if (sortedTranscript.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < sortedTranscript.length; i++) {
      if (currentTime >= sortedTranscript[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [currentTime, sortedTranscript]);

  // Initialize wavesurfer dynamically (it's ESM-only)
  useEffect(() => {
    if (!containerRef.current) return;

    let ws: import("wavesurfer.js").default | null = null;
    let cancelled = false;

    const initWavesurfer = async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      if (cancelled || !containerRef.current) return;

      ws = WaveSurfer.create({
        container: containerRef.current,
        url: audioUrl,
        waveColor: "#8A8A82",
        progressColor: "#F5F4EF",
        cursorColor: "#F5F4EF",
        cursorWidth: 1,
        height: 64,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      });

      ws.on("ready", () => {
        if (cancelled) return;
        setIsReady(true);
        setDuration(ws?.getDuration() ?? 0);
      });

      ws.on("timeupdate", (time: number) => {
        if (cancelled) return;
        setCurrentTime(time);
      });

      ws.on("play", () => {
        if (!cancelled) setIsPlaying(true);
      });
      ws.on("pause", () => {
        if (!cancelled) setIsPlaying(false);
      });
      ws.on("finish", () => {
        if (!cancelled) setIsPlaying(false);
      });

      wavesurferRef.current = ws;
    };

    initWavesurfer();

    return () => {
      cancelled = true;
      ws?.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  // Seek to initialTimestamp when it changes
  useEffect(() => {
    if (
      !wavesurferRef.current ||
      !isReady ||
      initialTimestamp === undefined ||
      duration === 0
    )
      return;
    const ratio = Math.min(initialTimestamp / duration, 1);
    wavesurferRef.current.seekTo(ratio);
  }, [initialTimestamp, isReady, duration]);

  // Auto-scroll to active transcript card
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeTranscriptIndex]);

  const handlePlayPause = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const handleTranscriptClick = useCallback(
    (timestamp: number) => {
      if (!wavesurferRef.current || duration === 0) return;
      const ratio = Math.min(timestamp / duration, 1);
      wavesurferRef.current.seekTo(ratio);
    },
    [duration],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Waveform area */}
      <div className="flex-none p-4 border-b border-stone/15">
        <div
          ref={containerRef}
          className="w-full rounded-lg overflow-hidden bg-charcoal/30"
        />

        {/* Controls row */}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handlePlayPause}
            disabled={!isReady}
            className="p-2 rounded-lg bg-charcoal/50 hover:bg-charcoal transition-colors disabled:opacity-40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={16} className="text-smoke" />
            ) : (
              <Play size={16} className="text-smoke" />
            )}
          </button>
          <span className="text-xs text-stone font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Transcript cards */}
      {sortedTranscript.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs text-stone uppercase tracking-wider mb-2">
            Transcript
          </div>
          {sortedTranscript.map((entry, idx) => {
            const isActive = idx === activeTranscriptIndex;
            return (
              <div
                key={`${entry.time}-${idx}`}
                ref={isActive ? activeCardRef : undefined}
                onClick={() => handleTranscriptClick(entry.time)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  isActive
                    ? "bg-smoke/5 border-smoke/20"
                    : "bg-charcoal/30 border-stone/10 hover:bg-charcoal/50"
                }`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs text-stone font-mono tabular-nums shrink-0">
                    {formatTime(entry.time)}
                  </span>
                  <span
                    className={`text-xs font-medium ${isActive ? "text-smoke" : "text-stone"}`}
                  >
                    {entry.speaker}
                  </span>
                </div>
                <div
                  className={`text-xs leading-relaxed ${isActive ? "text-smoke" : "text-stone/80"}`}
                >
                  {entry.text}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty transcript state */}
      {sortedTranscript.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xs text-stone">No transcript data available</div>
        </div>
      )}
    </div>
  );
}
