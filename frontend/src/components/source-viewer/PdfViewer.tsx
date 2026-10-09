// ABOUTME: PDF rendering component using @react-pdf-viewer/default-layout with built-in toolbar,
// ABOUTME: zoom controls, page navigation, search/highlight, and scrollable document view.

"use client";

import { useEffect } from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

// ---------------------------------------------------------------------------
// Worker URL for pdfjs-dist 3.11.174 (must match installed version)
// ---------------------------------------------------------------------------

const PDFJS_WORKER_URL =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

// ---------------------------------------------------------------------------
// Flexible highlight regex builder
// ---------------------------------------------------------------------------

/**
 * Builds a case-insensitive RegExp from excerpt text that tolerates whitespace
 * variations in the PDF text layer. Escapes regex special characters, then
 * replaces whitespace runs with `\s+` so line breaks / extra spaces still match.
 */
function buildFlexibleHighlightRegex(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.replace(/\s+/g, "\\s+");
  return new RegExp(flexible, "i");
}

// ---------------------------------------------------------------------------
// PdfViewer
// ---------------------------------------------------------------------------

interface PdfViewerProps {
  /** Signed URL or path to the PDF file. */
  fileUrl: string;
  /** Page to jump to on mount or when changed (1-indexed, human-friendly). */
  initialPage?: number;
  /** Keyword text to highlight across the PDF. */
  highlightKeyword?: string;
}

export function PdfViewer({
  fileUrl,
  initialPage,
  highlightKeyword,
}: PdfViewerProps) {
  // Build a flexible regex for the highlight keyword (tolerates whitespace diffs)
  const highlightRegex = highlightKeyword
    ? buildFlexibleHighlightRegex(highlightKeyword)
    : undefined;

  // defaultLayoutPlugin aggregates toolbar (zoom, search, page nav), sidebar, etc.
  // Disable sidebar tabs since we only need the toolbar + document view.
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
    toolbarPlugin: {
      searchPlugin: highlightRegex ? { keyword: [highlightRegex] } : undefined,
    },
  });

  const { toolbarPluginInstance } = defaultLayoutPluginInstance;
  const { pageNavigationPluginInstance, searchPluginInstance } =
    toolbarPluginInstance;

  // Jump to page when initialPage changes (convert 1-indexed to 0-indexed)
  useEffect(() => {
    if (initialPage !== undefined && initialPage > 0) {
      // Small delay to ensure the viewer has rendered and plugin is installed
      const timer = setTimeout(() => {
        pageNavigationPluginInstance.jumpToPage(initialPage - 1);
      }, 300);
      return () => clearTimeout(timer);
    }
    // pageNavigationPluginInstance changes identity every render but jumpToPage is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage]);

  // Highlight keyword when it changes
  useEffect(() => {
    if (highlightRegex) {
      // Delay to ensure the document is loaded (larger delay for better reliability)
      const timer = setTimeout(() => {
        searchPluginInstance.highlight(highlightRegex);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      searchPluginInstance.clearHighlights();
    }
    // searchPluginInstance changes identity every render but highlight/clear are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKeyword]);

  return (
    <div className="h-full w-full pdf-viewer-container">
      <Worker workerUrl={PDFJS_WORKER_URL}>
        <Viewer
          fileUrl={fileUrl}
          plugins={[defaultLayoutPluginInstance]}
          theme="dark"
          defaultScale={1}
          renderLoader={(percentages: number) => (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-sm text-stone mb-2">Loading PDF...</div>
                <div className="w-48 h-1.5 bg-charcoal/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-smoke/60 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(percentages)}%` }}
                  />
                </div>
                <div className="text-xs text-stone mt-1">
                  {Math.round(percentages)}%
                </div>
              </div>
            </div>
          )}
          renderError={(error) => (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <div className="text-sm text-red-400 mb-1">
                  Failed to load PDF
                </div>
                <div className="text-xs text-stone">
                  {error.message || "Unknown error occurred"}
                </div>
              </div>
            </div>
          )}
        />
      </Worker>
      {/* Override PDF viewer styles to match Legal Lens dark theme */}
      <style jsx global>{`
        .pdf-viewer-container .rpv-core__viewer {
          background-color: var(--color-jet, #111111);
        }
        .pdf-viewer-container .rpv-core__inner-page {
          background-color: transparent;
        }
        .pdf-viewer-container .rpv-core__page-layer {
          box-shadow: none;
        }
        .pdf-viewer-container .rpv-search__highlight {
          background-color: rgba(212, 168, 67, 0.35);
          border-radius: 2px;
        }
        .pdf-viewer-container .rpv-search__highlight--current {
          background-color: rgba(212, 168, 67, 0.6);
        }
        /* Dark theme overrides for default-layout toolbar and containers */
        .pdf-viewer-container .rpv-default-layout__toolbar {
          background-color: var(--color-charcoal, #1a1a1a);
          border-bottom: 1px solid rgba(107, 101, 96, 0.15);
        }
        .pdf-viewer-container .rpv-default-layout__container {
          background-color: var(--color-jet, #111111);
          border: none;
        }
        .pdf-viewer-container .rpv-default-layout__body {
          background-color: var(--color-jet, #111111);
        }
        .pdf-viewer-container .rpv-core__minimal-button {
          color: var(--color-stone, #6b6560);
        }
        .pdf-viewer-container .rpv-core__minimal-button:hover {
          background-color: rgba(107, 101, 96, 0.15);
          color: var(--color-smoke, #c8c3bc);
        }
        .pdf-viewer-container .rpv-core__textbox {
          background-color: rgba(107, 101, 96, 0.1);
          border-color: rgba(107, 101, 96, 0.2);
          color: var(--color-smoke, #c8c3bc);
        }
      `}</style>
    </div>
  );
}
