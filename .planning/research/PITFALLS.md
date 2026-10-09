# Domain Pitfalls: Legal Intelligence Platform with Multi-Agent AI

**Domain:** Legal intelligence, multimodal evidence processing, multi-agent orchestration
**Researched:** 2026-01-18 (Updated: 2026-01-21 with integration features)
**Confidence:** HIGH (verified through multiple authoritative sources)

---

## Critical Pitfalls

Mistakes that cause architectural rewrites, legal/ethical liability, or complete project failure.

---

### Pitfall 1: LLM Hallucination in Legal Context

**Severity:** CRITICAL

**What goes wrong:** LLMs generate fabricated case citations, incorrect legal precedents, or unsupported factual claims. In legal contexts, this has led to court sanctions (Morgan & Morgan 2025, Mata v. Avianca 2023).

**Why it happens:**
- General-purpose LLMs hallucinate 58-88% on verifiable legal questions
- Even purpose-built legal RAG tools hallucinate 17-34% of the time
- Models are unfaithful to training data, prompt input, or real-world facts
- Probabilistic text generation creates well-formatted but fictitious citations

**Consequences:**
- Professional sanctions for attorneys
- Liability for incorrect legal advice
- Complete loss of user trust
- Potential regulatory action

**Warning Signs:**
- Citations that cannot be verified in legal databases
- Confident statements without source attribution
- Answers that "feel right" but lack grounding
- No span-level verification in place

**Prevention:**
1. **Multi-agent validation:** Implement a dedicated "Verifier Agent" that cross-checks all claims against retrieved sources (reduces critical errors by 82% per research)
2. **Span-level verification:** Each generated claim must be matched against retrieved evidence and flagged if unsupported
3. **Citation verification pipeline:** Automated checks against legal databases before any output reaches users
4. **Human-in-the-loop:** Require human lawyer sign-off for any legal conclusions
5. **Confidence scoring:** Display confidence levels prominently; refuse to answer when confidence is below threshold

**Phase Mapping:**
- Phase 1 (Core Infrastructure): Build verification architecture from day one
- Phase 2 (Agent System): Implement Verifier Agent as mandatory pipeline stage
- Ongoing: Never skip verification "to ship faster"

