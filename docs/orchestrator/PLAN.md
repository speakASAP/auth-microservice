# Auth Implementation Plan

## Execution Rule

Work one goal chunk at a time. Prefer a complete, verifiable chunk over starting multiple tracks.

No implementation begins until the Auth IPS pre-coding gate passes for the selected chunk or the owner explicitly approves a documented exception.

## Planning Stages

Auth follows the Goalkeeper/Project OS lifecycle for future implementation work:

1. `queued` - owner or coordinator has captured a goal.
2. `planning` - coordinator gathers DocsRAG context, source facts, risks, and acceptance criteria.
3. `approved` - owner or session lead accepts the plan or explicitly selects the next chunk.
4. `active` - implementation agent edits the smallest complete chunk.
5. `validation` - build, syntax, API, UI, or deployment checks run.
6. `done` - evidence is recorded and the next chunk is named.
7. `blocked` - the same blocker prevents progress and owner input is required.

## IPS Stage Checks

For each coding chunk, perform these checks in order:

1. Intent check: selected work preserves `docs/orchestrator/INTENT.md`.
2. Traceability check: selected work links to `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/GOALS.md`, `implementation-goals/README.md`, or `TASKS.md`.
3. Context check: `docs/orchestrator/CONTEXT_PACKAGE.md` names included and excluded documents.
4. Invariant check: `docs/orchestrator/PROJECT_INVARIANTS.md` lists rules affected by the work.
5. Sensitive-data check: the plan states whether secrets, tokens, credentials, production user data, or logs are involved.
6. Contract check: the plan states whether JWT, RBAC, API, redirect, CORS, OAuth, magic-link, or internal-service contracts change.
7. Validation check: the plan names exact commands or runtime checks.
8. Gate check: `docs/orchestrator/PRE_CODING_GATE.md` has a pass decision or documented exception.

## Coordinator Duties

The coordinator agent must:

- Read `AGENTS.md`, the orchestrator pack, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `implementation-goals/README.md`, and current `STATE.json`.
- Query docs-rag-microservice before broad architecture decisions.
- Select the active checkpoint from `docs/IMPLEMENTATION_STATE.md`; otherwise select the earliest active or pending goal unless the owner overrides it.
- Tell the user the current goal, current chunk, verification plan, and next task.
- Keep `docs/IMPLEMENTATION_STATE.md` and `docs/orchestrator/STATUS.md` updated with concrete evidence.
- Create or update an execution plan from `implementation-goals/templates/EXECUTION_PLAN.md` before coding.
- Use context packages, coding prompts, and validation reports when work is delegated or high risk.
- Avoid cross-service ownership drift.

## Goalkeeper-Style Orchestration Artifacts

Auth uses the same state-driven orchestration shape as Goalkeeper:

- Master prompt: `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- Continuation state: `docs/IMPLEMENTATION_STATE.md`
- Goal index: `implementation-goals/README.md`
- Execution templates: `implementation-goals/templates/`
- Historical evidence: `docs/orchestrator/STATUS.md`

## Active Work

No active goal.

Current chunk:

- Goal 5 - Goalkeeper-Style Orchestrator Workflow: done.
- Next ready goal: Goal 6 - RBAC Consuming Services Audit, pending owner selection.

## Verification Commands

Use the narrowest relevant checks:

```bash
node --check web/public/js/admin.js
npm run build
./scripts/deploy.sh
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin
```

Documentation-only IPS changes should be checked with:

```bash
find docs/orchestrator -maxdepth 1 -type f -name '*.md' -print
rg '\[(MISSING|UNKNOWN):' docs/orchestrator AGENTS.md TASKS.md docs/UNIFIED_AUTH_CONTRACT.md docs/UNIFIED_AUTH_VERIFICATION.md docs/ENV_CORS_AND_AUTH_CHECK.md
rg -n 'Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}|(access[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[:=]\s*['"'"'\"]?[A-Za-z0-9_./+=:-]{12,}' docs AGENTS.md TASKS.md
```

For DocsRAG context, query:

```bash
POST /retrieval/agent-context
{"query":"auth-microservice <topic>","maxTokens":3000}
```

## Next Goal Selection

Select the active checkpoint from `docs/IMPLEMENTATION_STATE.md`. If none exists, select the next owner-approved backlog item.
