// ABOUTME: Type definitions for the app-wide right detail sidebar.
// ABOUTME: Uses discriminated union pattern for content descriptors.

import type { SourceViewerContent } from "@/components/source-viewer/SourceViewerModal";
import type { EntityResponse, RelationshipResponse } from "./knowledge-graph";
import type {
  HypothesisResponse,
  ContradictionResponse,
  GapResponse,
} from "./synthesis";

// ---------------------------------------------------------------------------
// Content Descriptors (discriminated union)
// ---------------------------------------------------------------------------

/** Command Center agent node detail view */

/** Knowledge Graph evidence / source viewer detail view */
export interface KnowledgeGraphEvidenceContent {
  type: "knowledge-graph-evidence";
  props: {
    content: SourceViewerContent;
  };
}

/** Knowledge Graph entity detail view (replaces inline EntityTimeline) */
export interface KnowledgeGraphEntityContent {
  type: "knowledge-graph-entity";
  props: {
    caseId: string;
    entityId: string;
    entity: EntityResponse;
    relationships: RelationshipResponse[];
    allEntities: EntityResponse[];
    onEntitySelect?: (entityId: string) => void;
    onViewFinding?: (findingId: string) => void;
  };
}

/** Verdict hypothesis detail view */
export interface VerdictHypothesisContent {
  type: "verdict-hypothesis";
  props: {
    caseId: string;
    hypothesis: HypothesisResponse;
    onViewFinding?: (findingId: string) => void;
  };
}

/** Verdict contradiction detail view */
export interface VerdictContradictionContent {
  type: "verdict-contradiction";
  props: {
    caseId: string;
    contradiction: ContradictionResponse;
    onViewFinding?: (findingId: string) => void;
  };
}

/** Verdict gap detail view */
export interface VerdictGapContent {
  type: "verdict-gap";
  props: {
    gap: GapResponse;
  };
}

/** Union of all possible sidebar content descriptors */
export type SidebarContentDescriptor =
  | KnowledgeGraphEvidenceContent
  | KnowledgeGraphEntityContent
  | VerdictHypothesisContent
  | VerdictContradictionContent
  | VerdictGapContent;

// ---------------------------------------------------------------------------
// Sidebar State
// ---------------------------------------------------------------------------

export interface DetailSidebarState {
  content: SidebarContentDescriptor | null;
  isCollapsed: boolean;
  widthPercent: number;
}

export interface DetailSidebarDispatch {
  setContent: (content: SidebarContentDescriptor) => void;
  clearContent: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setWidthPercent: (percent: number) => void;
}

// ---------------------------------------------------------------------------
// Width Constants
// ---------------------------------------------------------------------------

export const SIDEBAR_WIDTH_MIN = 20;
export const SIDEBAR_WIDTH_MAX = 50;
export const SIDEBAR_WIDTH_DEFAULT = 40;
