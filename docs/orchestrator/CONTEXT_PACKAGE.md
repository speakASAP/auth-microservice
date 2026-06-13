# Auth Context Package

```yaml
id: AUTH-CONTEXT-PACKAGE
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-13
completeness_level: validated
upstream:
  - docs/orchestrator/GOALS.md
  - docs/orchestrator/INTENT.md
downstream:
  - docs/orchestrator/EXECUTION_PLAN.md
  - docs/orchestrator/PROMPTS.md
```

## Target Task

Current owner-approved target: Goal 09 - Auth Contract Production Smoke Verification.

Owner approval reason: after `AUTH-ALPHA-01` and `RBAC-REM-07` were deployed to production, the owner accepted a focused follow-up task to verify the live Auth contract surface and record evidence before selecting another implementation chunk.

## Upstream Traceability

- Original Auth intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Current goal/backlog: `docs/orchestrator/GOALS.md`, `implementation-goals/README.md`, `implementation-goals/GOAL-09-auth-contract-production-smoke-verification.md`, and `TASKS.md`
- Auth contract surface: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification standard: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational environment: `docs/ENV_CORS_AND_AUTH_CHECK.md`
- Readiness checks: `docs/orchestrator/READINESS_GATES.md`

## Included Documents

Read before verification:

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
- `implementation-goals/GOAL-09-auth-contract-production-smoke-verification.md`

## Excluded Documents And Data

Do not read, print, or record:

- Decoded Vault or Kubernetes secret values.
- JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, internal-service tokens, API keys, or passwords.
- Raw production user records or production logs containing user data.
- Consuming-service source trees; this goal verifies Auth production surface only.

## Auth Constraints

- Keep Auth as the identity and access authority.
- Do not move non-Auth domain ownership into Auth.
- Do not change Auth runtime behavior, deployment, database state, or contracts during this verification goal.
- Record only command names, HTTP statuses, and safe response summaries.

## Allowed Changes

Documentation and state only:

- `implementation-goals/GOAL-09-auth-contract-production-smoke-verification.md`
- `implementation-goals/README.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `TASKS.md`
- `STATE.json`

## Forbidden Changes

- Auth runtime code.
- Consumer-service code.
- Kubernetes manifests or deployment scripts.
- Secret material, decoded runtime config, production database writes, or production user-data reads.

## Validation Instructions

Run production-safe checks only: build/syntax checks, public HTTPS reachability, synthetic invalid-token validation, redirect validation with safe HTTPS URLs, documentation missing-marker scan, documentation secret-pattern scan, and `git diff --check`.
