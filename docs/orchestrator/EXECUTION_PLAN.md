# Auth Execution Plan

YAML metadata:

- id: AUTH-EXECUTION-PLAN
- status: validated-source
- owner: owner-selected-profile-single-source-audit
- created: 2026-07-01
- last_updated: 2026-07-01
- completeness_level: bounded
- upstream: user production request, docs/UNIFIED_AUTH_CONTRACT.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-selected Auth profile single-source audit and contract hardening: verify that registered user identity/contact data is stored in Auth and make `/auth/profile` an explicit sanitized Auth database profile read for consuming services after hosted Auth handoff.

## Upstream Traceability

- Vision: Auth remains the Statex ecosystem identity and access authority.
- Goal impact: a user who registers in one Alfares application can have their Auth-owned profile fields read by another application through the shared Auth contract instead of re-entering or forking profile data.
- System: Auth `users` table, hosted Auth handoff, `/auth/validate`, `/auth/profile`, and Bazos hosted Auth consumer bridge.
- Feature: canonical registered-user profile read.
- Task: inspect profile persistence/response paths, patch `/auth/profile` to use a fresh sanitized Auth DB read, add regression coverage, document the consumer contract, and record evidence.
- Coding prompt: patch only Auth profile contract/source/tests/docs; do not expose secrets, tokens, passwords, or raw production user data.
- Validation: focused Auth contract tests, hosted Auth contract suite, build, lint, diff-check, DocsRAG query result, and read-only Bazos consumer spot check.

## Project Invariants

- AUTH-INV-001 applies: Auth keeps ownership of identity, login, JWT, refresh tokens, registered-user preferences, and service authentication.
- AUTH-INV-002 applies: Bazos platform account/session/identity data stays in Bazos; no catalog, warehouse, orders, payment, lead, marketing, notification, logging, database, or gateway ownership moves into Auth.
- AUTH-INV-003 applies: no JWT shape, RBAC, OAuth, magic-link, CORS, internal-service, database schema, or breaking endpoint contract change.
- AUTH-INV-004 applies: no secrets, tokens, passwords, decoded JWTs, raw production user data, Bazos cookies, or session payloads are recorded.
- AUTH-INV-005 applies: hosted Auth remains the supported login/register surface.
- AUTH-INV-006 applies: validation evidence is recorded in status and implementation state.
- AUTH-INV-007 applies: DocsRAG was queried from the running Auth pod; it returned HTTP 200 with no matching context/sources for the specific profile query.

## Sensitive-Data Handling

Classification: synthetic plus source metadata. Tests use synthetic user fields only. Bazos inspection was source-only and did not read production DB rows, cookies, sessions, JWT values, or token values.

Allowed evidence: file paths, route paths, field names, command pass/fail summaries, source-only consumer behavior summaries.

Forbidden evidence: secret values, JWTs, refresh tokens, OAuth tokens, reset tokens, magic-link tokens, passwords, raw production user rows, Bazos platform cookies, Bazos session envelopes, Authorization values, or decoded runtime config.

## Contract Impact

`GET /auth/profile` now explicitly calls `AuthService.getProfile(req.user.id)`, which reads the current Auth DB user and returns `sanitizeUser(user)`. This clarifies and hardens the existing profile endpoint as the canonical sanitized Auth profile read. JWT payload shape, `/auth/validate`, `/auth/register`, `/auth/login`, refresh tokens, OAuth, magic links, RBAC, CORS, internal-service contracts, database schema, and consumer-service source are unchanged.

## Scope

Allowed files:

- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth-contract.spec.ts`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

## Parallel Execution

- Workstream: Auth profile endpoint hardening. Status: complete. Owner role: Auth backend. Files: `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`.
- Workstream: Auth contract regression coverage. Status: complete. Owner role: validation. Files: `src/auth/auth-contract.spec.ts`.
- Workstream: consumer spot check. Status: complete, read-only. Owner role: integration auditor. Files inspected in `bazos-service`; no edits.
- Integration owner: original thread. Validation owner: original thread. Merge order: Auth source, Auth tests, Auth docs/status. No separate workers were launched because the code edit is small and only Auth files were changed; Bazos inspection stayed read-only.

## Validation Plan And Evidence

- DocsRAG query from running Auth pod: HTTP 200, no matching context/sources returned for the specific Hevrike/Bazos profile query.
- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts`: passed, 8 tests.
- `npm run test:auth-contract`: passed, 3 suites and 19 tests.
- `npm run build`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Read-only Bazos source spot check: Bazos hosted Auth migration is present; `/ui/auth/me` calls Auth validation and returns `validation.user`; Bazos local `BazosAccount` and `BazosIdentity` remain Bazos-platform entities, not global Auth profile ownership.

## Deployment Plan

