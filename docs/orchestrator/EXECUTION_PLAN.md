# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: validated-not-deployed
- owner: owner-selected-admin-users-enhancement
- created: 2026-06-28
- last_updated: 2026-06-28
- completeness_level: bounded
- upstream: user production request, docs/UNIFIED_AUTH_CONTRACT.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-selected admin enhancement: add search and filters to `/admin` Users, including application-based filtering, an app-admin-only filter, per-user application admin visibility, and a grouped Application admins overview for every registered application.

## Upstream Traceability

- Vision: Auth remains the Statex identity, RBAC, user-role, and application-role authority.
- Goal impact: Auth administrators can find users by identity metadata, filter by application membership, and audit which users hold application admin roles.
- System: NestJS Auth backend plus hosted `web/public/admin.html` admin UI.
- Feature: admin user management and role visibility.
- Task: extend read-only admin list APIs and UI controls without changing role assignment semantics.
- Coding prompt: patch only admin user list/query/UI/docs; do not expose secrets, tokens, passwords, or raw production user-data dumps.
- Validation: DocsRAG query, TypeScript build, lint, admin JS syntax check, focused hosted web test, and diff-check.

## Project Invariants

- AUTH-INV-001 applies: Auth keeps ownership of identity, RBAC, applications, and service-authentication boundaries.
- AUTH-INV-002 applies: no catalog, warehouse, orders, payment, lead, marketing, notification, logging, database, or gateway ownership moves into Auth.
- AUTH-INV-003 applies: existing Auth API, JWT, RBAC assignment, OAuth, magic-link, redirect, CORS, and internal-service contracts remain compatible; only read-only admin query/reporting shape is extended.
- AUTH-INV-004 applies: no secrets, passwords, JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, API keys, or raw production user-data dumps may be recorded.
- AUTH-INV-005 applies: hosted Auth admin remains the central admin surface.
- AUTH-INV-006 applies: evidence is recorded in status and implementation state.
- AUTH-INV-007 applies: DocsRAG was queried from the Auth pod and returned HTTP 200 with no matching source headings.

## Sensitive-Data Handling

Classification: admin metadata shape only. Validation did not print production user rows, secrets, tokens, passwords, or Authorization values.

Allowed evidence: file paths, route paths, query parameter names, command results, HTTP status summaries.

Forbidden evidence: secret values, tokens, passwords, decoded runtime config, raw production user rows, or admin credentials.

## Contract Impact

Admin API impact: `GET /auth/admin/users` accepts optional `search`, `applicationId`, `status`, `verified`, and `adminOnly=yes` query parameters and returns application summary fields for listed users. `GET /auth/admin/users/application-admins` returns applications with users who hold application-scoped admin roles.

No JWT, refresh token, RBAC assignment, OAuth, magic-link, password reset, redirect allowlist, CORS, internal-service, database schema, or consumer-service contract changes.

## Scope

Allowed files:

- `src/auth/admin-users.controller.ts`
- `src/users/users.service.ts`
- `web/public/admin.html`
- `web/public/js/admin.js`
- `web/public/css/style.css`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

## Parallel Execution

- Workstream: backend admin query/reporting API. Status: complete. Owner role: Auth backend. Files: `src/auth/admin-users.controller.ts`, `src/users/users.service.ts`.
- Workstream: hosted admin UI controls and rendering. Status: complete. Owner role: Auth frontend. Files: `web/public/admin.html`, `web/public/js/admin.js`, `web/public/css/style.css`.
- Integration owner: original orchestrator thread. Validation owner: original orchestrator thread. Merge order: backend first, UI second, docs last. No separate workers were launched because the touched files were tightly coupled and small.

## Validation Plan And Evidence

- DocsRAG query from `deployment/auth-microservice` without printing `JWT_TOKEN`: HTTP 200, no matching headings.
- `npm run build`: passed.
- `npm run lint`: passed.
- `node --check web/public/js/admin.js`: passed.
- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`: passed, 6 tests.
- `git diff --check`: passed.

## Deployment Plan

Production deployment is not run in this session until the owner explicitly approves it.
