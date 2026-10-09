// ABOUTME: Citation parsing utilities for source viewer navigation.
// ABOUTME: Parses locator strings (page, timestamp, region) and maps file categories to viewer types.

import type { SourceViewerContent } from "@/components/source-viewer/SourceViewerModal";

// ---------------------------------------------------------------------------
// Citation types (reusable across all consumers)
// ---------------------------------------------------------------------------

/** Describes a citation referencing a specific location within a source file. */
export interface Citation {
  file_id: string;
  locator: string;
  excerpt?: string;
}

/** Citation that references a finding rather than a file directly. */
export interface FindingCitation {
  finding_id: string;
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Locator parsing
// ---------------------------------------------------------------------------

/** Result of parsing a locator string into a typed structure. */
export interface ParsedLocator {
  type: "page" | "timestamp" | "region" | "unknown";
  /** 1-indexed page number (only for type="page"). */
  page?: number;
  /** Timestamp in seconds (only for type="timestamp"). */
  timestamp?: number;
  /** Image region coordinates (only for type="region"). */
  region?: { x: number; y: number; w: number; h: number };
}

/**
 * Parses a locator string into a typed structure.
 *
 * Supported formats:
 * - "page:3"           -> { type: "page", page: 3 }
 * - "ts:01:23:45"      -> { type: "timestamp", timestamp: 5025 }
 * - "ts:23:45"         -> { type: "timestamp", timestamp: 1425 }
 * - "region:x,y,w,h"  -> { type: "region", region: { x, y, w, h } }
 * - Anything else      -> { type: "unknown" }
 */
export function parseLocator(
  locator: string | null | undefined,
): ParsedLocator {
  if (!locator || locator.trim() === "") {
    return { type: "unknown" };
  }

  const trimmed = locator.trim();

  // Page locator: "page:N"
  if (trimmed.startsWith("page:")) {
    const pageNum = parseInt(trimmed.slice(5), 10);
    if (!isNaN(pageNum) && pageNum > 0) {
      return { type: "page", page: pageNum };
    }
    return { type: "unknown" };
  }

  // Timestamp locator: "ts:HH:MM:SS" or "ts:MM:SS"
  if (trimmed.startsWith("ts:")) {
    const timeStr = trimmed.slice(3);
    const parts = timeStr.split(":").map(Number);
    if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) {
      return { type: "unknown" };
    }
    const seconds = parts.reduce((acc, p) => acc * 60 + p, 0);
    return { type: "timestamp", timestamp: seconds };
  }

  // Region locator: "region:x,y,w,h"
  if (trimmed.startsWith("region:")) {
    const regionStr = trimmed.slice(7);
    const coords = regionStr.split(",").map(Number);
    if (coords.length === 4 && coords.every((c) => !isNaN(c))) {
      const [x, y, w, h] = coords;
      return { type: "region", region: { x, y, w, h } };
    }
    return { type: "unknown" };
  }

  return { type: "unknown" };
}

// ---------------------------------------------------------------------------
// File category to viewer type mapping
// ---------------------------------------------------------------------------

/**
 * Maps a file category string to the SourceViewerContent type.
 *
 * - "DOCUMENT" -> "pdf"
 * - "AUDIO"    -> "audio"
 * - "VIDEO"    -> "video"
 * - "IMAGE"    -> "image"
 * - Default    -> "pdf" (fallback)
 */
export function categoryToViewerType(
  category: string,
): SourceViewerContent["type"] {
  switch (category.toUpperCase()) {
    case "DOCUMENT":
      return "pdf";
    case "AUDIO":
      return "audio";
    case "VIDEO":
      return "video";
    case "IMAGE":
      return "image";
    default:
      return "pdf";
  }
}

// ---------------------------------------------------------------------------
// Locator display formatting
// ---------------------------------------------------------------------------

/**
 * Formats a locator string for human-readable display.
 *
 * - "page:3"      -> "Page 3"
 * - "ts:01:23:45" -> "01:23:45"
 * - "ts:23:45"    -> "23:45"
 * - Otherwise     -> raw locator text
 */
export function formatLocatorDisplay(
  locator: string | null | undefined,
): string {
  if (!locator || locator.trim() === "") {
    return "";
  }

  const trimmed = locator.trim();

  if (trimmed.startsWith("page:")) {
    const pageNum = parseInt(trimmed.slice(5), 10);
    if (!isNaN(pageNum)) {
      return `Page ${pageNum}`;
    }
  }

  if (trimmed.startsWith("ts:")) {
    return trimmed.slice(3);
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Finding ID normalization
// ---------------------------------------------------------------------------

/**
 * Strips known prefixes from finding IDs produced by synthesis agents.
 *
 * The synthesis agent may store finding references with a "FINDING:" prefix
 * (e.g., "FINDING:ae6b850d-..."). The findings API expects a bare UUID.
 * This normalizer handles that boundary.
 */
export function normalizeFindingId(rawId: string): string {
  const trimmed = rawId.trim();
  if (trimmed.toUpperCase().startsWith("FINDING:")) {
    return trimmed.slice("FINDING:".length);
  }
  return trimmed;
}