Production deployment was not performed in this session. Deploy only after explicit owner approval:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && ./scripts/deploy.sh'
```

Post-deploy checks should include Auth `/health`, `/auth/profile` with an owner-provided test token or approved synthetic flow, and a Bazos `/ui/auth/me` profile read through the hosted Auth callback path.

## Current Execution Addendum - 2026-07-02 Hosted Auth Form Fail-Closed Hardening

Selected goal and chunk: owner-selected production hardening for hosted Auth login/register form fallback after Catalog loop report.

Pre-coding gate decision: pass. The work is traceable to the owner report, preserves Auth ownership of hosted credential UI, and reduces secret-safety risk by preventing native GET submission of credential fields before `return_url` validation.

Sensitive-data handling: synthetic browser accounts only; no token/password values in docs or reports.

Contract impact: no API, JWT, RBAC, OAuth, magic-link, CORS, internal-service, database schema, or consumer-service contract change. Hosted UI behavior is hardened so the form is disabled/fail-closed until `return_url` validation succeeds and native submit cannot leak credential fields or lose `state`.

Allowed files:

- `web/public/index.html`
- `src/auth/hosted-auth-web.spec.ts`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

Validation plan:

- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`
- `node --check web/server.js`
- `node --check web/public/js/admin.js`
- `git diff --check`

## Current Execution Addendum - 2026-07-02 Auth Customer Data Wallet A1 Source Implementation

Selected goal and chunk: Goal 10.1-10.5 - implement Auth storage model,
delivery address book API, invoice profile API, checkout aggregate, contract
docs, and regression coverage.

Pre-coding gate decision: pass. DocsRAG was queried from the running Auth pod
and returned broad ecosystem ownership context with no existing address-book or
invoice-profile contract. Subagent evidence and source inspection resolved the
production schema path: live `DB_SYNC=false`, no migration runner, and existing
precedent is source-only idempotent SQL. Runtime SQL apply remains blocked until
owner approval.

Sensitive-data handling: synthetic tests and source/docs only. No production
user rows, customer addresses, invoice data, decoded JWTs, secrets, token
values, passwords, or raw customer logs are read or recorded.

Contract impact: additive Auth endpoints under `/auth/profile/...`; no JWT
shape, RBAC, OAuth, magic-link, CORS, internal-service, token, credential, or
consumer-service contract changes.

Allowed files:

- `scripts/create-customer-data-wallet-tables.sql`
- `src/users/entities/user-delivery-address.entity.ts`
- `src/users/entities/user-invoice-profile.entity.ts`
- `src/auth/dto/delivery-address.dto.ts`
- `src/auth/dto/invoice-profile.dto.ts`
- `src/users/users.module.ts`
- `src/users/users.service.ts`
- `shared/database/database.module.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth-contract.spec.ts`
- `src/info/info.controller.ts`
- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

Parallel execution:

- Auth A1 source implementation: active in original thread, write scope Auth
  source/docs/tests only.
- Auth schema/deploy-path explorer: complete, read-only.
- Consumer readiness monitor: complete, read-only.
- FlipFlop implementation: dependency-gated until Auth source validates and
  deployment gate is approved.
- Orders implementation: blocked by unrelated dirty worktree/event-contract
  changes plus Auth/FlipFlop dependency.

Validation plan:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`
- documentation missing-marker scan, allowing documented blockers only
- documentation/source secret-pattern scan

Deployment plan:

- Do not deploy in this source implementation pass.
- Do not apply `scripts/create-customer-data-wallet-tables.sql` without owner
  approval for live DB migration apply and schema-only verification.
- `npm run build`
- `npm run lint`
- deploy with `./scripts/deploy.sh` after source validation
- post-deploy hosted register/login browser CDP flow and fail-closed race check

## Current Execution Addendum - 2026-07-02 Auth Customer Data Wallet Planning

Selected goal and chunk: Goal 10.0 - plan Auth-owned profile, delivery address book, invoice profile, and cross-repo checkout selector rollout.

Pre-coding gate decision: pass for documentation-only planning. Runtime coding is blocked until Goal 10.1 resolves `[MISSING: production-safe Auth schema migration path]`.

Sensitive-data handling: source and docs only. No production user rows, addresses, invoices, tokens, passwords, decoded JWTs, secrets, or raw customer payloads are read or recorded.

Contract impact: planned additive Auth APIs for address book, invoice profiles, and checkout aggregate. Existing JWT, RBAC, OAuth, magic-link, hosted token handoff, CORS, internal-service, and `/auth/profile` contracts remain unchanged in this planning pass.

Allowed files:

- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `implementation-goals/README.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `TASKS.md`

Parallel execution:

- Auth backend/storage is first and contract-blocking.
- FlipFlop backend bridge and frontend selectors are dependency-gated on Auth APIs.
- Orders compatibility is dependency-gated on Auth/FlipFlop payload shape.
- Rent-a-box gets a separate hosted Auth migration plan due local credential/profile duplication.
- Chytrakoupe and Cliplot are later checkout lanes.
- Marketplace services remain audit-only unless a customer checkout surface is confirmed.

Validation plan:

- `find docs implementation-goals -maxdepth 3 -type f \\( -name '*CUSTOMER_DATA_WALLET*' -o -name '*customer-data-wallet*' -o -name 'GOAL-10-auth-customer-data-wallet.md' \\) -print`
- `rg '\\[(MISSING|UNKNOWN):' docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md implementation-goals/GOAL-10-auth-customer-data-wallet.md docs/orchestrator/GOALS.md docs/orchestrator/PLAN.md`
- `rg -n 'Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}|(access[_-]?token|client[_-]?secret|password|private[_-]?key)\\s*[:=]\\s*['\"'\"'\"]?[A-Za-z0-9_./+=:-]{12,}' docs implementation-goals AGENTS.md TASKS.md`
- `git diff --check`
