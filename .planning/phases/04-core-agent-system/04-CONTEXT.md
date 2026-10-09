# Phase 4: Core Agent System - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Google ADK infrastructure and implement the first two agents: Triage Agent and Orchestrator Agent. This includes the agent factory pattern, state management, callback-to-SSE mapping, and the foundation for all subsequent agent work. Domain agents (Financial, Legal, Strategy, Evidence), Research/Discovery agents, and Synthesis are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Triage Behavior
- **Trigger:** Batch after uploads — user uploads files, then explicitly starts analysis for all files at once
- **Domain scoring:** Confidence percentages (0-100) per domain, enabling weighted routing
- **Entity extraction:** Intermediate but quick entities extraction — names, organizations, dates, locations, legal terms (whatever can be used by the orchestrator to do a smarter routing and subagent assignment)
- **Summaries:** Both short (1-2 sentences for list view) and detailed (paragraph, available on expand). Orchestrator gets detailed.
- **Complexity assessment:** Hybrid approach combining:
  - Simple tier (Low/Medium/High) per file
  - Exact token count from ADK `usage_metadata` on events (VERIFIED: prompt_token_count, candidates_token_count, total_token_count)
  - Enables Orchestrator to make token-budget-aware batching and routing decisions
- **Thinking level:** HIGH for all agents per user preference (using BuiltInPlanner with ThinkingConfig)
- **Contradiction/gap detection:** Leave to Synthesis Agent — Triage stays simple
- **File groupings:** Yes, suggest groupings (e.g., "these 3 files relate to same transaction") for Orchestrator batching
- **Corrupted files:** Partial extraction — extract whatever possible, mark confidence as low

### Orchestrator Routing
- **Agent invocation:** Hybrid — parallel for primary domains, sequential for edge cases
  - Orchestrator has freedom to determine where to sequentialize
  - Robust system prompt with tight guardrails to prevent unnecessary subagent spawning
  - Well-justified reasons allow spawning agents as needed
- **Domain threshold:** Dynamic — Orchestrator decides based on case complexity and file types
- **User confirmation:** No confirmation needed — fully autonomous routing
- **Research/Discovery triggers:** Autonomous — Orchestrator triggers research automatically when gaps detected
- **Routing log:** Yes, detailed reasoning — store and display why each routing decision was made
- **File groupings:** Pass groups to agents — domain agents receive file groups together for context
- **Concurrent limit:** No limit — spawn as many parallel agents as routing logic dictates
- **Mid-analysis uploads:** Queue new files — continue current analysis, new files wait for next batch

### Agent Lifecycle Events
- **Thinking trace granularity:** Batched (every few seconds) — aggregate thoughts, send periodically
- **SSE events:** Middle ground — SPAWNED, TOOL_CALLED, COMPLETED, ERROR
- **Token metrics:** Yes, per-agent usage — include input/output tokens for cost visibility
- **Progress indication:** Stage-based — show current stage (e.g., "Extracting entities")
- **Execution timing:** Yes, per-agent timing — track start/end time for each agent
- **Model display:** Yes, show model — display Flash vs Pro in Agent Flow for transparency
- **Execution logging:** Full execution log — store complete inputs, outputs, traces, timing (audit trail)
- **History replay:** No — Agent Flow shows live execution only, no history view

### Error Handling & Fallbacks
- **Primary fallback:** Both (retry then fallback) — retry same model once, then try simpler model (Pro → Flash)
- **Retry count:** 1 retry before moving to fallback — quick fail to fallback for faster recovery
- **Error display:** Inline in Agent Flow — error appears on failed agent node with details
- **Parallel agent failure:** Continue others — graceful degradation, show partial results
- **Manual retry:** Yes, retry button — user can retry failed agent, results aggregated by Synthesis
- **Rate limiting (429):** Queue and notify — queue the request, notify user of delay
- **Partial results:** Save partial if no retry; discard and replace if retry succeeds (Last Write Wins)
- **Error details:** Technical details available — simple message by default, expandable for technical info

