# Auth Orchestrator Master Prompt

You are working on `auth-microservice`, the identity and access authority for the Statex ecosystem.

## Preserved Intent

Auth exists to provide one trusted identity, login, JWT, refresh-token, RBAC, OAuth, magic-link, registered-user communication-preference, and service-authentication boundary for all ecosystem services and admin panels.

## Non-Negotiable Boundaries

- Auth owns identity, credentials, JWT shape, refresh tokens, OAuth, magic links, RBAC, registered-user preferences and consent flags, and service-to-service auth contracts.
- Auth never owns product truth, stock, orders, payment identity, lead records for non-registered contacts, marketing campaign execution, notification sending, logs storage, database infrastructure, or gateway routing.
- Consumers must use Auth APIs or JWT validation contracts instead of copying login forms, storing passwords, or writing Auth-owned data directly.
- JWT secrets and OAuth/client secrets must stay in Vault-backed runtime configuration. Never write secrets to docs, logs, frontend bundles, or git.
- Admin-facing token handling must minimize exposure: allow copying only for authenticated admins, do not put tokens in URLs, and keep tokens masked unless the user explicitly reveals them.
- Production changes must be verified before deployment; no direct database writes to user tables by agents.

## State-Driven Orchestrator Workflow

Auth follows the same master-agent pattern as Goalkeeper. One orchestrator agent owns continuation, goal selection, plan decomposition, worker coordination, validation, and status updates.

Continuation is driven by repository state, not chat history:

- `docs/IMPLEMENTATION_STATE.md` is the current checkpoint and next-action source.
- `docs/IMPLEMENTATION_ORCHESTRATOR.md` is the master session prompt.
- `implementation-goals/README.md` is the executable goal index.
- `implementation-goals/templates/*` define execution plans, context packages, coding prompts, and validation reports.
- `docs/orchestrator/STATUS.md` remains the dated evidence log for completed chunks.

## Required Workflow For Every Session

1. Read `AGENTS.md`, `TASKS.md`, `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `implementation-goals/README.md`, stable contract docs, and this orchestrator pack. If `BUSINESS.md`, `SYSTEM.md`, or `README.md` exist, read them too.
2. Query docs-rag-microservice for ecosystem architecture or contract context before reading broad source trees.
3. Identify the active goal from `docs/IMPLEMENTATION_STATE.md`; otherwise identify the earliest active or pending goal in `docs/orchestrator/GOALS.md`, unless the owner explicitly selects another goal.
4. Restate the preserved intent and ownership boundary affected by the selected goal.
5. Build the bounded context package in `docs/orchestrator/CONTEXT_PACKAGE.md` or the selected `implementation-goals/` context package.
6. Confirm applicable invariants in `docs/orchestrator/PROJECT_INVARIANTS.md`.
7. For coding work, create or update an execution plan from `implementation-goals/templates/EXECUTION_PLAN.md` or `docs/orchestrator/EXECUTION_PLAN.md` before editing code.
8. Run the pre-coding gate in `docs/orchestrator/PRE_CODING_GATE.md`.
9. Implement the smallest complete chunk that satisfies the goal acceptance criteria.
10. Run the verification commands named by the goal and readiness gates.
11. Append dated evidence to `docs/orchestrator/STATUS.md`.
12. Update compressed continuation state in `docs/IMPLEMENTATION_STATE.md`.
13. Leave the next unfinished chunk clearly named.

## Intent Preservation System Mapping

Auth uses a compact service-local IPS pack instead of duplicating the full company IPS directory tree. The mapping is:

| IPS layer | Auth source of truth |
| --- | --- |
| Constitution and immutable intent | `docs/orchestrator/INTENT.md` |
| Business and task backlog | `TASKS.md`, `docs/orchestrator/GOALS.md`, `implementation-goals/README.md` |
| System and contract model | `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md` |
| Project invariants | `docs/orchestrator/PROJECT_INVARIANTS.md` |
| Execution plan | `docs/orchestrator/EXECUTION_PLAN.md`, `implementation-goals/templates/EXECUTION_PLAN.md` |
| Context package | `docs/orchestrator/CONTEXT_PACKAGE.md`, `implementation-goals/templates/CONTEXT_PACKAGE.md` |
| Coding prompts | `docs/orchestrator/PROMPTS.md`, `implementation-goals/templates/CODING_PROMPT.md` |
| Validation and readiness evidence | `docs/orchestrator/STATUS.md`, `docs/orchestrator/READINESS_GATES.md`, `implementation-goals/templates/VALIDATION_REPORT.md` |

Code generation from vague intent is not allowed. A task must have upstream traceability, invariant impact, sensitive-data classification, contract impact, validation plan, and gate decision before coding starts.

## Completion Standard

A goal is complete only when:

- Its acceptance criteria are met by code, docs, tests, or runtime evidence.
- Evidence is recorded in `docs/orchestrator/STATUS.md`.
- `npm run build` passes when backend TypeScript changes are made.
- Frontend changes are checked with syntax/runtime validation and deployed UI verification when deployment is requested.
- Any changed auth/security behavior has a test or direct API verification note.
- The pre-coding and readiness checks have pass evidence or a documented owner-approved exception.
