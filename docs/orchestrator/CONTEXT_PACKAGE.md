# Auth Context Package

```yaml
id: AUTH-CONTEXT-PACKAGE
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: validated
upstream:
  - docs/orchestrator/GOALS.md
  - docs/orchestrator/INTENT.md
downstream:
  - docs/orchestrator/EXECUTION_PLAN.md
  - docs/orchestrator/PROMPTS.md
```

## Target Task

Current owner-selected target: RBAC-REM-05 - School Committee local-role contract note.

Default fallback target: the active goal in `docs/IMPLEMENTATION_STATE.md`, then the earliest `active` or `pending` goal in `docs/orchestrator/GOALS.md`, then the first ready owner-selected goal in `implementation-goals/README.md`.

Owner selection reason: RBAC-REM-01 through RBAC-REM-04 are complete; the owner selected RBAC-REM-05 to document the School Committee boundary between Auth identity validation and app-local school authorization.

## Upstream Traceability

Every task must trace to:

- Original Auth intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Current goal or backlog item: `docs/orchestrator/GOALS.md`, `implementation-goals/README.md`, and `TASKS.md`
- Auth contract surface when relevant: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification standard: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational environment when relevant: `docs/ENV_CORS_AND_AUTH_CHECK.md`

## Included Documents

Read these before coding:

- `AGENTS.md`
- `TASKS.md`
- `STATE.json`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/orchestrator/MASTER_PROMPT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/PROJECT_INVARIANTS.md`
- `docs/orchestrator/PRE_CODING_GATE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/READINESS_GATES.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/PROMPTS.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/UNIFIED_AUTH_VERIFICATION.md`
- `docs/ENV_CORS_AND_AUTH_CHECK.md`
- selected `implementation-goals/GOAL-XX-*.md`

Inspect source files only after the plan names the expected files. Prefer narrow reads over broad source-tree reading. For RBAC-REM-05, source reads are limited to School Committee auth helpers, local role/approval model references, and the target README documentation file unless validation reveals a direct dependency.

## Excluded Documents

Do not use these as primary authority unless the owner explicitly selects historical research:

- Superseded `docs/agents/*` prompts, except as historical context.
- Raw production logs containing user data or tokens.
- Decoded secrets from Vault or K8s Secrets.
- Consuming-service source trees unless the selected goal is cross-service contract validation.

## Auth Constraints

- Keep Auth as the identity and access authority.
- Do not move non-Auth domain ownership into Auth.
- Do not log, document, expose, or embed secrets or tokens.
- Do not make JWT/RBAC/API/redirect/CORS/OAuth/magic-link/internal-service breaking changes without an explicit migration and validation plan.
- Do not directly write production user tables as an agent shortcut.
- Record evidence in `docs/orchestrator/STATUS.md` and compressed continuation state in `docs/IMPLEMENTATION_STATE.md`.

## Allowed Changes

Allowed files must be named by the selected execution plan before coding. Documentation workflow changes should stay under `docs/orchestrator/`, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `TASKS.md`, `AGENTS.md`, or `implementation-goals/`.

For RBAC-REM-05, allowed cross-service documentation files are limited to:

- `/home/ssf/Documents/Github/school-committee/README.md`

## Forbidden Changes

Unless owner-approved for the selected task, do not modify secrets, decoded runtime configuration, unrelated service domains, or Auth contract docs without a contract-validation plan.

## Agent Prompt

Use `docs/orchestrator/PROMPTS.md` as the canonical prompt source. Pair the universal prompt with the selected goal prompt or an owner-provided task prompt.

## Validation Instructions

Before coding, run the checks in `docs/orchestrator/PRE_CODING_GATE.md`. After coding, run the relevant checks in `docs/orchestrator/READINESS_GATES.md` and record evidence in `docs/orchestrator/STATUS.md`.