### Claude's Discretion
- Specific SSE event payload structure
- Internal state management implementation details
- Exact retry timing and backoff intervals
- Agent factory implementation pattern specifics
- Database schema for execution logging

</decisions>

<specifics>
## Specific Ideas

- Orchestrator should have tight guardrails in system prompt but freedom to spawn agents when well-justified
- "Last Write Wins" for partial results — if retry succeeds, fresh results replace partial ones
- User sees per-agent token usage for cost transparency (important for understanding API costs)
- Stage-based progress is more honest than fake percentages

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

<verification_notes>
## Verification Notes (Added 2026-02-03)

### Model IDs Verified ✅
Cross-referenced against https://ai.google.dev/gemini-api/docs/gemini-3:
- `gemini-3-flash-preview` - Correct
- `gemini-3-pro-preview` - Correct
- Pricing: Flash $0.50/$3 per 1M tokens, Pro $2/$12 per 1M tokens
- Context: 1M input / 64k output for both

### Thinking Configuration ✅
- Using `thinking_level` (correct for Gemini 3)
- NOT using `thinking_budget` (that's for Gemini 2.5)
- Using HIGH level for ALL agents per user preference
- Implemented via `BuiltInPlanner` with `ThinkingConfig` (ADK best practice)

### Model IDs Configurable ✅
- `GEMINI_FLASH_MODEL` env var with default `gemini-3-flash-preview`
- `GEMINI_PRO_MODEL` env var with default `gemini-3-pro-preview`

### API Key Configuration ✅
- ADK uses `GOOGLE_API_KEY` (NOT `GEMINI_API_KEY`)
- Config field: `google_api_key` with env `GOOGLE_API_KEY`
- Optional: `use_vertex_ai` for Vertex AI backend (default: False)

### File Handling: Tiered (Inline + File API) ✅
- ≤100MB: Download from GCS, encode as `inline_data` (fast, simple)
- >100MB–2GB: Upload to Gemini File API, get URI reference (48hr retention, free)
- File API works universally with API key auth, no Vertex AI needed
- `media_resolution` parameter controls token budget per modality:
  - Triage: `medium` (speed priority)
  - Domain agents: `high` (detail priority)
  - Evidence Agent: `high` (forensic analysis)
- Multimodal evidence types: PDF, video (MP4), audio (MP3/WAV), images (JPG/PNG)
- Video: 263 tokens/sec, Audio: 32 tokens/sec, Image (high): 1,120 tokens
- Heavy files (approaching 1M context): single-file-per-invocation pattern

### Session Management: Stage-Isolated ✅
- One FRESH session per pipeline STAGE (not per workflow)
- Session ID: SHA-256 hash of `case_id:workflow_id:stage` (64 chars)
- Idempotent creation: get_or_create pattern
- Inter-stage data flows via DATABASE (agent_executions table)
- Intra-stage data uses ADK `output_key` and `{key}` template injection
- Stage isolation prevents multimodal file content from bloating downstream agent contexts
- Each agent gets full 1M context window dedicated to its task

### Context Management ✅
- Pipeline workflow: NO compaction needed (each stage = single invocation)
- Compaction reserved for future CHAT agent (iterative conversation)
- Context caching (`ContextCacheConfig`) for File API URIs reused across agents
- AgentTool pattern for context-isolated sub-tasks (Research/Discovery)

### Regional Configuration ✅
- Location: `europe-west3` (not us-central1)
- Env var: `GOOGLE_CLOUD_LOCATION=europe-west3`

### Reference Architecture Aligned ✅
- Adapted from hierarchical-workflow-automation (adk-samples) and context engineering blog
- Stage-isolated invocations (our code orchestrates stages, NOT a single SequentialAgent)
- ParallelAgent used WITHIN Stage 3 for concurrent domain agents
- AgentTool for context-isolated sub-tasks (Research/Discovery)
- `output_key` for intra-stage state passing
- Database for inter-stage data flow (agent_executions table)
- Context caching for files shared across multiple agents

</verification_notes>

---

*Phase: 04-core-agent-system*
*Context gathered: 2026-02-02*
*Verified: 2026-02-03*
