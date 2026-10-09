// ABOUTME: Core reusable iframe/media viewer component for different evidence file types.
// ABOUTME: Supports PDF, video, image, and audio with type-specific rendering and controls.

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  Loader2,
} from "lucide-react";

/**
 * Loading overlay component shown while file is loading
 */
function LoadingOverlay({
  fileName,
  fileSize,
}: {
  fileName?: string;
  fileSize?: number;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
      <Loader2 className="w-12 h-12 animate-spin text-accent-light mb-4" />
      <p className="text-sm font-medium text-foreground mb-1">
        Loading {fileName || "file"}...
      </p>
      {fileSize && (
        <p className="text-xs text-muted-foreground">
          {(fileSize / (1024 * 1024)).toFixed(1)} MB
        </p>
      )}
    </div>
  );
}

/**
 * Supported file types for the EvidenceViewer
 */
export type EvidenceFileType = "pdf" | "video" | "image" | "audio";

/**
 * Props for the EvidenceViewer component
 */
export interface EvidenceViewerProps {
  /** The URL of the file to display */
  url: string;
  /** The type of file being displayed */
  type: EvidenceFileType;
  /** Display name for the file */
  fileName?: string;
  /** Optional className for the container */
  className?: string;
  /** Whether to show controls (zoom, fullscreen, etc.) */
  showControls?: boolean;
  /** Whether the viewer should be compact (minimal UI) */
  compact?: boolean;
  /** Callback when the viewer requests fullscreen */
  onFullscreenRequest?: () => void;
  /** Callback when download is requested */
  onDownload?: () => void;
  /** Optional initial zoom level (percentage) */
  initialZoom?: number;
}

/**
 * EvidenceViewer - A flexible iframe/media component for viewing evidence files
 *
 * This component provides a unified interface for viewing different types of evidence:
 * - PDF: Rendered via iframe with zoom controls
 * - Video: Native video player with custom controls
 * - Image: Image viewer with zoom, pan, and rotation
 * - Audio: Audio player with waveform visualization
 *
 * @example
 * ```tsx
 * <EvidenceViewer
 *   url="https://example.com/document.pdf"
 *   type="pdf"
 *   fileName="Financial Report.pdf"
 *   showControls={true}
 * />
 * ```
 */
export function EvidenceViewer({
  url,
  type,
  fileName,
  className = "",
  showControls = true,
  compact = false,
  onFullscreenRequest,
  onDownload,
  initialZoom = 100,
}: EvidenceViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset loading state when URL changes (during render, not in an effect)
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setIsLoading(true);
    setLoadError(null);
  }

  // Render the appropriate viewer based on file type
  switch (type) {
    case "pdf":
      return (
        <PDFViewer
          url={url}
          fileName={fileName}
          className={className}
          showControls={showControls}
          compact={compact}
          onFullscreenRequest={onFullscreenRequest}
          onDownload={onDownload}
          initialZoom={initialZoom}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          loadError={loadError}
          setLoadError={setLoadError}
        />
      );
    case "video":
      return (
        <VideoViewer
          url={url}
          fileName={fileName}
          className={className}
          showControls={showControls}
          compact={compact}
          onFullscreenRequest={onFullscreenRequest}
          onDownload={onDownload}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          loadError={loadError}
          setLoadError={setLoadError}
        />
      );
    case "image":
      return (
        <ImageViewer
          url={url}
          fileName={fileName}
          className={className}
          showControls={showControls}
          compact={compact}
          onFullscreenRequest={onFullscreenRequest}
          onDownload={onDownload}
          initialZoom={initialZoom}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          loadError={loadError}
          setLoadError={setLoadError}
        />
      );
    case "audio":
      return (
        <AudioViewer
          url={url}
          fileName={fileName}
          className={className}
          showControls={showControls}
          compact={compact}
          onDownload={onDownload}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          loadError={loadError}
          setLoadError={setLoadError}
        />
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>Unsupported file type</p>
        </div>
      );
  }
}

