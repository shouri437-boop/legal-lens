// ABOUTME: Modal component for playing video in a centered lightbox overlay.
// ABOUTME: Supports keyboard dismissal, click-outside close, and auto-pause on close.

"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  poster?: string;
}

/**
 * A modal/lightbox video player component.
 *
 * Features:
 * - Centered modal with backdrop blur
 * - Native HTML5 video controls
 * - Click outside to close
 * - Escape key to close
 * - Auto-pause when modal closes
 * - Fade in/out animation
 *
 * @example
 * ```tsx
 * <VideoModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   src="/video.mp4"
 * />
 * ```
 */
export function VideoModal({ isOpen, onClose, src, poster }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  // Pause video and clean up when modal closes
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      // Focus the modal for accessibility
      modalRef.current?.focus();
    } else {
      // Pause video when closing
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Handle click outside video to close
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
          tabIndex={-1}
        >
          {/* Close button */}
          <motion.button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-smoke/10 text-smoke transition-colors hover:bg-smoke/20 sm:right-6 sm:top-6"
            onClick={onClose}
            aria-label="Close video"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, delay: 0.1 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </motion.button>

          {/* Video container */}
          <motion.div
            className="relative aspect-video w-full max-w-5xl px-4 sm:px-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <video
              ref={videoRef}
              className="h-full w-full rounded-lg bg-jet"
              src={src}
              poster={poster}
              controls
              autoPlay
              playsInline
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document root to avoid z-index issues
  if (typeof window === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}
