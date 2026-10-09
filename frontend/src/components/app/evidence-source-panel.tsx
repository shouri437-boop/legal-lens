// ABOUTME: Thin wrapper around the shared source viewer for the app-wide detail sidebar.
// ABOUTME: Accepts SourceViewerContent and renders the appropriate media sub-component.

"use client";

import {
  SourceViewerModal,
  type SourceViewerContent,
  type TranscriptEntry,
  type VideoMarker,
} from "@/components/source-viewer/SourceViewerModal";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EvidenceSourcePanelProps {
  /** Content to display (PDF, audio, video, image). */
  content: SourceViewerContent;
  /** Optional transcript data for audio content. */
  transcriptEntries?: TranscriptEntry[];
  /** Optional timestamp markers for video content. */
  videoMarkers?: VideoMarker[];
  /** Called when the user closes the panel. */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// EvidenceSourcePanel
// ---------------------------------------------------------------------------

/**
 * Evidence source panel for the app-wide detail sidebar.
 * Wraps the shared SourceViewerModal with sidebar-appropriate styling.
 *
 * BACKWARD COMPATIBILITY: This file and export name are preserved because
 * other parts of the app (detail-sidebar.tsx) import EvidenceSourcePanel.
 * The internal implementation now delegates to the shared source viewer.
 */
export function EvidenceSourcePanel({
  content,
  transcriptEntries,
  videoMarkers,
  onClose,
}: EvidenceSourcePanelProps) {
  return (
    <SourceViewerModal
      content={content}
      onClose={onClose ?? (() => {})}
      transcriptEntries={transcriptEntries}
      videoMarkers={videoMarkers}
      className="h-full rounded-none border-0 shadow-none"
    />
  );
}

// Re-export shared types for convenience
export type { SourceViewerContent, TranscriptEntry, VideoMarker };