// ============================================================================
// PDF Viewer
// ============================================================================

interface PDFViewerProps {
  url: string;
  fileName?: string;
  className?: string;
  showControls?: boolean;
  compact?: boolean;
  onFullscreenRequest?: () => void;
  onDownload?: () => void;
  initialZoom?: number;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;
}

function PDFViewer({
  url,
  fileName,
  className = "",
  showControls = true,
  compact = false,
  onFullscreenRequest,
  onDownload,
  initialZoom = 100,
  isLoading,
  setIsLoading,
}: PDFViewerProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  // Construct PDF URL with zoom parameter if supported
  const pdfUrl = url.includes("#") ? url : `${url}#zoom=${zoom}`;

  return (
    <div className={`flex flex-col h-full relative ${className}`}>
      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay fileName={fileName} />}
      {/* Controls Bar */}
      {showControls && !compact && (
        <div className="flex-none flex items-center justify-between px-3 py-2 bg-warm-gray/5 dark:bg-stone/10 border-b border-warm-gray/15 dark:border-stone/15">
          <div className="flex items-center gap-2">
            {fileName && (
              <span className="text-xs text-muted-foreground truncate max-w-48">
                {fileName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Reset zoom"
            >
              <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {onFullscreenRequest && (
              <button
                onClick={onFullscreenRequest}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* PDF Iframe */}
      <div className="flex-1 overflow-hidden bg-stone/5">
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="w-full h-full border-0"
          title={fileName || "PDF Document"}
          onLoad={handleIframeLoad}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}%`,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Video Viewer
// ============================================================================

interface VideoViewerProps {
  url: string;
  fileName?: string;
  className?: string;
  showControls?: boolean;
  compact?: boolean;
  onFullscreenRequest?: () => void;
  onDownload?: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;
}

function VideoViewer({
  url,
  fileName,
  className = "",
  showControls = true,
  compact = false,
  onFullscreenRequest,
  onDownload,
  isLoading,
  setIsLoading,
}: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skipBack = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        videoRef.current.currentTime - 10,
      );
    }
  }, []);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        duration,
        videoRef.current.currentTime + 10,
      );
    }
  }, [duration]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (!isFullscreen) {
        videoRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
    onFullscreenRequest?.();
  }, [isFullscreen, onFullscreenRequest]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Video Element */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0">
        {isLoading && <LoadingOverlay fileName={fileName} />}
        <video
          ref={videoRef}
          src={url}
          className="max-w-full max-h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => setIsLoading(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
        />

        {/* Play overlay */}
        {!isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      {showControls && !compact && (
        <div className="flex-none bg-warm-gray/5 dark:bg-stone/10 border-t border-warm-gray/15 dark:border-stone/15 px-3 py-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground w-12">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-warm-gray/20 dark:bg-stone/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-light [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-muted-foreground w-12 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={skipBack}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Skip back 10s"
              >
                <SkipBack className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={togglePlay}
                className="p-2 rounded-full bg-accent-light/10 hover:bg-accent-light/20 transition-colors"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-accent-light" />
                ) : (
                  <Play className="w-5 h-5 text-accent-light ml-0.5" />
                )}
              </button>
              <button
                onClick={skipForward}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Skip forward 10s"
              >
                <SkipForward className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {fileName && (
                <span className="text-xs text-muted-foreground truncate max-w-32 mr-2">
                  {fileName}
                </span>
              )}
              <button
                onClick={toggleMute}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={handleFullscreen}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Image Viewer
// ============================================================================

interface ImageViewerProps {
  url: string;
  fileName?: string;
  className?: string;
  showControls?: boolean;
  compact?: boolean;
  onFullscreenRequest?: () => void;
  onDownload?: () => void;
  initialZoom?: number;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;
}

function ImageViewer({
  url,
  fileName,
  className = "",
  showControls = true,
  compact = false,
  onFullscreenRequest,
  onDownload,
  initialZoom = 100,
  isLoading,
  setIsLoading,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));
  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 100) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [zoom, position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom((prev) => Math.min(Math.max(prev + delta, 25), 300));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className={`flex flex-col h-full relative ${className}`}>
      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay fileName={fileName} />}

      {/* Controls Bar */}
      {showControls && !compact && (
        <div className="flex-none flex items-center justify-between px-3 py-2 bg-warm-gray/5 dark:bg-stone/10 border-b border-warm-gray/15 dark:border-stone/15">
          <div className="flex items-center gap-2">
            {fileName && (
              <span className="text-xs text-muted-foreground truncate max-w-48">
                {fileName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleRotate}
              className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors text-muted-foreground"
              title="Reset"
            >
              Reset
            </button>
            {onFullscreenRequest && (
              <button
                onClick={onFullscreenRequest}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Image Container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden bg-stone/5 flex items-center justify-center ${
          zoom > 100 ? "cursor-grab" : ""
        } ${isDragging ? "cursor-grabbing" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={fileName || "Image"}
          className="max-w-full max-h-full object-contain select-none"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg) translate(${position.x / (zoom / 100)}px, ${position.y / (zoom / 100)}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Audio Viewer
// ============================================================================

interface AudioViewerProps {
  url: string;
  fileName?: string;
  className?: string;
  showControls?: boolean;
  compact?: boolean;
  onDownload?: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;
}

function AudioViewer({
  url,
  fileName,
  className = "",
  showControls = true,
  compact = false,
  onDownload,
  isLoading,
  setIsLoading,
}: AudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skipBack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime - 10,
      );
    }
  }, []);

  const skipForward = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        duration,
        audioRef.current.currentTime + 10,
      );
    }
  }, [duration]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`relative flex flex-col h-full ${className}`}>
      {isLoading && <LoadingOverlay fileName={fileName} />}
      {/* Audio Visualization Area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-linear-to-b from-purple-500/5 to-purple-500/10 dark:from-purple-500/10 dark:to-purple-500/20 p-8">
        {/* Audio Icon */}
        <div className="w-24 h-24 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center mb-6">
          <svg
            className="w-12 h-12 text-purple-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>

        {/* File Name */}
        {fileName && (
          <p className="text-sm text-foreground font-medium mb-2 text-center">
            {fileName}
          </p>
        )}

        {/* Time Display */}
        <p className="text-2xl font-mono text-muted-foreground mb-4">
          {formatTime(currentTime)} / {formatTime(duration)}
        </p>

        {/* Waveform Placeholder */}
        <div className="w-full max-w-md h-16 rounded-lg bg-warm-gray/10 dark:bg-stone/20 flex items-center justify-center overflow-hidden">
          <div className="flex items-end justify-center gap-0.5 h-full py-2">
            {Array.from({ length: 50 }).map((_, i) => {
              const height = Math.sin(i * 0.3 + currentTime) * 30 + 35;
              const isActive = (i / 50) * duration <= currentTime;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isActive ? "bg-purple-500" : "bg-purple-500/30"
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => setIsLoading(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {/* Controls Bar */}
      {showControls && !compact && (
        <div className="flex-none bg-warm-gray/5 dark:bg-stone/10 border-t border-warm-gray/15 dark:border-stone/15 px-4 py-3">
          {/* Progress Bar */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-warm-gray/20 dark:bg-stone/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={skipBack}
              className="p-2 rounded-lg hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Skip back 10s"
            >
              <SkipBack className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-purple-500 hover:bg-purple-600 transition-colors shadow-lg"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </button>
            <button
              onClick={skipForward}
              className="p-2 rounded-lg hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title="Skip forward 10s"
            >
              <SkipForward className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="w-px h-6 bg-warm-gray/20 dark:bg-stone/20 mx-2" />
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Volume2 className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 rounded-lg hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EvidenceViewer;
