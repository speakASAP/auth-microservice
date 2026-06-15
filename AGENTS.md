# Repository Agent Instructions

Shared rules live here:

- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# Agents: auth-microservice

## One-Command Continuation

When the user says:

```text
AUTH ORCHESTRATOR: continue implementation
```

or:

```text
Continue implementation of this project.
```

act as the Auth implementation orchestrator.

Do not ask the user which goal is next. Determine the next action from:

```text
docs/IMPLEMENTATION_STATE.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
implementation-goals/README.md
docs/orchestrator/GOALS.md
```

Then continue from the latest checkpoint.

## Required Reading

Before implementation, branch orchestration, or launching workers, read:

```text
AGENTS.md
TASKS.md
STATE.json
docs/IMPLEMENTATION_STATE.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
docs/UNIFIED_AUTH_CONTRACT.md
docs/ENV_CORS_AND_AUTH_CHECK.md
docs/UNIFIED_AUTH_VERIFICATION.md
docs/orchestrator/MASTER_PROMPT.md
docs/orchestrator/INTENT.md
docs/orchestrator/GOALS.md
docs/orchestrator/PLAN.md
docs/orchestrator/STATUS.md
docs/orchestrator/PROMPTS.md
docs/orchestrator/PROJECT_INVARIANTS.md
docs/orchestrator/PRE_CODING_GATE.md
docs/orchestrator/CONTEXT_PACKAGE.md
docs/orchestrator/EXECUTION_PLAN.md
docs/orchestrator/READINESS_GATES.md
implementation-goals/README.md
```

If a selected goal has a file under `implementation-goals/`, read that file too.

## Core Intent

```text
Auth is the Statex ecosystem identity and access authority.
Preserve one trusted identity, login, JWT, refresh token, RBAC, OAuth, magic-link, registered-user preference, and service-authentication boundary.
The orchestrator coordinates goals, plans, execution chunks, validation, status updates, and worker handoffs from repository state.
Ask the owner only for true blockers, scope decisions, production deployment approval, or cross-service ownership decisions.
No catalog, warehouse, orders, payment, leads, marketing sending, notification sending, logging storage, database infrastructure, or gateway ownership moves into Auth.
No secrets, credentials, JWTs, OAuth tokens, magic-link tokens, reset tokens, or passwords in docs, logs, prompts, reports, URLs, frontend bundles, or git.
```

## Remote Work Rule

All implementation and commit work for Auth happens on the remote server only:

```text
ssh alfares
cd /home/ssf/Documents/Github/auth-microservice
```

Do not treat the local `/Users/Sergej.Stasok/Documents/auth` snapshot as the source of truth for future code changes. Use it only as temporary context if needed. Make code and documentation changes in `/home/ssf/Documents/Github/auth-microservice` on `alfares`, and commit completed work there.

## Orchestrator Duties

1. Read `docs/IMPLEMENTATION_STATE.md`.
2. Identify the active goal, next ready goal, blocked checkpoint, or owner-selected goal.
3. Use `implementation-goals/README.md` and `docs/orchestrator/GOALS.md` as the goal roadmap.
4. Create or update an execution plan from `implementation-goals/templates/EXECUTION_PLAN.md` before coding.
5. Use context packages and coding prompts for implementation work that may be delegated.
6. Keep write ownership disjoint when using workers or subagents.
7. Update `docs/IMPLEMENTATION_STATE.md` and `docs/orchestrator/STATUS.md` after every implementation session.
8. Require an Intent Compliance Report before marking a goal complete.
9. Run or document validation before moving to the next goal.
10. Preserve Auth ownership boundaries and secret-handling rules.

## Intent Preservation Workflow (mandatory)

Before implementation work, read the Auth orchestrator pack:

- `docs/orchestrator/MASTER_PROMPT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/PROMPTS.md`
- `docs/orchestrator/PROJECT_INVARIANTS.md`
- `docs/orchestrator/PRE_CODING_GATE.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/READINESS_GATES.md`

Work on the earliest active or pending goal unless `docs/IMPLEMENTATION_STATE.md` names an active checkpoint or the owner explicitly selects another goal. Preserve Auth ownership: identity, login, JWT, refresh tokens, RBAC, OAuth, magic links, registered-user communication preferences, and service authentication boundaries. Do not move catalog, warehouse, orders, payment, lead, marketing, notification sending, logging, database, or gateway ownership into Auth.

Before coding, perform the Auth intent-preservation pre-coding gate:

1. Confirm the selected goal and chunk in `docs/orchestrator/GOALS.md` or `implementation-goals/`.
2. Build or refresh the bounded context package in `docs/orchestrator/CONTEXT_PACKAGE.md`.
3. Confirm applicable invariants in `docs/orchestrator/PROJECT_INVARIANTS.md`.
4. Fill the task execution plan in `docs/orchestrator/EXECUTION_PLAN.md` or the selected `implementation-goals/` execution plan.
5. Run the checks named by `docs/orchestrator/PRE_CODING_GATE.md`.
6. Code only after the gate decision is `pass` or after the owner explicitly accepts a documented exception.

Record verification evidence in `docs/orchestrator/STATUS.md` and compressed continuation state in `docs/IMPLEMENTATION_STATE.md` after each completed chunk. If a task needs ecosystem architecture context, query docs-rag-microservice first and summarize the retrieved source headings before editing.

## Knowledge Retrieval (query before reading files)
Query the RAG service first — saves 2000-5000 tokens per query:
- URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Endpoint: `POST /retrieval/agent-context` with `{"query": "...", "maxTokens": 3000}`
- Auth: `Authorization: Bearer <JWT_TOKEN>`

Remote SSH shells are not expected to export `JWT_TOKEN`. Use the running Auth pod, where
`JWT_TOKEN` is projected from `auth-microservice-secret`, for authenticated DocsRAG queries.
Do not print the token value.

```bash
kubectl -n statex-apps exec deployment/auth-microservice -- node -e '
const token = process.env.JWT_TOKEN;
if (!token) { console.error("JWT_TOKEN_ENV_MISSING"); process.exit(2); }
fetch("http://docs-rag-microservice:3397/retrieval/agent-context", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  body: JSON.stringify({ query: "your question here", maxTokens: 3000 })
}).then(async (res) => {
  console.log("HTTP " + res.status);
  console.log(await res.text());
  process.exit(res.ok ? 0 : 1);
}).catch((err) => { console.error(err.message); process.exit(1); });
'
```

N/A — infrastructure service. No AI agent coordination.

## Active Agents
<!-- Coordinator-maintained -->
None.
