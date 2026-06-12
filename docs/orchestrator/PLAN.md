# Auth Implementation Plan

## Execution Rule

Work one goal chunk at a time. Prefer a complete, verifiable chunk over starting multiple tracks.

## Planning Stages

Auth follows the Goalkeeper/Project OS lifecycle for future implementation work:

1. `queued` - owner or coordinator has captured a goal.
2. `planning` - coordinator gathers DocsRAG context, source facts, risks, and acceptance criteria.
3. `approved` - owner or session lead accepts the plan or explicitly selects the next chunk.
4. `active` - implementation agent edits the smallest complete chunk.
5. `validation` - build, syntax, API, UI, or deployment checks run.
6. `done` - evidence is recorded and the next chunk is named.
7. `blocked` - the same blocker prevents progress and owner input is required.

## Coordinator Duties

The coordinator agent must:

- Read the orchestrator pack and current `STATE.json`.
- Query docs-rag-microservice before broad architecture decisions.
- Select the earliest active or pending goal unless the owner overrides it.
- Tell the user the current goal, current chunk, verification plan, and next task.
- Keep `docs/orchestrator/STATUS.md` updated with concrete evidence.
- Avoid cross-service ownership drift.

## Active Work

No active goal.

Current chunk:

- Backlog is clear except broader RBAC audit in `TASKS.md`.

## Verification Commands

Use the narrowest relevant checks:

```bash
node --check web/public/js/admin.js
npm run build
./scripts/deploy.sh
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin
```

For DocsRAG context, query:

```bash
POST /retrieval/agent-context
{"query":"auth-microservice <topic>","maxTokens":3000}
```

## Next Goal Selection

Select the next owner-approved backlog item.
