# Analysis Pipeline: Complete Request Flow

End-to-end data flow from file upload through agentic analysis to frontend display.

---

## Phase 1: File Upload

1. User uploads files via the Library UI.
2. `POST /api/cases/{case_id}/files` stores files in GCS, creates records in `case_files` with `status=UPLOADED`.
3. Case state: `status=DRAFT`, `latest_workflow_id=null`, `file_count` incremented.

## Phase 2: Analysis Trigger

4. User clicks "Run Analysis" in the `AnalysisTrigger` component.
5. Frontend calls `startAnalysis(caseId, mode)` which hits `POST /api/cases/{case_id}/analyze`.
6. Backend endpoint (`agents.py` — `start_analysis`):
   - Validates case ownership, checks case is not already PROCESSING (concurrency guard).
   - Generates a `workflow_id` (UUID).
   - Sets `case.status = PROCESSING`, `case.latest_workflow_id = workflow_id`, commits.
   - Queues `run_analysis_workflow()` as a FastAPI `BackgroundTask`.
   - Returns `{ workflow_id }` to frontend immediately (HTTP 202-style).
7. Frontend on response:
   - `emitAnalysisReset()` fires a DOM event caught by `useAgentStates`, which calls `resetState()` to clear all accumulated agent state from any prior run.
   - Navigates to `/cases/{caseId}/command-center`.
   - `AnalysisTrigger` internal state: `idle -> submitting -> navigating`.

## Phase 3: SSE Connection Establishment

8. Command center page mounts. `useAgentStates(caseId)` initializes idle state for all 7 agent types, then `useCommandCenterSSE(caseId)` opens an EventSource.
9. EventSource connects to `GET /sse/cases/{case_id}/command-center/stream`.
10. Backend immediately sends a **state-snapshot** event:
    - Queries DB for the latest workflow's execution records.
    - Returns each execution's status, metadata (tokens, duration, model), and lastResult.
    - On a brand-new analysis: the snapshot is empty because the pipeline just started and has not committed any execution records yet.
11. Frontend `handleStateSnapshot`: processes the snapshot. On first load with an empty snapshot, all agents remain idle (matching the initial state).

## Phase 4: Pipeline Execution (Background Task)

Everything below runs inside `run_analysis_workflow`, within a single `async with session_factory() as db:` block.

### Stage 1 — Triage (classify files, extract entities)

```
12. File statuses: UPLOADED -> QUEUED -> PROCESSING  (two db.commit() calls)
13. emit_agent_started("triage")
      -> SSE -> frontend sets triage status to "processing"
14. run_triage(db_session=db):
      - Creates AgentExecution record: PENDING -> RUNNING -> COMPLETED
      - Uses db_session.flush() throughout (no commit)
      - Returns TriageOutput (file_results, suggested_groupings, entities)
15. db.commit()
      -> triage execution record is now persisted and visible to other sessions
16. emit_agent_complete("triage", result_with_metadata)
      -> SSE -> frontend sets triage to "idle" with lastResult populated
```

### Stage 2 — Orchestrator (routing decisions)

```
17. emit_agent_started("orchestrator")
      -> SSE -> frontend sets orchestrator to "processing"
18. run_orchestrator(db_session=db):
      - Creates AgentExecution, flushes
      - Input: text-only summary of TriageOutput (no file content)
      - Returns OrchestratorOutput (routing_decisions, file_groups, parallel/sequential agents)
19. db.commit()
      -> orchestrator execution record persisted
20. emit_agent_complete("orchestrator", result_with_routing_decisions)
      -> SSE -> frontend sets orchestrator to "idle" with lastResult
```

### Stage 3 — Domain Agents (parallel execution)

```
21. compute_agent_tasks(routing, files):
      - Single source of truth for what will execute.
      - Iterates file_groups and routing_decisions.
      - Returns list of AgentTask: (agent_type, files, context_injection, stage_suffix, group_label)
      - Example: [evidence_grp_0 (5 files), legal_ungrouped_0 (1 file)]

22. For each expected task, pre-emit SSE events:
      emit_agent_started("evidence_grp_0")   -> frontend: evidence = "processing"
      emit_agent_started("legal_ungrouped_0") -> frontend: legal = "processing"
      (Compound IDs like "evidence_grp_0" are resolved to base types by extractBaseAgentType)

23. run_domain_agents_parallel():
      - For EACH AgentTask, creates a SEPARATE DB session from session_factory()
      - All tasks run concurrently via asyncio.gather(return_exceptions=True)

      Inside each parallel coroutine (_run_agent_with_session):
        a) async with session_factory() as task_db:
        b) run_fn(db_session=task_db):
             - DomainAgentRunner.run() Template Method:
               - Creates AgentExecution (PENDING), flush
               - Marks RUNNING, flush
               - Prepares multimodal content (downloads files from GCS)
               - Attempts Pro model with retries
               - Falls back to Flash model if Pro fails
               - Updates execution (COMPLETED/FAILED), flush
             - Returns parsed output model or None
        c) await task_db.commit()   <-- each agent commits its OWN execution record
        d) Returns (agent_type, result_or_None, group_label)

      NOTE: The main pipeline `db` session is IDLE for the entire duration of step 23.

24. asyncio.gather() returns results list (tuples or exception objects).

25. Build domain_results dict:
      - Exception items: logged and skipped (agent NOT added to domain_results)
      - Tuple items: appended to domain_results[agent_type] as (result, group_label)

26. For each entry in domain_results:
      - Query main `db` session for execution record metadata (tokens, duration, etc.)
      - result is not None -> emit_agent_complete(compound_id, result_with_metadata)
           -> SSE -> frontend: agent = "idle" with lastResult
      - result is None -> emit_agent_error(compound_id, error_message)
           -> SSE -> frontend: agent = "error"
```

