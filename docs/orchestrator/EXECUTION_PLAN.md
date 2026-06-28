# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: validated-not-deployed
- owner: owner-selected-reset-password-ux-fix
- created: 2026-06-28
- last_updated: 2026-06-28
- completeness_level: bounded
- upstream: user production request, docs/UNIFIED_AUTH_CONTRACT.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-selected hosted reset-password UX fix: after password reset success, remove the visible new-password fields from the page, and make the `Back to login` link safe so it does not immediately show `Missing required query parameter: return_url`.

## Upstream Traceability

- Vision: Auth remains the Statex identity and hosted credential authority.
- Goal impact: users who complete password reset see only success state and can navigate back to hosted login without a confusing query-parameter error.
- System: hosted `web/public/index.html` served by Auth backend/web.
- Feature: hosted password reset UI.
- Task: update client-side reset success rendering and reset-page login link behavior; keep API contracts unchanged.
- Coding prompt: patch only hosted Auth UI/test/docs; do not expose secrets, tokens, passwords, or raw production user-data.
- Validation: hosted Auth focused Jest test, inline script syntax check, web server syntax check, TypeScript build, and diff-check.

## Project Invariants

- AUTH-INV-001 applies: Auth keeps ownership of identity, credentials, hosted login, and password reset.
- AUTH-INV-002 applies: no catalog, warehouse, orders, payment, lead, marketing, notification, logging, database, or gateway ownership moves into Auth.
- AUTH-INV-003 applies: no API, JWT, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database, or consumer-service contract changes.
- AUTH-INV-004 applies: no secrets, passwords, JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, API keys, or raw production user-data may be recorded.
- AUTH-INV-005 applies: hosted Auth remains the supported credential UI.
- AUTH-INV-006 applies: evidence is recorded in status and implementation state.
- AUTH-INV-007 not applicable: no broad architecture or cross-service contract decision.

## Sensitive-Data Handling

Classification: no production data. The implementation uses only UI source, route names, and synthetic/static test assertions.

Allowed evidence: file paths, route paths, query parameter names, command pass/fail summaries.

Forbidden evidence: secret values, tokens, passwords, decoded runtime config, raw production user rows, Authorization values, or real reset links.

## Contract Impact

No Auth API contract change. `POST /auth/password-reset-confirm` remains unchanged. Password reset tokens, token expiry, reset email generation, JWT payloads, refresh tokens, OAuth, magic links, RBAC, CORS, internal service contracts, database schema, redirect allowlist, and consumer-service behavior remain unchanged.

Hosted UI impact: after successful reset confirmation, the password input rows and submit button are hidden. The reset page's `Back to login` link preserves `return_url`, `client_id`, and `state` when present, and a plain `/login` load no longer shows an immediate missing-parameter error before user action.

## Scope

Allowed files:

- `web/public/index.html`
- `src/auth/hosted-auth-web.spec.ts`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

## Parallel Execution

- Workstream: hosted reset UI behavior. Status: complete. Owner role: Auth frontend. Files: `web/public/index.html`.
- Workstream: focused hosted web regression coverage. Status: complete. Owner role: validation. Files: `src/auth/hosted-auth-web.spec.ts`.
- Integration owner: original thread. Validation owner: original thread. Merge order: UI first, test second, docs last. No separate workers were launched because this is a narrow two-source-file UI fix.

## Validation Plan And Evidence

- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`: passed, 6 tests.
- `git diff --check`: passed.
- `npm run build`: passed.
- `node --check web/server.js`: passed.
- Extracted inline script from `web/public/index.html` to `/tmp/auth-hosted-inline-check.js`; `node --check /tmp/auth-hosted-inline-check.js`: passed.

## Deployment Plan

Production deployment is pending explicit owner approval. After approval, run `./scripts/deploy.sh`, then verify `https://auth.alfares.cz/reset-password?token=synthetic-ui-check` returns the hosted reset page and `https://auth.alfares.cz/login` does not render the old immediate missing-`return_url` error.
