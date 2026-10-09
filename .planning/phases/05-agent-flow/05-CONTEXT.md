# Phase 5: Agent Flow - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time visualization of agent execution with full transparency. The frontend (ReactFlow decision tree, sidebar, SSE hook, mock data) is complete from Phase 4.1. This phase delivers the backend SSE streaming of real agent data, thinking traces integration, token usage display, execution timeline, and human-in-the-loop confirmation dialogs. No new frontend visualization components — this connects real data to the existing UI.

</domain>

<decisions>
## Implementation Decisions

### Thinking traces display
- Stream thinking traces live in real-time as agents think (not after completion)
- Display in the NodeDetailsSidebar when an agent node is clicked — dedicated scrolling section
- Show full unfiltered thinking output from Gemini (no summarization or truncation on the frontend)
- Thinking section is collapsible — expanded by default while agent is active, user can collapse

### SSE event granularity
- Coarse milestone events for agent lifecycle: spawned, processing, completed/failed
- Thinking traces are a separate SSE event type (THINKING_UPDATE) — independent from lifecycle events
- Dedicated AGENT_ERROR event with error message, stack trace summary, and which agent failed
- Heartbeat every 15-30s; frontend shows Connected/Reconnecting/Disconnected indicator
- Explicit PIPELINE_COMPLETE event with summary stats (total agents, duration, tokens used)
- Include file routing data in SSE events — which files routed to which agents, so FileRoutingEdge populates dynamically
- No pipeline progress percentage — user infers progress from individual agent node states on the tree
- On reconnect: backend sends full state snapshot of all agents' current status (no sequence-based replay)

### HITL confirmation UX
- Confirmation required only for sensitive/destructive agent actions (modifying entities, merging duplicates, external API calls) — not for routing decisions
- Modal dialog: centered overlay with context about what the agent wants to do, Approve/Reject buttons, optional reason field
- Agent waits indefinitely for user response — no timeout, pipeline stays paused
- Visual notification badge/pulse on Command Center tab/nav item when confirmation is pending and user is on another page

### Token usage & timing
- Per-agent token breakdown: each agent shows input/output token counts; total shown at pipeline level
- Raw token counts only — no estimated dollar cost
- Duration badge on each agent node (e.g., "3.2s") plus detailed timing in sidebar with start/end times
- Gantt-style execution timeline in sidebar showing agent execution overlap to visualize parallelism

### Claude's Discretion
- Exact heartbeat interval (within 15-30s range)
- AGENT_ERROR event payload structure and stack trace formatting
- Modal dialog styling and layout
- Notification badge implementation (pulse animation, badge count, etc.)
- Gantt timeline visual design and interaction
- Duration badge placement and styling on DecisionNode

</decisions>

<specifics>
## Specific Ideas

- Thinking traces should feel like watching the agent reason in real-time — a live feed, not a log dump
- The execution timeline (Gantt chart) should clearly show which agents ran in parallel vs sequentially
- HITL modal should give enough context that the user can make an informed decision without needing to leave the dialog

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-agent-flow*
*Context gathered: 2026-02-04*
