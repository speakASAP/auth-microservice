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

Owner-approved Auth Alpha implementation chunk: AUTH-ALPHA-01 - hosted token handoff URL normalization.

Implementation task: normalize Auth-hosted login, OAuth, and magic-link token handoff redirects so Auth always writes access-token handoff data into the final URL fragment by replacing any pre-existing caller fragment instead of appending a second `#`.

## Upstream Traceability

- Original intent: docs/orchestrator/INTENT.md
- Current state: docs/IMPLEMENTATION_STATE.md
- Owner selection: user selected "Alpha implementation chunk" and clarified "Auth" on 2026-06-13.
- Contract source: docs/UNIFIED_AUTH_CONTRACT.md hosted entry points, OAuth contract, magic-link contract, redirect allowlist, and client responsibilities.
- Verification source: docs/UNIFIED_AUTH_VERIFICATION.md.

## Goal Impact

This chunk strengthens Auth as the hosted login and token handoff authority. It keeps token delivery in URL fragments, preserves state handoff, and avoids malformed redirect URLs when a caller accidentally includes its own fragment in `return_url`.

## Project Invariants

- AUTH-INV-001: applies. Auth remains identity, JWT, OAuth, magic-link, and token handoff authority.
- AUTH-INV-002: applies. No non-Auth domain ownership moves into Auth.
- AUTH-INV-003: applies. API/JWT shape is unchanged; redirect construction is made safer while preserving fragment handoff.
- AUTH-INV-004: applies. Tests and docs must not contain raw JWTs, refresh tokens, magic-link tokens, passwords, OAuth tokens, or secrets.
- AUTH-INV-005: applies. Hosted Auth login/register/OAuth/magic-link flows remain the integration pattern.
- AUTH-INV-006: applies. Evidence must be recorded before closure.
- AUTH-INV-007: applies. DocsRAG was queried before selecting the Auth Alpha implementation surface.

## Sensitive-Data Handling

Classification: synthetic.

Allowed evidence: synthetic token strings, synthetic return URLs, route names, method names, and validation command names.

Forbidden evidence: decoded production secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, passwords, internal-service tokens, API keys, or raw production user data.

## Contract Validation Plan

Contract impact: compatible hardening. Auth still returns tokens in the URL fragment and still validates `return_url` through the existing allowlist rules. Existing endpoint names, JWT payload, OAuth provider routes, magic-link routes, CORS behavior, and internal-service contracts are unchanged.

Expected behavior:

- Hosted email/password UI redirects to the validated return URL with a single final fragment containing handoff values.
- OAuth callback redirects to the validated return URL with a single final fragment containing handoff values.
- Magic-link verify redirects to the validated return URL with a single final fragment containing handoff values.
- If a caller supplied a `return_url` with an existing fragment, Auth replaces that fragment with the token handoff fragment rather than appending another `#`.

## Scope

Allowed Auth runtime files:

- `src/auth/auth.service.ts`
- `web/public/index.html`
- `src/auth/auth-token-handoff.spec.ts`

Allowed Auth documentation/state files:

- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/orchestrator/GOALS.md`
- `TASKS.md`
- `STATE.json`

## Non-Goals

- No JWT payload changes.
- No Auth endpoint path changes.
- No OAuth provider credential or provider-scope changes.
- No magic-link token storage changes.
- No redirect allowlist expansion.
- No production deployment.
- No production user-data reads or writes.

## Validation Plan

- Run DocsRAG query for Auth hosted-flow/token handoff context.
- Add focused unit tests for token handoff URL construction.
- Run `npm test -- --runTestsByPath src/auth/auth-token-handoff.spec.ts`.
- Run `npm run build`.
- Run `node --check web/public/js/admin.js`.
- Run syntax check for the inline login page script via Node extraction.
- Run `git diff --check` for changed Auth files.
- Run Auth missing-marker and secret-pattern documentation scans.

## Completion Checklist

- [x] Owner selected Auth Alpha.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] DocsRAG queried successfully from the Auth pod.
- [x] Token handoff URL normalization implemented.
- [x] Verification evidence recorded.
- [x] Next chunk named.
