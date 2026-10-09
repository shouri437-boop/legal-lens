// ABOUTME: Command Center configuration - agent metadata, connection topology,
// ABOUTME: teal accent tint mappings, and layout dimension constants.

import type { AgentConfig, AgentType } from "@/types/command-center";

// Agent configurations. Positions are placeholders (layout engine computes actual
// positions). CSS variables provide colors. Placeholders satisfy the AgentConfig type.
export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  triage: {
    type: "triage",
    name: "Triage Agent",
    description: "Analyzes files and makes routing decisions",
    color: "",
    position: { x: 0, y: 0 },
  },
  orchestrator: {
    type: "orchestrator",
    name: "Orchestrator",
    description: "Coordinates parallel processing across domain agents",
    color: "",
    position: { x: 0, y: 0 },
  },
  legal: {
    type: "legal",
    name: "Legal Agent",
    description: "Extracts legal entities and relationships",
    color: "",
    position: { x: 0, y: 0 },
  },
  evidence: {
    type: "evidence",
    name: "Evidence Agent",
    description: "Analyzes evidence authenticity and chain of custody",
    color: "",
    position: { x: 0, y: 0 },
  },
  "knowledge-graph": {
    type: "knowledge-graph",
    name: "Knowledge Graph Agent",
    description: "Builds unified knowledge graph from all agents",
    color: "",
    position: { x: 0, y: 0 },
  },
  synthesis: {
    type: "synthesis",
    name: "Synthesis Agent",
    description: "Generates hypotheses, contradictions, gaps, and case verdict",
    color: "",
    position: { x: 0, y: 0 },
  },
};

// Default connections between agents
export const DEFAULT_CONNECTIONS: Array<{
  source: AgentType;
  target: AgentType;
}> = [
  { source: "triage", target: "orchestrator" },
  { source: "orchestrator", target: "legal" },
  { source: "orchestrator", target: "evidence" },
  { source: "legal", target: "knowledge-graph" },
  { source: "evidence", target: "knowledge-graph" },
  { source: "knowledge-graph", target: "synthesis" },
];

// Per-agent color variable pair: tint (subtle background) and accent (bright text/glow)
export interface AgentColorVars {
  tint: string;
  accent: string;
}

// Maps each agent type to its CSS variable pair for per-agent color identity.
// Consumed by DecisionNode for background tint and accent text/glow.
export const AGENT_TYPE_COLORS: Record<AgentType, AgentColorVars> = {
  triage: { tint: "var(--cc-triage-tint)", accent: "var(--cc-triage-accent)" },
  orchestrator: {
    tint: "var(--cc-orchestrator-tint)",
    accent: "var(--cc-orchestrator-accent)",
  },
  legal: { tint: "var(--cc-legal-tint)", accent: "var(--cc-legal-accent)" },
  evidence: {
    tint: "var(--cc-evidence-tint)",
    accent: "var(--cc-evidence-accent)",
  },
  "knowledge-graph": {
    tint: "var(--cc-kg-tint)",
    accent: "var(--cc-kg-accent)",
  },
  synthesis: {
    tint: "var(--cc-synthesis-tint)",
    accent: "var(--cc-synthesis-accent)",
  },
};

/**
 * Resolve color variables for an agent type. Returns CSS variable references for
 * known types; for unknown/dynamic types, derives a deterministic hue from a djb2
 * hash and returns raw HSL components that work identically in hsl() expressions.
 */
export function getAgentColors(agentType: string): AgentColorVars {
  if (agentType in AGENT_TYPE_COLORS) {
    return AGENT_TYPE_COLORS[agentType as AgentType];
  }

  // djb2 hash -> deterministic hue for unknown agent types
  let hash = 5381;
  for (let i = 0; i < agentType.length; i++) {
    hash = (hash * 33) ^ agentType.charCodeAt(i);
  }
  const hue = (hash >>> 0) % 360;
  return {
    tint: `${hue} 28% 18%`,
    accent: `${hue} 42% 55%`,
  };
}

// Node dimensions for layout computation. DecisionNode enforces the same
// fixed dimensions via Tailwind classes (w-[300px] h-[100px]).
export const NODE_WIDTH = 300;
export const NODE_HEIGHT = 100;

// File group node dimensions for layout. FileGroupNode enforces the same
// fixed dimensions via inline styles (w-[240px] h-[80px]).
export const FILE_GROUP_NODE_WIDTH = 240;
export const FILE_GROUP_NODE_HEIGHT = 80;

// Status colors - retained for backward compatibility with AgentNode.tsx (SVG).
// Will be removed when AgentNode.tsx is replaced by DecisionNode in Plan 03.
export const STATUS_COLORS = {
  idle: "#9ca3af",
  processing: "#8B7355",
  complete: "#9D8B73",
  error: "#ef4444",
};
