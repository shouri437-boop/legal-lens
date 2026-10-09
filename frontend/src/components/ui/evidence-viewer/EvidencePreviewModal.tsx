// ABOUTME: Modal component for previewing evidence files in a popup.
// ABOUTME: Adapts size and layout based on file type (PDF, video, image, audio).

"use client";

import { useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  Video,
  Image as ImageIcon,
  Music,
  Loader2,
} from "lucide-react";
import { EvidenceViewer, type EvidenceFileType } from "./EvidenceViewer";

/**
 * Props for the EvidencePreviewModal component
 */
export interface EvidencePreviewModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The URL of the file to preview */
  url: string;
  /** The type of file being previewed */
  type: EvidenceFileType;
  /** Display name for the file */
  fileName?: string;
  /** Optional callback when download is requested */
  onDownload?: () => void;
}

/**
 * Get the appropriate icon for a file type
 */
function getFileTypeIcon(type: EvidenceFileType) {
  const iconProps = { className: "w-5 h-5" };
  switch (type) {
    case "pdf":
      return <FileText {...iconProps} />;
    case "video":
      return <Video {...iconProps} />;
    case "image":
      return <ImageIcon {...iconProps} />;
    case "audio":
      return <Music {...iconProps} />;
    default:
      return <FileText {...iconProps} />;
  }
}

/**
 * Get the modal size configuration based on file type
 */
function getModalConfig(type: EvidenceFileType) {
  switch (type) {
    case "pdf":
      return {
        width: "min(1000px, 90vw)",
        height: "min(850px, 90vh)",
        title: "Document Preview",
        accentColor: "text-blue-500",
        bgAccent: "bg-blue-500/10",
      };
    case "video":
      return {
        width: "min(1200px, 95vw)",
        height: "min(750px, 85vh)",
        title: "Video Preview",
        accentColor: "text-red-500",
        bgAccent: "bg-red-500/10",
      };
    case "image":
      return {
        width: "min(1100px, 95vw)",
        height: "min(800px, 90vh)",
        title: "Image Preview",
        accentColor: "text-green-500",
        bgAccent: "bg-green-500/10",
      };
    case "audio":
      return {
        width: "min(600px, 90vw)",
        height: "min(500px, 80vh)",
        title: "Audio Preview",
        accentColor: "text-purple-500",
        bgAccent: "bg-purple-500/10",
      };
    default:
      return {
        width: "min(900px, 90vw)",
        height: "min(700px, 85vh)",
        title: "File Preview",
        accentColor: "text-stone",
        bgAccent: "bg-stone/10",
      };
  }
}

/**
 * EvidencePreviewModal - A popup modal for previewing evidence files
 *
 * This modal adapts its size, layout, and styling based on the type of file
 * being previewed. It provides a consistent preview experience across:
 * - PDF documents (tall, scrollable)
 * - Videos (wide, cinematic)
 * - Images (square-ish, zoomable)
 * - Audio (compact, focused on controls)
 *
 * @example
 * ```tsx
 * <EvidencePreviewModal
 *   isOpen={isPreviewOpen}
 *   onClose={() => setIsPreviewOpen(false)}
 *   url="https://example.com/document.pdf"
 *   type="pdf"
 *   fileName="Financial Report.pdf"
 * />
 * ```
 */
export function EvidencePreviewModal({
  isOpen,
  onClose,
  url,
  type,
  fileName,
  onDownload,
}: EvidencePreviewModalProps) {
  const config = useMemo(() => getModalConfig(type), [type]);

  // Handle escape key to close modal
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  // Set up event listeners when modal opens
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Handle click on backdrop to close
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
          >
            <div
              className="bg-(--card) border border-(--border) rounded-xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                width: config.width,
                height: config.height,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-warm-gray/15 dark:border-stone/15 bg-warm-gray/5 dark:bg-stone/5">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${config.bgAccent}`}>
                    <span className={config.accentColor}>
                      {getFileTypeIcon(type)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {config.title}
                    </h2>
                    {fileName && (
                      <p className="text-xs text-muted-foreground truncate max-w-64">
                        {fileName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {url ? (
                  <EvidenceViewer
                    url={url}
                    type={type}
                    fileName={fileName}
                    showControls={true}
                    onDownload={onDownload}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Loading {fileName || "file"}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document root
  if (typeof window === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}

export default EvidencePreviewModal;