**Sources:**
- [Stanford Legal RAG Hallucinations Study](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf)
- [LLM Agents in Law: Taxonomy, Applications, and Challenges](https://arxiv.org/html/2601.06216)

---

### Pitfall 2: Multi-Agent System Failure Modes

**Severity:** CRITICAL

**What goes wrong:** Multi-agent systems fail 41-86.7% of the time across state-of-the-art implementations. Failure modes include inter-agent misalignment, task verification gaps, and specification under-definition.

**Why it happens:**
- Under-specification accounts for 15% of breakdowns
- No single agent responsible for overall correctness
- Agents duplicate effort or override each other without clear boundaries
- Poor stop conditions cause infinite loops
- Emergent behaviors: agents recursively validate incorrect conclusions

**Consequences:**
- Workflows produce incorrect outputs that go unchecked
- Resource exhaustion from runaway agents
- Conflicting agent outputs confuse users
- System appears to work in testing but fails in production

**Warning Signs:**
- Agents continuing to "reason" after goals are reached
- Multiple agents assuming similar roles
- No clear orchestrator or referee pattern
- State collisions in shared memory

**Prevention:**
1. **Clear agent boundaries:** Define functional responsibilities explicitly; no overlapping roles
2. **Orchestrator pattern:** Use a dedicated orchestrator agent that controls workflow and validates completion
3. **Task verification agent:** Implement a "referee" agent that validates outputs before returning to user
4. **Deterministic workflows:** Use SequentialAgent for ordered tasks; avoid relying on prompts for ordering
5. **State namespacing:** Prefix session state keys (e.g., `task:{run_id}:{agent_name}`) to prevent collisions
6. **Stop conditions:** Define explicit termination criteria for each workflow

**Phase Mapping:**
- Phase 1 (Architecture): Design agent topology with clear boundaries
- Phase 2 (Agent System): Implement orchestrator + verifier pattern from start
- Phase 3 (Integration): Test multi-agent workflows extensively before production

**Sources:**
- [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657)
- [10 Multi-Agent Coordination Strategies](https://galileo.ai/blog/multi-agent-coordination-strategies)

---

### Pitfall 3: Google ADK Production Limitations

**Severity:** CRITICAL

**What goes wrong:** Google ADK has specific architectural constraints that break common patterns. Single parent rule violations, built-in tool limitations, and multi-user support gaps cause production failures.

**Why it happens:**
- Agent instances can only be added as sub-agent once (ValueError if second parent attempted)
- Built-in tools cannot be used within sub-agents (except GoogleSearchTool, VertexAiSearchTool)
- Root Agent fully transfers control to sub-agent, preventing multi-step orchestration
- ADK assumes shared root agent across users; multi-user requires custom architecture
- Web UI debugging tools break with custom per-user agents

**Consequences:**
- Architecture that works in tutorials fails in production
- Loss of debugging capabilities when implementing proper user isolation
- Unexpected ValueErrors in production
- Inability to orchestrate multi-step workflows without workarounds

**Warning Signs:**
- Attempting to reuse agent instances across workflows
- Using built-in tools in sub-agents
- Relying on Root Agent to orchestrate multi-step tasks
- Single shared agent for all users

**Prevention:**
1. **Fresh Worker instances:** Always create new agent instances for each ParallelAgent
2. **Workflow Agents for determinism:** Use SequentialAgent instead of prompt-based ordering
3. **Per-user agent factory:** Build custom agent creation per user session from the start
4. **Avoid built-in tools in sub-agents:** Use GoogleSearchTool/VertexAiSearchTool only, or implement custom tool wrappers
5. **State key namespacing:** Prefix all session.state keys to avoid race conditions in ParallelAgent
6. **Plan for ADK immaturity:** Have backup plans for mission-critical features

**Phase Mapping:**
- Phase 1 (Architecture): Design ADK-compatible topology upfront
- Phase 2 (Agent System): Implement per-user agent isolation from start
- All phases: Test thoroughly in production-like environment, not just ADK Web UI

**Sources:**
- [Multi-Agent Systems in ADK](https://google.github.io/adk-docs/agents/multi-agents/)
- [4 Google ADK Production Challenges and How to Solve Them](https://dlabs.ai/blog/google-adk-production-challenges-and-how-to-solve-them/)
- [Tool limitations - Agent Development Kit](https://google.github.io/adk-docs/tools/limitations/)

---

### Pitfall 4: Citation and Source Attribution Failures

**Severity:** CRITICAL

**What goes wrong:** RAG systems achieve only ~74% citation accuracy. Around 80% of unverifiable facts are not pure hallucinations but errors in citing the correct reference.

**Why it happens:**
- Models generate text, then struggle to attribute sources correctly
- Cannot trust LLM to return exact quotes (may hallucinate quotes)
- 30-50% of individual statements are unsupported by cited sources
- Focus on response quality, overlooking attribution accuracy

**Consequences:**
- Users cannot verify claims against sources
- Legal professionals cannot cite AI findings in court
- False confidence from "cited" but unsupported statements
- Professional liability when cited sources don't support claims

**Warning Signs:**
- Citations that don't match page numbers or sections
- "Supported" claims that don't appear in cited text
- General citations to documents without specific locations
- No span-level source matching

**Prevention:**
1. **Post-processing citation correction:** Implement lexical + semantic matching to verify citations
2. **Span-level attribution:** Map each claim to exact text spans in source documents
3. **Grounded vs Misgrounded categorization:** Track citation accuracy metrics
4. **Source verification agent:** Dedicated agent that validates every citation before output
5. **Quote extraction, not generation:** Extract exact text from sources rather than asking LLM to quote
6. **User-visible source linking:** Show users the exact source text alongside claims

**Phase Mapping:**
- Phase 2 (RAG Pipeline): Build citation verification into retrieval pipeline
- Phase 3 (Evidence Processing): Implement span-level extraction for all document types
- Phase 4 (Knowledge Graph): Store claim-to-source mappings as first-class entities

**Sources:**
- [CiteFix: Enhancing RAG Accuracy Through Post-Processing Citation Correction](https://arxiv.org/html/2504.15629v2)
- [Automated Framework for Assessing LLM Citation Accuracy](https://www.nature.com/articles/s41467-025-58551-6)

---

## High Severity Pitfalls

Mistakes that cause significant delays, performance issues, or require major refactoring.

---

### Pitfall 5: SSE Streaming Failures in Production

**Severity:** HIGH

**What goes wrong:** SSE works locally but fails in production due to proxy buffering, browser connection limits, and cloud infrastructure interference.

**Why it happens:**
- Any proxy in the chain can legally buffer Transfer-Encoding chunks
- HTTP/1.1 limits to 6 concurrent connections per browser+domain
- Cloud load balancers enforce idle timeouts (typically 4 minutes)
- IIS on Windows buffers responses by default
- Nginx defaults to HTTP/1.0 for upstream connections

**Consequences:**
- Real-time agent visualization appears frozen
- Events arrive in batches instead of streaming
- Connections drop unexpectedly mid-workflow
- Works in development, breaks in production

**Warning Signs:**
- Events arriving in bursts after long delays
- Connection drops after consistent intervals (timeout-related)
- Works in Chrome, fails in corporate environments (proxy issues)
- Maximum 6 concurrent SSE connections hit

**Prevention:**
1. **HTTP/2 requirement:** Mandate HTTP/2 to avoid 6-connection limit
2. **Heartbeat comments:** Send periodic SSE comments to prevent idle timeouts
3. **Proper headers:** Set `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`
4. **Graceful degradation:** Implement polling fallback when SSE fails
5. **Client acknowledgment:** Require client ACK at connection start; close with timeout if not received
6. **Cloud Run configuration:** Configure for SSE compatibility (response streaming enabled)
7. **Test with proxies:** Test through corporate proxies and VPNs before launch

**Phase Mapping:**
- Phase 1 (Infrastructure): Configure Cloud Run for streaming from start
- Phase 3 (Agent Visualization): Build polling fallback alongside SSE
- Pre-production: Load test with realistic proxy configurations

**Sources:**
- [Server Sent Events are still not production ready](https://dev.to/miketalbot/server-sent-events-are-still-not-production-ready-after-a-decade-a-lesson-for-me-a-warning-for-you-2gie)
- [The Hidden Risks of SSE](https://medium.com/@2957607810/the-hidden-risks-of-sse-server-sent-events-what-developers-often-overlook-14221a4b3bfe)

---

### Pitfall 6: Cloud Run Timeout and Long-Running Task Failures

**Severity:** HIGH

**What goes wrong:** Video/audio processing exceeds Cloud Run service timeout (max 60 minutes). Connections drop during long document processing. CPU throttling kills background work.

**Why it happens:**
- Cloud Run services default to 5-minute timeout, max 60 minutes
- CPU is throttled to near-zero when not handling requests
- Jobs have maintenance events that break outbound VPC connections
- HTTP connections may drop; clients not guaranteed same instance on reconnect

**Consequences:**
- Video processing fails mid-stream
- Large document analysis times out
- Background processing silently dies
- Unpredictable failures for long evidence analysis

**Warning Signs:**
- Processing works for small files, fails for large
- Jobs succeed in development but fail in production
- Inconsistent failures that seem random
- CPU-intensive work fails during "quiet" periods

**Prevention:**
1. **Cloud Run Jobs for heavy processing:** Use Jobs (up to 24 hours) instead of Services for video/audio
2. **Chunked processing:** Break large documents into smaller chunks processed independently
3. **Progress persistence:** Save progress to database; resume on reconnection
4. **Async architecture:** Use Cloud Tasks to queue long-running work
5. **Callback pattern:** Implement completion callbacks instead of waiting for results
6. **Keep-alive during processing:** Maintain request activity to prevent CPU throttling
7. **Retry tolerance:** Design for mid-processing failures with checkpoint/resume

**Phase Mapping:**
- Phase 1 (Architecture): Design async processing architecture upfront
- Phase 2 (Multimodal Processing): Implement Cloud Run Jobs for video/audio
- Phase 3 (Scale Testing): Test with production-size documents and videos

**Sources:**
- [Cloud Run Request Timeout Documentation](https://cloud.google.com/run/docs/configuring/request-timeout)
- [Cloud Run Jobs Task Timeout](https://cloud.google.com/run/docs/configuring/task-timeout)
- [Cloud Run FAQ](https://github.com/ahmetb/cloud-run-faq)

---

### Pitfall 7: Gemini API Rate Limiting

**Severity:** HIGH

**What goes wrong:** Multi-agent systems burn tokens quickly, hitting rate limits. 429 errors cascade through workflows, causing partial failures.

**Why it happens:**
- Free tier: 5 RPM for Pro, 15 RPM for Flash (as of December 2025)
- Multi-agent workflows multiply API calls
- Rate limits apply per project, not per API key
- Token bucket algorithm allows bursts but depletes quickly

**Consequences:**
- Agent workflows fail mid-execution
- Inconsistent behavior based on time of day
- Development works, production fails under load
- Cascading failures across agent network

**Warning Signs:**
- Sporadic 429 errors in logs
- Workflows that succeed sometimes and fail others
- Performance degradation during peak usage
- Test metrics don't match production behavior

**Prevention:**
1. **Request batching:** Combine multiple prompts into single API calls (20 prompts per request = 20x efficiency)
2. **Exponential backoff with jitter:** Handle 429s gracefully with Retry-After header
3. **Model routing:** Use Flash-Lite for simple tasks, reserve Pro for complex reasoning
4. **Caching layer:** Aggressive caching of repeated queries
5. **Request queuing:** Implement queue with rate limiting on client side
6. **Tier planning:** Budget for Tier 1 ($250 threshold) for 150 RPM; plan tier progression
7. **Token optimization:** Reduce prompt lengths; use efficient prompting patterns

**Phase Mapping:**
- Phase 1 (Infrastructure): Implement caching and request queuing from start
- Phase 2 (Agent System): Design agent workflows with rate limits in mind
- Phase 3 (Production): Monitor RPM/TPM metrics; plan tier upgrades

**Sources:**
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Rate Limits Complete Guide](https://blog.laozhang.ai/ai-tools/gemini-api-rate-limits-guide/)

---

### Pitfall 8: Knowledge Graph Entity Resolution at Scale

**Severity:** HIGH

**What goes wrong:** Entity resolution is theoretically O(n²). Duplicates accumulate, creating inconsistent knowledge graphs. Performance degrades exponentially with data growth.

**Why it happens:**
- Pairwise comparison required for entity matching
- Duplicates overlap in non-trivial ways
- Real-time ER is much harder than batch processing
- Graph-based operations are computationally expensive at scale

**Consequences:**
- Same entity appears multiple times with different IDs
- Relationships point to wrong entity versions
- Query results become unreliable
- Performance cliffs when data scales

**Warning Signs:**
- Multiple entries for same person/organization
- Conflicting information for same entity
- Slow queries that worked fine with small data
- User reports of "missing" connections (actually fragmented)

**Prevention:**
1. **Blocking functions:** Use LSH-based blocking to reduce comparison space
2. **Incremental ER:** Resolve entities as documents are ingested, not in batch
3. **Confidence scoring:** Track match confidence; surface uncertain matches for review
4. **LLM-assisted matching:** Use embeddings for semantic similarity, LLM for final decisions
5. **Entity canonical IDs:** Establish single source of truth for each entity
6. **Resolve before graph insert:** Complete ER before adding to graph to minimize expensive graph operations

**Phase Mapping:**
- Phase 3 (Knowledge Graph): Design ER pipeline before graph schema
- Phase 4 (Entity Resolution): Implement incremental ER with blocking
- Ongoing: Monitor entity duplication rates as quality metric

**Sources:**
- [Entity Resolved Knowledge Graphs - Neo4j](https://neo4j.com/blog/developer/entity-resolved-knowledge-graphs/)
- [GraphRAG & Why Knowledge Graphs Need Entity Resolution](https://senzing.com/knowledge-graphs-graphrag/)

---

### Pitfall 9: PostgreSQL JSONB Performance Cliffs

**Severity:** HIGH

**What goes wrong:** JSONB queries slow down 2-10x for documents over 2KB due to TOAST storage. Updates copy entire documents. Storage bloats to 2x+ compared to normalized schemas.

**Why it happens:**
- TOAST compression kicks in at 2KB, requiring decompression on access
- Any update to TOASTed value copies entire document
- Multiple key extractions detoast multiple times
- No deduplication of common keys
- Query planner makes poor choices with many OR conditions

**Consequences:**
- Fast in development with small documents, slow in production
- Simple updates become expensive operations
- Disk usage explodes unexpectedly
- Complex queries timeout

**Warning Signs:**
- Evidence metadata documents exceeding 2KB
- Frequent updates to large JSONB documents
- Query performance degrading with data growth
- Extracting many keys in single query

**Prevention:**
1. **Hybrid schema:** Use traditional columns for frequently queried/updated fields; JSONB for variable data
2. **Size monitoring:** Alert when JSONB documents approach TOAST threshold (2KB)
3. **Separate tables for large JSON:** Store raw JSON in separate table, read only when needed
4. **GIN indexes thoughtfully:** Index specific paths, not entire JSONB columns
5. **Materialized columns:** Extract hot fields to indexed columns for query performance
6. **Avoid frequent updates:** Design for append-only patterns where possible

**Phase Mapping:**
- Phase 1 (Database Design): Design hybrid schema from start
- Phase 2 (Evidence Storage): Separate metadata from raw content
- Phase 3 (Performance Testing): Load test with production-size documents

**Sources:**
- [Postgres performance cliffs with large JSONB values and TOAST](https://pganalyze.com/blog/5mins-postgres-jsonb-toast)
- [When To Avoid JSONB In A PostgreSQL Schema](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)

---

### Pitfall 10: React Flow Performance with Large Graphs

**Severity:** HIGH

**What goes wrong:** Knowledge graph visualization becomes sluggish with hundreds of nodes. Every node drag triggers re-renders of entire graph. Browser becomes unresponsive.

**Why it happens:**
- Unnecessary re-renders on every state change
- Non-memoized components recreate on each render
- Direct access to nodes/edges triggers cascading updates
- Complex CSS (shadows, animations) compound performance issues

**Consequences:**
- Visualization unusable for real case evidence graphs
- Browser tab crashes with large knowledge graphs
- Poor user experience degrades platform credibility
- Feature works in demos, fails with real data

**Warning Signs:**
- React DevTools shows many components re-rendering on drag
- Lag increases with number of nodes
- CPU spikes during graph interaction
- Performance fine with 50 nodes, unusable at 500

**Prevention:**
1. **Memoize everything:** Use `React.memo` for custom node/edge components; declare outside parent
2. **Virtualization:** Enable `onlyRenderVisibleElements` prop
3. **Avoid direct store access:** Never access full nodes/edges array in components
4. **Stable references:** Use `useCallback` and `useMemo` with stable dependencies
5. **CSS optimization:** Remove animations, shadows, gradients from node styles
6. **Event throttling:** Debounce drag and pan updates
7. **Batch updates:** Accumulate changes and apply in single render cycle

**Phase Mapping:**
- Phase 3 (Knowledge Graph Visualization): Build with performance patterns from start
- Phase 4 (Scale Testing): Test with 1000+ node graphs
- Ongoing: Profile with React DevTools regularly

**Sources:**
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [The ultimate guide to optimize React Flow performance](https://medium.com/@lukasz.jazwa_32493/the-ultimate-guide-to-optimize-react-flow-project-performance-42f4297b2b7b)

---

## Medium Severity Pitfalls

Mistakes that cause delays, technical debt, or require focused refactoring.

---

### Pitfall 11: Next.js SSR Performance at Scale

**Severity:** MEDIUM

**What goes wrong:** SSR becomes bottleneck with large DOM sizes. Serialization dominates CPU. Hydration causes "false interactions" where user actions are lost.

**Why it happens:**
- SSR steps are sequential and blocking
- Single slow data request delays entire page
- Large DOMs expensive to serialize
- next/image component is CPU-intensive
- Hydration replaces pre-rendered state

**Consequences:**
- Slow Time-to-First-Byte under load
- User interactions lost during hydration
- Can't scale beyond ~4.5 RPS per pod with large pages
- Event loop lag under heavy SSR

**Warning Signs:**
- High TTFB in production but not development
- User reports of "lost" interactions
- CPU saturation on SSR requests
- Event loop lag metrics elevated

**Prevention:**
1. **Streaming SSR:** Use React 18 streaming to progressively send HTML
2. **Suspense boundaries:** Wrap slow components in Suspense for progressive loading
3. **Selective hydration:** Allow interaction with hydrated parts before full page ready
4. **Server Components:** Use for data-fetching; minimize client JS
5. **ISR/SSG where possible:** Static generation for non-personalized content
6. **Avoid next/image for many images:** Consider alternatives under heavy load
7. **Prioritize critical UI:** Stream navigation and key content first

**Phase Mapping:**
- Phase 1 (Frontend Architecture): Design with streaming from start
- Phase 3 (Performance Optimization): Profile SSR bottlenecks
- Pre-production: Load test SSR endpoints

**Sources:**
- [The Next.js 15 Streaming Handbook](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/)
- [Fixing a Major Next.js Performance Bottleneck](https://dev.to/mina_golzari_dalir/fixing-a-major-nextjs-performance-bottleneck-ssr-hydration-large-datasets-47g9)

---

### Pitfall 12: Multimodal Context Window Exhaustion

**Severity:** MEDIUM

**What goes wrong:** Large PDFs, videos, and audio files exhaust context windows. Multimodal inference requires 2x memory and higher latency than text-only.

**Why it happens:**
- Image/video tokens can be 10-100x text equivalent
- Long videos require chunking but lose temporal context
- MLLM inference has up to 100x memory requirements vs text LLMs
- TTFT latency 2x higher for multimodal

**Consequences:**
- Unable to process long depositions or video evidence
- Context truncation loses critical information
- Memory errors on large multimodal inputs
- Slow response times frustrate users

**Warning Signs:**
- Processing fails for videos over X minutes
- "Context too long" errors
- Memory pressure on inference infrastructure
- Processing time increases non-linearly with document size

**Prevention:**
1. **Late fusion architecture:** Process chunks separately, fuse outputs (up to 48.9% improvement for long videos)
2. **Visual token compression:** Use techniques like DeepSeek-OCR's 20x compression
3. **Hierarchical summarization:** Summarize chunks, then summarize summaries
4. **Strategic chunking:** Chunk by semantic boundaries (scenes, sections) not arbitrary lengths
5. **Selective processing:** Identify and process only relevant portions
6. **Caching:** Cache chunk-level analyses for reuse

**Phase Mapping:**
- Phase 2 (Multimodal Processing): Design chunking strategy before implementation
- Phase 3 (Scale Testing): Test with maximum-length evidence files
- Ongoing: Monitor context utilization metrics

**Sources:**
- [QMAVIS: Long Video-Audio Understanding](https://arxiv.org/html/2601.06573)
- [LLMs with largest context windows](https://codingscape.com/blog/llms-with-largest-context-windows)

---

### Pitfall 13: Premature Tool Adoption

**Severity:** MEDIUM

**What goes wrong:** Teams adopt multiple AI tools simultaneously without clear use cases. Non-legal AI tools used for legal work cause ethical violations.

**Why it happens:**
- FOMO driving tool adoption
- Generic tools (ChatGPT, Copilot) used without legal verification
- Multiple tools create integration complexity
- Staff not trained on appropriate use

**Consequences:**
- $50K+ wasted on failed implementations (mid-size firm average)
- Ethical violations from using non-legal tools for legal work
- Integration complexity slows development
- Loss of clients who demand AI efficiency

**Warning Signs:**
- Multiple overlapping tools for similar purposes
- Using general-purpose AI for legal conclusions
- No training program for AI tool use
- No clear use cases defined before tool selection

**Prevention:**
1. **Single-purpose tools first:** Master one tool before adding others
2. **Legal-specific validation:** Verify any tool against legal requirements before use
3. **Clear use case mapping:** Define exactly what each tool should/shouldn't do
4. **Staff training:** Train users on appropriate vs inappropriate use
5. **Human certification:** Judges now require lawyers to certify human review of AI output

**Phase Mapping:**
- Phase 1 (Architecture): Define tool scope and boundaries
- All phases: Resist scope creep with new tools
- Pre-production: Document appropriate use policies

**Sources:**
- [8 AI Implementation Challenges for Law Firms](https://www.clio.com/blog/law-firms-ai-implementation-challenges/)
- [AI Legal Issues and Concerns](https://www.americanbar.org/groups/law_practice/resources/law-technology-today/2025/ai-legal-issues-and-concerns-for-legal-practitioners/)

---

### Pitfall 14: Google Earth Engine Approval Delay

**Severity:** MEDIUM

**What goes wrong:** Earth Engine API access requires GCP project approval, which can take days or weeks. Development blocked waiting for approval.

**Why it happens:**
- Earth Engine requires separate approval beyond standard GCP APIs
- Approval process involves manual review by Google
- Commercial vs non-commercial use affects approval timeline
- API quotas require explicit increase requests

**Consequences:**
- Geospatial features delayed or blocked
- Demo preparation impacted if approval pending
- Feature cut from MVP if approval not received in time

**Warning Signs:**
- Approval status still "pending" after initial request
- No response from Earth Engine team
- Approval request rejected due to incorrect use case description

**Prevention:**
1. **Apply immediately:** Request Earth Engine access during Phase 1, not when needed
2. **Clear use case:** Describe investigative/verification use case in approval request
3. **Fallback plan:** Design Geospatial Agent to work without satellite imagery if needed
4. **Mock data:** Prepare mock satellite imagery for demos if approval delayed
5. **Commercial consideration:** Ensure GCP project is set up correctly for commercial use

**Phase Mapping:**
- Phase 1 (Infrastructure): Submit Earth Engine approval request immediately
- Phase 8 (Geospatial): Have fallback plan if approval still pending

---

### Pitfall 15: Geocoding Accuracy for Historical/Ambiguous Locations

**Severity:** MEDIUM

**What goes wrong:** Geocoding fails for ambiguous place names, historical locations, or informal references. Location extraction produces false confidence.

**Why it happens:**
- "Springfield" exists in multiple states/countries
- Historical addresses may no longer exist
- Informal names ("the warehouse on 5th") can't be geocoded
- OCR errors in scanned documents produce invalid addresses

**Consequences:**
- Incorrect location markers on map
- False movement patterns detected
- User loses trust in geospatial features
- Satellite imagery retrieved for wrong location

**Warning Signs:**
- High geocoding confidence for clearly ambiguous names
- Locations clustering in unexpected areas
- Movement patterns that defy physics

**Prevention:**
1. **Context-aware disambiguation:** Use case context to disambiguate (case in Texas → prefer Texas Springfield)
2. **Confidence thresholds:** Surface low-confidence geocodes for user review
3. **Multiple candidates:** Show multiple location candidates when ambiguous
4. **Historical geocoding:** Consider historical address databases for old cases
5. **User confirmation:** Require user confirmation for locations used in movement analysis

**Phase Mapping:**
- Phase 8 (Geospatial): Implement disambiguation logic
- Phase 9 (UI): Surface uncertain locations for user review

---

### Pitfall 16: Hypothesis Explosion

**Severity:** MEDIUM

**What goes wrong:** Agents generate too many hypotheses, overwhelming users. Hypothesis view becomes unusable with dozens of competing theories.

**Why it happens:**
- Agents optimized to propose hypotheses, not filter them
- No deduplication of similar hypotheses
- Low threshold for hypothesis creation
- Each domain agent generates independently

**Consequences:**
- Users ignore hypothesis feature due to noise
- Important hypotheses buried among trivial ones
- Confidence scoring becomes meaningless with too many hypotheses
- Investigation tasks pile up for hypothesis verification

**Warning Signs:**
- More than 10 hypotheses for simple cases
- Many hypotheses at PENDING status without progress
- Users never interacting with hypothesis view
- Duplicate or near-duplicate hypotheses

**Prevention:**
1. **Quality thresholds:** Only create hypotheses meeting minimum confidence
2. **Deduplication:** Merge similar hypotheses before presenting
3. **Hierarchical organization:** Group related hypotheses
4. **User curation prompt:** Prompt users to accept/reject initial hypotheses
5. **Priority ranking:** Surface highest-confidence hypotheses first

**Phase Mapping:**
- Phase 7 (Hypothesis System): Implement deduplication and thresholds
- Phase 9 (Hypothesis View): Design for manageable hypothesis counts

---

### Pitfall 17: Investigation Task Noise

**Severity:** LOW

**What goes wrong:** Too many investigation tasks generated, creating alert fatigue. Tasks become ignored rather than actioned.

**Why it happens:**
- Multiple agents generating tasks without coordination
- No deduplication of similar tasks
- Tasks created for minor issues alongside critical ones
- No priority differentiation

**Consequences:**
- Critical tasks buried among trivial ones
- Users disable or ignore task panel
- Investigation workflow breaks down
- Task completion rate drops

**Warning Signs:**
- More than 20 pending tasks for typical case
- Many tasks never completed
- Duplicate tasks for same issue
- Users not engaging with task panel

**Prevention:**
1. **Agent coordination:** Agents check existing tasks before creating
2. **Priority tiers:** Clearly differentiate critical vs optional tasks
3. **Task consolidation:** Merge related tasks
4. **Completion incentives:** Gamify task completion
5. **Smart filtering:** Default to high-priority tasks only

**Phase Mapping:**
- Phase 7 (Task Generation): Implement coordination and deduplication
- Phase 10 (Task Panel): Design for focused attention

---

## Minor Pitfalls

Mistakes that cause annoyance but are recoverable with focused effort.

---

### Pitfall 18: ADK Debugging Loss with Custom Agents

**Severity:** MINOR

**What goes wrong:** ADK's Web UI debugging tools don't work with custom per-user agent implementations.

**Why it happens:** ADK assumes shared root agent; custom per-user patterns break built-in tooling.

**Prevention:**
- Invest in custom logging/tracing early
- Use OpenTelemetry for distributed tracing
- Accept debugging tradeoff for proper user isolation

---

### Pitfall 19: Session State Race Conditions

**Severity:** MINOR

**What goes wrong:** Agents in ParallelAgent write to same state keys, causing data corruption.

**Why it happens:** Shared session.state without namespacing; parallel execution interleaves writes.

**Prevention:**
- Namespace all state keys: `task:{run_id}:{agent_name}:{key}`
- Use output_key for SequentialAgent handoffs
- Implement locking for shared state updates

---

## Phase-Specific Warning Summary

| Phase | Likely Pitfalls | Mitigation Focus |
|-------|-----------------|------------------|
| Phase 1: Core Infrastructure | Cloud Run config, JSONB schema, SSE setup, Earth Engine approval | Design async architecture, hybrid schema, streaming config, submit EE request early |
| Phase 2: Agent System | ADK limitations, multi-agent failures, rate limiting | Orchestrator pattern, deterministic workflows, request batching |
| Phase 3: Evidence Processing | Context window limits, processing timeouts, citation accuracy | Chunking strategy, Cloud Run Jobs, span-level verification |
| Phase 4: Knowledge Graph | Entity resolution scaling, React Flow performance | Incremental ER, virtualization, memoization |
| Phase 5: Production | SSE proxy issues, SSR bottlenecks, rate limit spikes | Fallback patterns, streaming SSR, tier planning |
| Phase 7: Hypothesis System | Hypothesis explosion, task noise | Deduplication, quality thresholds, agent coordination |
| Phase 8: Geospatial | Earth Engine approval delay, geocoding accuracy | Fallback plan, disambiguation logic, user confirmation |

---

## Research Confidence Assessment

| Pitfall Category | Confidence | Verification |
|------------------|------------|--------------|
| LLM Hallucination | HIGH | Stanford study, multiple legal cases, industry reports |
| Multi-Agent Failures | HIGH | Academic research (1,642 traces analyzed), industry reports |
| ADK Limitations | HIGH | Official documentation, production case studies |
| Citation Accuracy | HIGH | Nature Communications study, multiple academic papers |
| SSE Streaming | MEDIUM-HIGH | Industry blog posts, multiple production reports |
| Cloud Run Limits | HIGH | Official GCP documentation |
| Gemini Rate Limits | HIGH | Official documentation, December 2025 updates |
| Entity Resolution | MEDIUM-HIGH | Academic papers, vendor documentation |
| PostgreSQL JSONB | HIGH | pganalyze research, multiple technical blogs |
| React Flow Performance | HIGH | Official documentation, production optimization guides |

---

## Sources

### Academic & Research
- [Stanford Legal RAG Hallucinations Study](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf)
- [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657)
- [LLM Agents in Law: Taxonomy, Applications, and Challenges](https://arxiv.org/html/2601.06216)
- [CiteFix: Enhancing RAG Accuracy](https://arxiv.org/html/2504.15629v2)
- [Automated Framework for Assessing LLM Citation Accuracy](https://www.nature.com/articles/s41467-025-58551-6)

### Official Documentation
- [Google ADK Multi-Agent Systems](https://google.github.io/adk-docs/agents/multi-agents/)
- [ADK Tool Limitations](https://google.github.io/adk-docs/tools/limitations/)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Cloud Run Request Timeout](https://cloud.google.com/run/docs/configuring/request-timeout)
- [React Flow Performance](https://reactflow.dev/learn/advanced-use/performance)

### Industry Reports & Guides
- [8 AI Implementation Challenges for Law Firms](https://www.clio.com/blog/law-firms-ai-implementation-challenges/)
- [AI Legal Issues and Concerns - ABA](https://www.americanbar.org/groups/law_practice/resources/law-technology-today/2025/ai-legal-issues-and-concerns-for-legal-practitioners/)
- [4 Google ADK Production Challenges](https://dlabs.ai/blog/google-adk-production-challenges-and-how-to-solve-them/)
- [When To Avoid JSONB In PostgreSQL](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)
- [SSE Production Issues](https://dev.to/miketalbot/server-sent-events-are-still-not-production-ready-after-a-decade-a-lesson-for-me-a-warning-for-you-2gie)