### Stage 4 — Strategy Agent (sequential, after domain agents)

```
27. Only runs if orchestrator explicitly requested strategy analysis.
28. build_strategy_context(domain_results) -> text summaries of domain findings.
29. emit_agent_started("strategy")
30. run_strategy(db_session=db, domain_summaries=text)
31. db.commit()
32. emit_agent_complete("strategy") or emit_agent_error("strategy")
```

### Stage 5 — HITL (Human-in-the-Loop for low-confidence findings)

```
33. For each finding below the confidence threshold:
      emit_confirmation_required -> SSE -> frontend shows ConfirmationModal
      Pipeline BLOCKS waiting for user response via asyncio event
      emit_confirmation_resolved -> SSE -> frontend dismisses modal
34. Rejected findings marked in output (preserved for audit, excluded from KG later).
```

### Stage 6 — Finalization

```
35. Update all processed file statuses to ANALYZED (db.commit).
36. Aggregate metrics: total findings, entities, tokens across all execution records.
37. emit_processing_complete(metrics)
      -> SSE -> frontend: sets lastProcessingSummary (files, entities, tokens, duration)
38. case.status = CaseStatus.READY
39. db.commit()
      -> Case is now READY in the database.
40. Pipeline function returns. Background task complete.
```

### Error Path

```
If any exception occurs during steps 12-39:
  - Caught by except Exception at the pipeline level
  - Attempts to set file statuses to ERROR and case.status to ERROR using same db session
  - If that also fails (nested try/except), logs the failure
  - Case status may remain PROCESSING permanently if both commits fail
  - emit_agent_error("pipeline", error_message)
```

## Phase 5: Frontend Completion Detection

41. Case layout polls `GET /api/cases/{case_id}` every 10 seconds while `caseStatus === "PROCESSING"`.
42. Poll picks up `status: "READY"` (or `"ERROR"`).
43. React state update: `caseData.status` changes.
44. `AnalysisTrigger` useEffect detects the caseStatus change, resets `triggerState` to `"idle"`.
45. Button becomes interactive: shows "Analyze New Files" / "Rerun All Files" dropdown.

## Phase 6: Page Refresh / SSE Reconnection

46. Page refresh -> React remounts -> `createInitialStates()` sets all agents to idle.
47. New SSE connection -> `build_state_snapshot()`:
    - Queries DB for all AgentExecution records matching the latest workflow.
    - Returns each agent's status, metadata, and lastResult.
48. `handleStateSnapshot`: updates each agent found in the snapshot.
    - Agents in snapshot: updated to their DB status (completed, running, failed, etc.)
    - Agents NOT in snapshot: remain in their current state (idle on fresh mount, or stale on reconnect).

---

## Key Data Tables

| Table | Role |
|-------|------|
| `cases` | Case metadata, `status` (DRAFT/PROCESSING/READY/ERROR), `latest_workflow_id` |
| `case_files` | Files per case, `status` (UPLOADED/QUEUED/PROCESSING/ANALYZED/ERROR) |
| `agent_executions` | One row per agent invocation: input/output data, tokens, thinking traces, timing |

## Key SSE Events

| Event | Trigger | Frontend Effect |
|-------|---------|-----------------|
| `state-snapshot` | SSE connect | Restore agent states from DB |
| `agent-started` | Agent begins | Agent card -> "processing" |
| `agent-complete` | Agent finishes | Agent card -> "idle" with results |
| `agent-error` | Agent fails | Agent card -> "error" |
| `thinking-update` | Model reasoning | Appends thinking traces to agent |
| `processing-complete` | Pipeline done | Sets summary metrics |
| `confirmation-required` | Low-confidence finding | Shows HITL modal |
| `confirmation-resolved` | User responds | Dismisses HITL modal |
