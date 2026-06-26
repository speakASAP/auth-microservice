# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: validated-pending-deploy
- owner: owner-reported-production-defect
- created: 2026-06-26
- last_updated: 2026-06-26
- completeness_level: bounded
- upstream: user production report, docs/UNIFIED_AUTH_CONTRACT.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-reported production defect: emailed password reset links land on `GET /reset-password`, which currently returns `Cannot GET /reset-password`.

Current chunk: restore the Auth-hosted reset-password page route and form without changing token generation, token storage, JWT payloads, redirect allowlists, CORS, OAuth, magic-link, RBAC, database schema, or consumer-service ownership.

## Upstream Traceability

- Vision: Auth remains the Statex identity and credential authority.
- Goal impact: users who receive password reset email can complete the existing Auth-owned reset-token flow.
- System: NestJS Auth backend plus hosted `web/public/index.html` Auth UI.
- Feature: password reset request and confirmation.
- Task: serve `/reset-password` and add hosted UI mode that submits to `/auth/password-reset-confirm`.
- Coding prompt: patch only hosted Auth route/UI/tests/docs; do not inspect or record real tokens.
- Validation: focused Jest contract test, build, syntax checks, route probes, diff and doc scans.

## Project Invariants

- AUTH-INV-001 applies: Auth keeps ownership of identity, credentials, and password reset.
- AUTH-INV-002 applies: no non-Auth domain ownership moves into Auth.
- AUTH-INV-003 applies: existing API endpoints stay compatible; only a missing hosted page route is added.
- AUTH-INV-004 applies: no password reset token values, secrets, JWTs, passwords, or production user data may be recorded.
- AUTH-INV-005 applies: the hosted Auth UI owns password reset.
- AUTH-INV-006 applies: evidence is recorded in status and implementation state.
- AUTH-INV-007 applies: DocsRAG was queried from the Auth pod and returned HTTP 200 with no matching sources.

## Sensitive-Data Handling

Classification: public metadata and synthetic-only test strings.

Allowed evidence: file paths, route paths, HTTP statuses, command results, synthetic token string names in tests.

Forbidden evidence: real password reset tokens, JWTs, refresh tokens, OAuth tokens, magic-link tokens, passwords, decoded secrets, Authorization values, or production user records.

## Contract Impact

API contract impact: none. `POST /auth/password-reset-request` and `POST /auth/password-reset-confirm` keep their current request/response shapes.

Hosted Auth impact: `/reset-password?token=...` now serves the hosted Auth page and lets the user set a new password through the existing confirm endpoint.

No JWT, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database schema, or consumer-service contract changes.

## Scope

Allowed files:

- `src/main.ts`
- `web/server.js`
- `web/public/index.html`
- `src/auth/hosted-auth-web.spec.ts`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

## Validation Plan

- DocsRAG query from `deployment/auth-microservice` without printing `JWT_TOKEN`.
- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`
- `npm run build`
- `node --check` for hosted Auth inline script extraction.
- `node --check web/server.js`
- `git diff --check`
- Missing-marker scan for gate-critical docs.
- Documentation secret-pattern scan.
- Production pre-deploy route probe for `/reset-password` to confirm current defect.
- Deployment only after owner approval.
