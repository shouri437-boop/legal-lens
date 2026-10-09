// ABOUTME: Modal shell for the source viewer system. Dynamically renders the correct
// ABOUTME: media sub-component (PDF, audio, video, image) based on content type.

"use client";

import { useCallback } from "react";
import { X, FileText, Music, Video, Image as ImageIcon } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { AudioViewer } from "./AudioViewer";
import { VideoViewer } from "./VideoViewer";
import { ImageViewer } from "./ImageViewer";

// ---------------------------------------------------------------------------
// Shared content descriptor used by all source viewer consumers
// ---------------------------------------------------------------------------

/** Describes what content to render in the source viewer modal. */
export interface SourceViewerContent {
  /** Which media viewer to render. */
  type: "pdf" | "audio" | "video" | "image";
  /** Signed URL to the file (from the file download API). */
  url: string;
  /** Display name shown in the modal header. */
  fileName: string;
  /** For PDF: jump to this page (1-indexed). */
  page?: number;
  /** For audio/video: jump to this timestamp in seconds. */
  timestamp?: number;
  /** For PDF: highlight this text excerpt. */
  highlightText?: string;
}

/** Transcript entry used by the audio viewer. */
export interface TranscriptEntry {
  /** Timestamp in seconds. */
  time: number;
  /** Speaker name / label. */
  speaker: string;
  /** Spoken text content. */
  text: string;
}

/** Video timestamp marker used by the video viewer. */
export interface VideoMarker {
  /** Timestamp in seconds. */
  time: number;
  /** Human-readable label for the marker. */
  label: string;
}

// ---------------------------------------------------------------------------
// Content type icon mapping
// ---------------------------------------------------------------------------

const CONTENT_TYPE_ICONS: Record<
  SourceViewerContent["type"],
  React.ComponentType<{ size?: number; className?: string }>
> = {
  pdf: FileText,
  audio: Music,
  video: Video,
  image: ImageIcon,
};

const CONTENT_TYPE_LABELS: Record<SourceViewerContent["type"], string> = {
  pdf: "Document",
  audio: "Audio",
  video: "Video",
  image: "Image",
};

// ---------------------------------------------------------------------------
// SourceViewerModal
// ---------------------------------------------------------------------------

interface SourceViewerModalProps {
  /** Content to display. When null, the modal is hidden. */
  content: SourceViewerContent | null;
  /** Called when the user closes the modal. */
  onClose: () => void;
  /** Optional transcript data for audio viewer. */
  transcriptEntries?: TranscriptEntry[];
  /** Optional timestamp markers for video viewer. */
  videoMarkers?: VideoMarker[];
  /** Optional CSS class name for layout positioning by the parent. */
  className?: string;
}

export function SourceViewerModal({
  content,
  onClose,
  transcriptEntries,
  videoMarkers,
  className,
}: SourceViewerModalProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!content) return null;

  const IconComponent = CONTENT_TYPE_ICONS[content.type];
  const typeLabel = CONTENT_TYPE_LABELS[content.type];

  return (
    <div
      className={`flex flex-col h-full bg-jet border border-stone/15 shadow-2xl rounded-lg overflow-hidden ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-stone/15">
        <div className="flex items-center gap-2 min-w-0">
          <IconComponent size={16} className="text-stone shrink-0" />
          <span className="text-xs text-stone uppercase tracking-wider shrink-0">
            {typeLabel}
          </span>
          <span className="text-sm text-smoke font-medium truncate">
            {content.fileName}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md hover:bg-charcoal/60 transition-colors shrink-0"
          aria-label="Close source viewer"
        >
          <X size={16} className="text-stone" />
        </button>
      </div>

      {/* Content area - fills remaining space */}
      <div className="flex-1 overflow-hidden">
        {content.type === "pdf" && (
          <PdfViewer
            fileUrl={content.url}
            initialPage={content.page}
            highlightKeyword={content.highlightText}
          />
        )}
        {content.type === "audio" && (
          <AudioViewer
            audioUrl={content.url}
            initialTimestamp={content.timestamp}
            transcriptEntries={transcriptEntries}
          />
        )}
        {content.type === "video" && (
          <VideoViewer
            videoUrl={content.url}
            initialTimestamp={content.timestamp}
            markers={videoMarkers}
          />
        )}
        {content.type === "image" && (
          <ImageViewer imageUrl={content.url} fileName={content.fileName} />
        )}
      </div>
    </div>
  );
}
