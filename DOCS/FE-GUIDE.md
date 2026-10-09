# Frontend Integration Guide: Agent Pipeline & Real-Time Events

This document is the single source of truth for frontend developers integrating
with the Legal Lens agent pipeline backend. It covers SSE event contracts, REST
endpoints, HITL (Human-in-the-Loop) confirmation flows, and the data each agent
produces.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [SSE Connection](#2-sse-connection)
3. [SSE Event Reference](#3-sse-event-reference)
4. [HITL Confirmation System](#4-hitl-confirmation-system)
5. [REST API Reference](#5-rest-api-reference)
6. [Agent Data Models](#6-agent-data-models)
7. [Suggested UI Patterns](#7-suggested-ui-patterns)

---

## 1. Architecture Overview

```
  User clicks "Analyze"
         |
         v
  POST /api/cases/{id}/analyze  -->  202 { workflowId }
         |
         v
  Frontend opens SSE:  GET /sse/cases/{id}/command-center/stream
         |
         v
  +-----------+     +--------------+     +------------------+     +----------+
  |  TRIAGE   | --> | ORCHESTRATOR | --> |  DOMAIN AGENTS   | --> | STRATEGY |
  |  (Flash)  |     |    (Pro)     |     | fin/leg/evi (Pro)|     |  (Pro)   |
  +-----------+     +--------------+     |  parallel via    |     +----------+
                           |             |  asyncio.gather  |          |
                    +------+------+      +------------------+          |
                    | ROUTING HITL|                                    v
                    | Tier 1: Plan|                             +----------+
                    | Tier 2: Batch                             | FINDINGS |
                    +-------------+                             |   HITL   |
                                                               +----------+
                                                                     |
                                                                     v
                                                             processing-complete
```

**Key Principle**: The frontend is event-driven. It opens ONE SSE connection
per case and reacts to events as they arrive. The pipeline runs in a background
task; no polling is needed.

---

## 2. SSE Connection

### Endpoint

```
GET /sse/cases/{caseId}/command-center/stream
```

### Connection Behavior

| Aspect              | Detail                                             |
|---------------------|----------------------------------------------------|
| **Protocol**        | Server-Sent Events (EventSource API)               |
| **First event**     | `state-snapshot` — full agent status on connect     |
| **Heartbeat**       | Every 15s (`event: heartbeat`, `data: ping`)        |
| **Reconnection**    | Built-in via state-snapshot; EventSource auto-reconnects |
| **Headers**         | `X-Accel-Buffering: no`, `Cache-Control: no-cache`  |

### Connecting (TypeScript)

```typescript
const es = new EventSource(`/sse/cases/${caseId}/command-center/stream`);

es.addEventListener("state-snapshot", (e) => {
  const snapshot = JSON.parse(e.data);
  // Initialize agent state from snapshot.agents
});

es.addEventListener("agent-started", (e) => { /* ... */ });
es.addEventListener("agent-complete", (e) => { /* ... */ });
es.addEventListener("agent-error", (e) => { /* ... */ });
es.addEventListener("thinking-update", (e) => { /* ... */ });
es.addEventListener("processing-complete", (e) => { /* ... */ });
es.addEventListener("confirmation-required", (e) => { /* ... */ });
es.addEventListener("confirmation-resolved", (e) => { /* ... */ });
es.addEventListener("confirmation-batch-required", (e) => { /* ... */ });
es.addEventListener("confirmation-batch-resolved", (e) => { /* ... */ });
```

### File Status SSE (separate stream)

```
GET /sse/cases/{caseId}/files
```

Events: `file-uploaded`, `file-status`, `file-deleted`, `file-error`

---

## 3. SSE Event Reference

Every event payload includes a `type` field matching the event name.

### `state-snapshot`

Sent immediately on connect. Use for reconnection and initial render.

```jsonc
{
  "type": "state-snapshot",
  "agents": {
    "triage": {
      "status": "completed",     // "running" | "pending" | "completed" | "failed"
      "metadata": {
        "inputTokens": 12345,
        "outputTokens": 678,
        "durationMs": 4500,
        "startedAt": "2025-06-06T...",
        "completedAt": "2025-06-06T...",
        "model": "gemini-3-flash-preview",
        "thinkingTraces": "..."  // Newline-joined thinking text
      }
    },
    "orchestrator": { /* same shape */ },
    "financial_grp_0": { /* domain agents use compound IDs */ }
  }
}
```

### `agent-started`

An agent begins processing.

```jsonc
{
  "type": "agent-started",
  "agentType": "financial_grp_0",  // Compound ID for domain agents
  "taskId": "uuid",
  "fileId": "uuid",
  "fileName": "financial-grp_0"
}
```

**Agent type naming:**
- Pipeline agents: `"triage"`, `"orchestrator"`, `"strategy"`
- Domain agents: `"{type}_{groupLabel}"` e.g. `"financial_grp_0"`, `"legal_ungrouped_0"`

### `agent-complete`

An agent finished with results.

```jsonc
{
  "type": "agent-complete",
  "agentType": "financial_grp_0",
  "taskId": "uuid",
  "result": {
    "taskId": "uuid",
    "agentType": "financial_grp_0",
    "baseAgentType": "financial",      // Only on domain agents
    "groupLabel": "grp_0",            // Only on domain agents
    "outputs": [
      {
        "type": "financial-findings",  // "{agentType}-findings" or "triage-results" / "routing-decisions"
        "data": {
          "findingCount": 3,
          "entityCount": 5,
          "groupLabel": "grp_0"
        }
      }
    ],
    "metadata": {
      "inputTokens": 50000,
      "outputTokens": 2000,
      "durationMs": 12000,
      "startedAt": "...",
      "completedAt": "...",
      "model": "gemini-3-pro-preview",
      "thinkingTraces": "..."
    }
  }
}
```

**Triage-specific result:**
```jsonc
{ "type": "triage-results", "data": { "fileCount": 5, "groupings": 2 } }
```

**Orchestrator-specific result (includes routing decisions):**
```jsonc
{
  "type": "routing-decisions",
  "data": {
    "routingCount": 5,
    "parallelAgents": ["financial", "evidence"],
    "researchTriggered": false
  }
}
// Plus top-level `routingDecisions` array:
"routingDecisions": [
  {
    "fileId": "uuid",
    "targetAgent": "financial",
    "reason": "Contains transaction records...",
    "domainScore": 85.0
  }
]
```

### `agent-error`

An agent failed (non-fatal for domain agents; fatal for triage/orchestrator).

```jsonc
{
  "type": "agent-error",
  "agentType": "financial_grp_0",
  "taskId": "uuid",
  "error": "Financial agent (grp_0) failed to produce output"
}
```

### `thinking-update`

Real-time agent reasoning trace. Fires during model execution.

```jsonc
{
  "type": "thinking-update",
  "agentType": "orchestrator",
  "thought": "Analyzing domain scores... File report.pdf has high financial...",
  "timestamp": "2025-06-06T12:00:00Z",
  "tokenDelta": {           // Optional, per-turn
    "inputTokens": 1000,
    "outputTokens": 200,
    "thoughtsTokens": 500
  }
}
```

**Fallback variant** (when Pro model fails, agent switches to Flash):
```jsonc
{
  "type": "thinking-update",
  "agentType": "financial",
  "thought": "[FALLBACK] Agent switched to gemini-3-flash-preview",
  "isFallback": true,
  "fallbackModel": "gemini-3-flash-preview"
}
```

### `processing-complete`

Entire pipeline finished. Final event.

```jsonc
{
  "type": "processing-complete",
  "caseId": "uuid",
  "filesProcessed": 5,
  "entitiesCreated": 42,
  "relationshipsCreated": 0,    // Future: populated by KG Agent
  "totalDurationMs": 45000,
  "totalInputTokens": 150000,
  "totalOutputTokens": 8000
}
```

---

## 4. HITL Confirmation System

The pipeline pauses at two checkpoints for human review:

### 4a. Routing HITL (After Orchestrator)

When the orchestrator assigns files to agents with low confidence, the pipeline
requests human review. This happens in two tiers:

**Tier 1: Plan-Level Confirmation** (single `confirmation-required` event)

If any routing assignments are below per-agent confidence thresholds, the
backend sends a plan overview. User can approve-all (skip individual review)
or request individual review.

```jsonc
// SSE: confirmation-required
{
  "type": "confirmation-required",
  "agentType": "orchestrator",
  "taskId": "uuid",                    // This is the requestId
  "actionDescription": "Routing plan ready. 3 agent assignment(s) flagged for review. Approve all or review individually?",
  "context": {
    "affectedItems": ["report.pdf -> financial", "contract.pdf -> legal", "report.pdf -> legal"],
    "total_decisions": 5,
    "flagged_count": 3,
    "flagged_pairs": [
      { "file_name": "report.pdf", "agent": "financial", "confidence": 45, "threshold": 50 },
      { "file_name": "contract.pdf", "agent": "legal", "confidence": 42, "threshold": 50 },
      { "file_name": "report.pdf", "agent": "legal", "confidence": 38, "threshold": 50 }
    ],
    "routing_summary": "Complex multi-domain case..."
  }
}
```

**Responding:**
```
POST /api/cases/{caseId}/confirmations/{requestId}
{ "approved": true }     // Approve all, skip individual review
{ "approved": false }    // Proceed to individual per-agent review
```

**Tier 2: Batch Per-Agent Confirmation** (single `confirmation-batch-required` event)

If the user rejects Tier 1 (wants individual review), the backend sends ONE
batch event containing ALL flagged (file, agent) pairs. The frontend renders
a single multi-item dialog where the user can approve/reject each pair
independently.

```jsonc
// SSE: confirmation-batch-required
{
  "type": "confirmation-batch-required",
  "agentType": "orchestrator",
  "batchId": "uuid",
  "items": [
    {
      "item_id": "uuid-1",
      "action_description": "Deploy financial agent on 'report.pdf'? (confidence: 45/100)",
      "affected_items": ["file-uuid-1"],
      "context": {
        "file_id": "file-uuid-1",
        "file_name": "report.pdf",
        "agent_under_review": "financial",
        "all_target_agents": ["financial", "evidence"],
        "routing_confidence": 45,
        "hitl_threshold": 50,
        "reasoning": "Contains financial figures but unclear if substantive...",
        "domain_scores": { "financial": 45, "legal": 20, "strategy": 10, "evidence": 60 }
      }
    },
    {
      "item_id": "uuid-2",
      "action_description": "Deploy legal agent on 'contract.pdf'? (confidence: 42/100)",
      // ... same shape
    }
  ],
  "context": {
    "routing_summary": "Complex multi-domain case..."
  }
}
```

**Responding (one request for all items):**
```
POST /api/cases/{caseId}/confirmations/batch/{batchId}
{
  "decisions": [
    { "item_id": "uuid-1", "approved": false, "reason": "Not relevant" },
    { "item_id": "uuid-2", "approved": true }
  ]
}
```

**Response:** `{ "status": "resolved", "resolved_count": 2 }`

**Key behavior**: Rejecting `financial` on `report.pdf` does NOT affect
`evidence` routing on the same file. Per-agent granularity.

### 4b. Findings HITL (After Domain/Strategy Agents)

Low-confidence findings trigger individual confirmations (single
`confirmation-required` events, not batched). These are sequential since
each finding is independent.

```jsonc
// SSE: confirmation-required
{
  "type": "confirmation-required",
  "agentType": "financial",
  "taskId": "uuid",
  "actionDescription": "Low-confidence finding (35/100): Suspicious wire transfer pattern",
  "context": {
    "affectedItems": ["file-uuid-1"],
    "finding_title": "Suspicious wire transfer pattern",
    "finding_category": "anomaly",
    "finding_description": "Multiple wire transfers to offshore accounts...",
    "confidence": 35,
    "agent": "financial",
    "group_label": "grp_0"
  }
}
```

### 4c. Strategy Standalone HITL

When domain agents fail but strategy files exist, the pipeline asks whether
to run strategy standalone:

```jsonc
{
  "type": "confirmation-required",
  "agentType": "strategy",
  "taskId": "uuid",
  "actionDescription": "Domain agents were routed but produced no results. Run strategy agent standalone with 3 file(s)?",
  "context": {
    "affectedItems": ["uuid-1", "uuid-2", "uuid-3"],
    "strategy_file_count": 3,
    "strategy_file_names": ["memo.pdf", "plan.docx", "email.eml"],
    "domain_agents_expected": true
  }
}
```

### 4d. Per-Agent Confidence Thresholds

Different agent types have different sensitivity. These control when HITL
fires during routing:

| Agent Type  | Threshold | Meaning                                      |
|-------------|-----------|----------------------------------------------|
| Financial   | 50        | Flags routing below 50 confidence            |
| Legal       | 50        | Flags routing below 50 confidence            |
| Strategy    | 40        | Flags routing below 40 confidence            |
| Evidence    | 20        | Rarely flagged (evidence scrutiny is low-cost)|

### 4e. Polling Fallback

If the SSE connection drops, use the REST endpoint to catch up:

```
GET /api/cases/{caseId}/confirmations/pending
```

Returns all currently pending confirmations (both single and batch are stored
server-side). Re-render any pending confirmation dialogs.

---

## 5. REST API Reference

### Analysis

| Method | Path                                        | Purpose                    |
|--------|---------------------------------------------|----------------------------|
| POST   | `/api/cases/{caseId}/analyze`               | Start analysis workflow     |
| GET    | `/api/cases/{caseId}/analysis/{workflowId}` | Get workflow status         |

### Confirmations

| Method | Path                                                       | Purpose                           |
|--------|------------------------------------------------------------|-----------------------------------|
| POST   | `/api/cases/{caseId}/confirmations/{requestId}`            | Respond to single confirmation    |
| POST   | `/api/cases/{caseId}/confirmations/batch/{batchId}`        | Respond to batch confirmation     |
| GET    | `/api/cases/{caseId}/confirmations/pending`                | List all pending confirmations    |

### Single Confirmation Request/Response

```typescript
// Request body
{ approved: boolean; reason?: string }

// Response
{ status: "resolved"; approved: boolean }
```

### Batch Confirmation Request/Response

```typescript
// Request body
{
  decisions: Array<{
    item_id: string;
    approved: boolean;
    reason?: string;
  }>
}

// Response
{ status: "resolved"; resolved_count: number }
```

---

## 6. Agent Data Models

### What Each Agent Produces

All agents store their structured output in the database as
`AgentExecution.output_data`. The `GET /analysis/{workflowId}` endpoint returns
triage and orchestrator outputs directly. Domain agent outputs are summarized
in `domain_results_summary`.

#### Triage Agent

Per-file analysis with domain scores, entities, and complexity.

```typescript
interface TriageOutput {
  file_results: Array<{
    file_id: string;
    filename: string;
    summary: string;
    entities: Array<{ name: string; type: string; context: string }>;
    domain_scores: {
      financial: number;  // 0-100
      legal: number;
      strategy: number;
      evidence: number;
    };
    complexity: "low" | "medium" | "high";
    confidence: number;  // 0-1
  }>;
  suggested_groupings: Array<{
    group_id: string;
    file_ids: string[];
    rationale: string;
  }>;
}
```

#### Orchestrator Agent

Routing decisions with confidence scores and file groupings.

```typescript
interface OrchestratorOutput {
  routing_decisions: Array<{
    file_id: string;
    file_name: string;
    target_agents: string[];        // ["financial", "evidence"]
    reasoning: string;
    priority: "low" | "medium" | "high";
    domain_scores: { financial: number; legal: number; strategy: number; evidence: number };
    context_injection: string | null;  // Case-specific framing injected into agent prompts
    routing_confidence: number;        // 0-100, drives HITL thresholds
  }>;
  file_groups: Array<{
    group_id: string;
    file_ids: string[];
    target_agents: string[];
    shared_context: string;
  }>;
  parallel_agents: string[];
  sequential_agents: string[];
  research_trigger: {
    should_trigger: boolean;
    reason: string;
    research_queries: string[];
  };
  overall_complexity: "low" | "medium" | "high";
  routing_summary: string;
  warnings: string[];
}
```

#### Domain Agents (Financial / Legal / Evidence)

All three share a common output shape with findings and entities:

```typescript
interface DomainOutput {
  findings: Array<{
    title: string;
    description: string;
    category: string;          // e.g. "anomaly", "obligation", "chain_of_custody"
    confidence: number;        // 0-100, below 40 triggers HITL
    severity: "low" | "medium" | "high" | "critical";
    citations: Array<{
      file_id: string;
      excerpt: string;
      page_or_location: string;
    }>;
  }>;
  entities: Array<{
    name: string;
    type: string;              // "person", "organization", "account", "document"
    attributes: Record<string, string>;
    source_file_id: string;
  }>;
  no_findings_explanation: string;  // Populated when findings array is empty
}
```

Evidence agent adds:
```typescript
interface EvidenceOutput extends DomainOutput {
  quality_assessment: {
    overall_score: number;
    recommendation: string;
    corroboration_notes: string;
  };
}
```

#### Strategy Agent

```typescript
interface StrategyOutput {
  findings: Array<Finding>;  // Same Finding shape as domain agents
  entities: Array<Entity>;
}
```

---

## 7. Suggested UI Patterns

### Command Center Layout

The Command Center should visualize the pipeline as a directed graph with
real-time status updates:

```
[Triage] ---> [Orchestrator] ---> [Financial]  \
                              \-> [Legal]       --> [Strategy] --> Done
                              \-> [Evidence]   /
```

- Each node transitions: `pending` -> `running` -> `completed`/`failed`
- `thinking-update` events feed a live reasoning trace panel per agent
- `agent-complete` metadata populates token/duration stats per node
- `agent-error` turns the node red; `isFallback` adds a warning badge

### HITL Dialog Patterns

**Routing Plan (Tier 1):** Modal with summary text and two buttons:
"Approve All" / "Review Individually"

**Batch Per-Agent Review (Tier 2):** Table/list inside a modal:

```
+------------------------------------------------------------+
| Review Routing Decisions                                    |
|------------------------------------------------------------|
| [ ] Deploy financial on report.pdf   (45/100)   [Approve]  |
|     "Contains financial figures but..."           [Reject]  |
|                                                             |
| [ ] Deploy legal on contract.pdf     (42/100)   [Approve]  |
|     "References legal concepts..."               [Reject]  |
+------------------------------------------------------------+
|                            [Submit All Decisions]           |
+------------------------------------------------------------+
```

Each row shows: agent type, file name, confidence score, reasoning excerpt,
and approve/reject toggle. Submit sends one POST to the batch endpoint.

**Finding Review:** Simpler single-item dialog for each low-confidence finding.
Show title, description excerpt, confidence, and approve/reject.

### Notification Badge

Use `GET /confirmations/pending` count for a badge on the Command Center tab
when confirmations are waiting.

### Token Usage Panel

`processing-complete` provides aggregate stats. Per-agent metadata from
`agent-complete` events allows a breakdown table:

```
Agent         | Model   | Input Tokens | Output Tokens | Duration
-------------------------------------------------------------------
triage        | Flash   | 12,345       | 678           | 4.5s
orchestrator  | Pro     | 8,200        | 1,200         | 6.2s
financial_0   | Pro     | 50,000       | 2,000         | 12.0s
evidence_0    | Flash*  | 45,000       | 1,800         | 8.3s
strategy      | Pro     | 5,000        | 3,000         | 15.1s
-------------------------------------------------------------------
Total                   | 120,545      | 8,678         | 46.1s

* = fallback model used
```
