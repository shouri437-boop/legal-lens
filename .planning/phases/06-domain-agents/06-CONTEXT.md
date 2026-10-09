# Phase 6: Domain Agents - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement four domain analysis agents (Financial, Legal, Legal Strategy, Evidence) that process case files routed by the Orchestrator. Each agent extracts domain-specific findings with entity taxonomy, evaluates existing hypotheses, and outputs structured results with span-level citations. Legal Strategy agent runs after evidence-analysis agents and has inter-agent communication needs (deferred to Phase 7). HITL confirmation flow for low-confidence findings verified end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Agent output structure
- **Extraction depth is configurable** — a code/config toggle switches between "dense & comprehensive" (maximize graph richness) and "curated & high-signal" (confidence-threshold filter). Both modes available for tuning.
- **Findings categorized per domain** — each agent groups findings into domain-relevant categories (e.g., Financial: Transactions, Account Relationships, Anomalies), not a flat list.
- **Hypothesis evaluation only** — domain agents evaluate existing hypotheses against their findings. They do NOT propose new hypotheses; that's user/synthesis territory.
- **Span-level citation precision** — exact page number, paragraph, timestamp, or image region. Click navigates to exact spot in source viewer (Phase 10).
- **Confidence scores are agent self-assessed** — each agent outputs its own confidence (0-100) per finding based on evidence strength.
- **Entity taxonomy with overflow** — predefined types per domain are primary, but agents can flag "other" entities outside their taxonomy for review. Catches surprises without breaking schema.
- **Agents are independent (no cross-awareness)** — each agent analyzes in isolation. Cross-referencing happens in Synthesis (Phase 7).
- **Evidence agent: single composite quality score** per file (not a breakdown of authenticity/completeness/reliability).
- **Explicit "no findings" records** — when an agent finds nothing relevant in a file, log that it ran and found nothing. Confirms analysis completeness.

### Processing behavior
- **Full video to agent** — send entire video; agent decides what's relevant. Simpler pipeline.
- **Fallback visible in Command Center** — when ResilientAgentWrapper falls back from Pro to Flash, show a warning badge on the agent node so user knows quality may differ.
- **Speaker diarization requested** for audio — prompt agents to identify speakers (critical for depositions, calls). Gemini may or may not succeed; best-effort.
- **Full file to each routed agent** — when a file is multi-domain, every routed agent gets the complete file and extracts their domain's findings.
- **media_resolution="high" for documents, standard for photos** — dense scanned docs get high resolution; regular photos get standard. Triage file type informs the choice.
- **No token budget limit** — process completely; thoroughness over cost. Rely on model selection (Flash fallback) for cost control.

### Strategy agent (Legal Strategy)
- **NOT an evidence analysis agent** — it handles legal strategy for the case: firm playbooks, internal strategy docs, and case approach planning.
- **Runs AFTER domain agents** (Financial, Legal, Evidence) — not in the parallel batch. It can incorporate their findings.
- **Inter-agent communication needed** — Strategy agent should be able to query other agents for domain-specific info. Research the optimal ADK pattern (direct delegation, Synthesis as proxy, or tool-based communication). **Communication wiring deferred to Phase 7** when Synthesis is built.
- **Orchestrator provides agent routing info** — when invoking Legal Strategy, orchestrator tells it which agents were invoked and for what, so it knows where to request information.

### Orchestrator routing
- **File-group based spawning** — orchestrator groups related files via `file_groups` (already in OrchestratorOutput schema). Domain runner spawns one agent instance PER (group, agent_type) pair, not one per agent type. E.g., if orchestrator creates 2 financial groups, 2 separate Financial agent instances run concurrently with different file subsets and group-specific context. Fallback: when files aren't explicitly grouped, each file-to-agent routing becomes an implicit single-file group.
- **Context injection per routing decision** — add `context_injection: str | None` to `RoutingDecision` schema. Orchestrator provides case-specific framing per file (e.g., "This is a patent infringement case. Focus on claims mapping."). This context is prepended to the agent's user message, adapting the fixed agent prompts to the specific case without requiring custom agent types. `FileGroupForProcessing.shared_context` serves as context injection for grouped files.
- **Dynamic reasoning for routing** — no fixed threshold. Orchestrator uses LLM judgment to decide which agents are worth running per file. Consistent with Phase 4 decision.
- **True parallel execution** for all agent instances via asyncio.gather (NOT ADK ParallelAgent). Legal Strategy runs as a separate stage after them.
- **Batch-then-route** for multi-file uploads — triage all files first, then orchestrator makes holistic routing decisions across the batch.
- **Raw file only to domain agents** — no triage summary passed. Domain agents analyze from scratch for independent assessment.
- **Continue with partial results on failure** — if a domain agent fails entirely (even after Flash fallback), other agents' findings are still valuable. Mark the failed agent and continue.
- **Legal Strategy inter-agent communication deferred to Phase 7** — build its analysis capabilities now, add inter-agent querying when Synthesis exists.

### HITL confirmation triggers
- **Triggered by low-confidence findings** — when an agent's self-assessed confidence is below threshold, finding requires user confirmation before entering KG.
- **Configurable threshold in code config** — default: below 40 (out of 100). Adjustable per deployment, not via UI.
- **Modal shows finding + full reasoning** — the confirmation panel displays the finding, source evidence excerpt, confidence score, AND the agent's thinking trace for why it's uncertain. Maximum transparency.
- **Rejected findings kept as audit trail** — user-rejected findings are logged as rejected but preserved in history. Never shows in KG but exists for investigation integrity.
- **Agent waits (blocking)** — the specific agent pauses until user responds. Other parallel agents continue. Consistent with Phase 5 asyncio.Event infra.
- **Batched review list** — low-confidence findings queue up; user reviews them as a list with batch approval capability.
- **Dedicated panel** for confirmation review — not in the sidebar. Accessible from a badge/notification in the Command Center.

### Claude's Discretion
- Exact domain-specific category names per agent (Financial categories, Legal categories, Evidence categories)
- Output schema structure (Pydantic models per agent)
- ResilientAgentWrapper implementation details (retry count, timeout)
- ADK ParallelAgent configuration specifics
- Prompt engineering for each domain agent
- How "other" overflow entities are structured in the schema
- Specific thinking_level per agent (roadmap suggests medium/high — Claude can adjust)

</decisions>

<specifics>
## Specific Ideas

- "The Strategy agent is actually a Legal Strategy agent — it handles legal strategy for the case, firm playbooks, and case approach. NOT evidence analysis."
- "Strategy agent should communicate with other agents and get specific info related to topics they are experts in. Maybe via Synthesis as proxy that passes requests down to domain agents."
- "Must research the most optimal inter-agent communication pattern from official ADK docs and Gemini 3 docs"
- Extraction depth toggle should be easy to switch in code/config for testing both dense vs curated approaches during development

</specifics>

<deferred>
## Deferred Ideas

- **Inter-agent communication wiring** — Legal Strategy agent querying other agents via Synthesis as proxy → Phase 7 (Synthesis & Knowledge Graph)
- **New hypothesis proposal by agents** — kept as evaluate-only for now; proposal could be added in Phase 7 or 11

</deferred>

---

*Phase: 06-domain-agents*
*Context gathered: 2026-02-05*
