# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: done
- owner: owner-approved
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: validated
- upstream: docs/IMPLEMENTATION_STATE.md, docs/orchestrator/CONTEXT_PACKAGE.md, docs/orchestrator/PROJECT_INVARIANTS.md, docs/UNIFIED_AUTH_CONTRACT.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-approved Goal 09: Auth Contract Production Smoke Verification.

Current chunk: verify the live Auth production surface after the completed `AUTH-ALPHA-01` and `RBAC-REM-07` deployment, without making runtime or deployment changes.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Owner selection: user accepted the recommended Auth contract/production smoke verification task on 2026-06-13.
- Goal file: `implementation-goals/GOAL-09-auth-contract-production-smoke-verification.md`
- Contract source: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification source: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Environment source: `docs/ENV_CORS_AND_AUTH_CHECK.md`

## Goal Impact

This task strengthens Auth operational confidence after deployment by proving key production entry points and contract checks are reachable and safely handled. It does not change Auth behavior.

## Project Invariants

- AUTH-INV-001: applies. Verification confirms Auth remains identity, JWT, OAuth, magic-link, RBAC, and hosted-flow authority.
- AUTH-INV-002: applies. No non-Auth domain ownership moves into Auth.
- AUTH-INV-003: applies. Contract behavior is smoke-checked; no API/JWT/RBAC/OAuth/magic-link/redirect/CORS/internal-service contract change is planned.
- AUTH-INV-004: applies. Verification must not record secrets, tokens, passwords, raw production user data, or decoded secret material.
- AUTH-INV-005: applies. Hosted Auth login/register/admin entry points are verified.
- AUTH-INV-006: applies. Evidence must be recorded in status and continuation state.
- AUTH-INV-007: applies. DocsRAG is queried from the Auth pod before verification evidence is finalized.

## Sensitive-Data Handling

Classification: synthetic and public metadata only.

Allowed evidence: HTTP status codes, command names, safe endpoint paths, build/syntax results, and response summaries for synthetic invalid-token and redirect-validation checks.

Forbidden evidence: decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, internal-service tokens, API keys, Authorization header values, or raw production user data.

## Contract Validation Plan

Contract impact: none. This is verification-only.

Expected behavior:

- Production health returns `ok`.
- Hosted `/login`, `/register`, and `/admin` return reachable HTTPS responses.
- `POST /auth/validate` handles a synthetic invalid token without exposing token material.
- `GET /auth/validate-return-url` handles safe HTTPS URL validation without token handoff.
- Build and frontend syntax checks pass against the current deployed source state.

## Scope

Allowed documentation/state files:

- `implementation-goals/GOAL-09-auth-contract-production-smoke-verification.md`
- `implementation-goals/README.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `TASKS.md`
- `STATE.json`

## Non-Goals

- No Auth runtime code changes.
- No consumer runtime code changes.
- No endpoint, JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, or database changes.
- No deployment.
- No use of real credentials or production user data.

## Validation Plan

- Query DocsRAG from the Auth pod with the pod `JWT_TOKEN`, without printing the token.
- Run `npm run build`.
- Run `node --check web/public/js/admin.js`.
- Run inline hosted login page script syntax extraction.
- Run production HTTPS checks for `/health`, `/login`, `/register`, and `/admin`.
- Run synthetic invalid-token validation against `/auth/validate`.
- Run safe redirect validation against `/auth/validate-return-url`.
- Run `git diff --check`.
- Run gate-critical missing-marker scan.
- Run documentation secret-pattern scan.

## Completion Checklist

- [x] Owner selected Goal 09.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package refreshed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] DocsRAG queried successfully.
- [x] Verification commands run.
- [x] Evidence recorded.
- [x] Goal marked complete.
