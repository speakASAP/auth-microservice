# Auth Execution Plan

## Goal 10.43 Auth Authenticated Wallet Smoke Harness Source Prep

Selected goal and chunk: Goal 10.43 - source-prepare approval-gated
authenticated Auth wallet CRUD/default/delete smoke harness.

Pre-coding gate decision: pass for source-only harness and documentation. The
owner has not supplied a synthetic account/token, so live authenticated smoke
execution remains blocked.

Intent chain:

- Vision: Auth is the Statex ecosystem source of truth for reusable registered
  customer profile, delivery address, and invoice profile data.
- Goal Impact: the rollout gains a repeatable proof path for authenticated
  wallet persistence before dependent checkout smokes rely on it.
- System: Auth wallet API, guarded smoke runner, approval packet, and Goal 10
  orchestration evidence.
- Feature: synthetic authenticated delivery/invoice wallet CRUD/default/delete
  smoke with cleanup and redacted output.
- Task: add source-only harness and approval packet; do not run authenticated
  endpoints.
- Execution Plan: inspect controller/DTO contract, add default-safe harness,
  document exact approval phrase and command shape, validate source-only mode.
- Coding Prompt: keep output sanitized, require explicit env gates, use only
  synthetic payloads, and do not inspect DB rows/secrets/tokens.
- Code: `scripts/check-customer-data-wallet-authenticated-smoke.js`, package
  script, and Goal 10 docs.
- Validation: syntax check, default no-live run, existing wallet/runtime
  checks, auth contract tests, build, lint, diff-check, and added-line secret
  scan.

Allowed files:

- `package.json`
- `scripts/check-customer-data-wallet-authenticated-smoke.js`
- `docs/orchestrator/2026-07-03-auth-wallet-authenticated-smoke-approval.md`
- Goal 10 status/contract/runbook docs

Forbidden work:

- No authenticated endpoint call.
- No live wallet mutation.
- No DB query/write.
- No deploy or Kubernetes mutation.
- No secret/token/password/JWT/cookie inspection or output.
- No consumer repo source change in this chunk.

YAML metadata:

- id: AUTH-EXECUTION-PLAN
- status: validated-source
- owner: owner-selected-profile-single-source-audit
- created: 2026-07-01
- last_updated: 2026-07-03
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

## Current Execution Addendum - 2026-07-03 Auth Checkout-Data Schema Version

Selected goal and chunk: Goal 10.34 - source-define the stable response
identifier for Auth `GET /auth/profile/checkout-data`.

Pre-coding gate decision: pass. The change is additive, Auth-owned, and needed
by dependency-gated consumer readiness checks. It preserves Auth ownership of
registered-user reusable customer data and does not move Orders, payments,
warehouse, catalog, gateway, logging, notification, or consumer checkout
ownership into Auth.

Intent chain:

- Vision: Auth is the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: consumers can verify the exact Auth wallet checkout-data
  aggregate version before integrating selectors.
- System: Auth `/auth/profile/checkout-data`, Auth service info, contract
  docs, and Goal 10 cross-repo plans.
- Feature: stable checkout-data schema version.
- Task: add a top-level `schemaVersion`, pin it in contract tests and service
  info, update Auth wallet docs/status, and preserve remaining Cliplot gates.
- Coding prompt: additive field only; do not wrap, rename, or remove existing
  checkout-data fields; do not log secrets or customer data.

Sensitive-data handling: source and synthetic tests only. No secrets, token
values, decoded JWTs, cookies, raw production user rows, addresses, invoices,
orders, response bodies, DB values, or live checkout data are read or recorded.

Contract impact: additive top-level field
`schemaVersion: "auth.customer-data-wallet.checkout-data.v1"` on the existing
checkout-data JSON object. Existing `user`, `deliveryAddresses`,
`invoiceProfiles`, and `defaults` fields remain unchanged.

Allowed files:

- `src/auth/auth.service.ts`
- `src/auth/auth-contract.spec.ts`
- `src/info/info.controller.ts`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

Parallel execution:

- Cliplot read-only audit: complete; confirmed stable version identifier is one
  blocker lane only and current Cliplot runtime wallet integration is absent.
- FlipFlop/ChytraKoupe compatibility audit: complete; confirmed additive
  top-level `schemaVersion` is compatible with current source-prepared
  consumers.
- Auth coordinator: implement and validate the Auth source/docs/status change.

Validation plan:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`
- stale stable-version blocker scan across docs and implementation goals
- targeted dangerous literal-secret scan on changed source/docs

## Current Execution Addendum - 2026-07-03 Cliplot Schema-Version Readiness Refresh

Selected goal and chunk: Goal 10.35 - update Cliplot-owned source-only
readiness docs/verifier to consume Auth checkout-data schema version
`auth.customer-data-wallet.checkout-data.v1`.

Pre-coding gate decision: pass. The work is documentation/verifier-only in the
consumer lane, preserves Auth as the wallet source of truth, and keeps Cliplot
runtime wallet integration blocked until selector/session/PII, exact
response-shape/mapping, and guest fallback decisions are approved.

Intent chain:

- Vision: Auth is the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: Cliplot no longer carries the stable-version unknown after Auth
  Goal 10.34, while unsafe runtime selector work remains blocked.
- System: Cliplot source-only readiness verifier and Auth Goal 10 coordinator
  plans.
- Feature: dependency-gated Cliplot checkout wallet readiness.
- Task: replace the stale stable-version blocker with the Auth-defined schema
  version and preserve the remaining gates.
- Coding prompt: source-only verifier/docs; no live calls, runtime wallet
  fetches, checkout mutation, DB, deploy, secrets, tokens, cookies, or
  production customer/order data.

Sensitive-data handling: source files and validation metadata only. No secrets,
token values, decoded JWTs, cookies, raw production user rows, addresses,
invoices, orders, response bodies, DB values, or live checkout data are read or
recorded.

Contract impact: Cliplot verifier now records
`authWalletResponseContract.checkoutDataSchemaVersion=auth.customer-data-wallet.checkout-data.v1`.
It does not enable runtime wallet calls or approve selector behavior.

Parallel execution:

- Cliplot read-only audit subagent: complete; identified exact stale blocker
  references and validation commands.
- Auth coordinator: integrated the three-file Cliplot source-only patch,
  validated, committed Cliplot, and refreshed Auth coordinator docs.

Validation plan:

- Cliplot `npm run readiness:auth-wallet-checkout`
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js`
- Cliplot `npm run check`
- Cliplot `git diff --check`
- Cliplot stale stable-version blocker scan
- Cliplot targeted dangerous literal-secret scan on changed files

## Current Execution Addendum - 2026-07-03 Cliplot Response-Shape Readiness Refresh

Selected goal and chunk: Goal 10.36 - update Cliplot-owned source-only
readiness docs/verifier to record Auth-defined checkout-data v1 response shape.

Pre-coding gate decision: pass. The work is documentation/verifier-only in the
consumer lane, preserves Auth as the wallet source of truth, and keeps Cliplot
runtime wallet integration blocked until selector/session/PII, approved field
mapping, and guest fallback decisions are approved.

Intent chain:

- Vision: Auth is the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: Cliplot can verify Auth response shape before selector work
  without starting unsafe runtime wallet calls.
- System: Auth wallet source contract, Cliplot source-only readiness verifier,
  and Auth Goal 10 coordinator plans.
- Feature: dependency-gated Cliplot checkout wallet readiness.
- Task: replace the response-shape unknown with source-defined field lists and
  caveats; preserve mapping/fallback/runtime blockers.
- Coding prompt: source-only verifier/docs; no live calls, runtime wallet
  fetches, checkout mutation, DB, deploy, secrets, tokens, cookies, or
  production customer/order data.

Sensitive-data handling: source files and validation metadata only. No secrets,
token values, decoded JWTs, cookies, raw production user rows, addresses,
invoices, orders, response bodies, DB values, or live checkout data are read or
recorded.

Contract impact: Cliplot verifier now records Auth-defined checkout-data
top-level fields, defaults fields, sanitized delivery address fields,
sanitized invoice profile fields, omitted wallet row fields, and caveats. It
does not enable runtime wallet calls, approve selector behavior, or approve
order snapshot mapping.

Parallel execution:

- Auth read-only audit subagent: complete; confirmed current Auth source/docs
  define enough response-shape evidence for Cliplot readiness.
- Auth coordinator: integrated the three-file Cliplot source-only patch,
  validated, committed Cliplot, and refreshed Auth coordinator docs.

Validation plan:

- Cliplot `npm run readiness:auth-wallet-checkout`
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js`
- Cliplot `npm run check`
- Cliplot `git diff --check`
- Cliplot stale response-shape blocker scan
- Cliplot targeted dangerous literal-secret scan on changed files

## Current Execution Addendum - 2026-07-03 Rent-a-box Schema/Response-Shape Evidence Refresh

Selected goal and chunk: Goal 10.37 - update Rent-a-box Goal 12 source-only
readiness docs/verifier to record Auth checkout-data schema and response-shape
evidence.

Pre-coding gate decision: pass. The work is documentation/verifier-only in the
consumer lane, preserves Auth as the wallet source of truth, and keeps
Rent-a-box product-code migration blocked until customer session, admin role,
consent/profile migration, and live backfill decisions are approved.

Intent chain:

- Vision: Auth is the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: Rent-a-box no longer treats Auth schema/response-shape evidence
  as implicit; future migration work can focus on Rent-specific gates.
- System: Auth wallet source contract, Rent-a-box Goal 12 source-only verifier,
  and Auth Goal 10 coordinator plans.
- Feature: dependency-gated Rent-a-box Auth wallet migration readiness.
- Task: record Auth schema/response-shape evidence and preserve session/admin/
  consent/backfill blockers.
- Coding prompt: source-only verifier/docs; no product-code migration, live
  calls, checkout mutation, DB, deploy, secrets, tokens, cookies, or production
  customer/order data.

Validation plan:

- Rent-a-box `python3 -m py_compile scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py scripts/ips_pre_coding_gate.py`
- Rent-a-box `python3 scripts/check_goal12_auth_wallet_readiness.py --root .`
- Rent-a-box `./scripts/intent_preflight.sh`
- Rent-a-box `git diff --check`
- Rent-a-box targeted dangerous literal-secret scan on changed files

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

## Current Execution Addendum - 2026-07-02 Goal 10.9 And 10.10 Consumer Planning

Selected goal and chunk: Goal 10.9 Rent-a-box hosted Auth/profile migration
plan and Goal 10.10 ChytraKoupe checkout selector integration plan.

Pre-coding gate decision: pass for documentation-only, repo-local planning.
DocsRAG returned HTTP 200 from the running Auth pod with broad ownership
context but no existing wallet-plan source. Subagents completed read-only audits
of both consumer repos.

Sensitive-data handling: source/docs only. No production user rows, customer
addresses, invoice records, password hashes, decoded JWTs, secrets, token
values, cookies, contract storage contents, or live checkout payloads are read
or recorded.

Contract impact: no runtime contract change. Plans define dependency gates for
hosted Auth migration, Auth wallet endpoint deployment, Auth client-id/CORS
decisions, and order snapshot payload decisions.

Allowed files:

- `rent-a-box/docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`
- `rent-a-box/docs/goals/README.md`
- `rent-a-box/docs/goals/ORCHESTRATION_STATE.md`
- `rent-a-box/reports/validation/goal-12-auth-customer-data-wallet-migration-plan.md`
- `chytrakoupe/implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`
- `chytrakoupe/implementation-goals/README.md`
- `chytrakoupe/docs/goal-driven/STATUS.md`
- Auth coordinator docs/status/state.

Validation plan:

- Rent-a-box: `./scripts/intent_preflight.sh`,
  `python3 scripts/check_no_cyrillic.py docs AGENTS.md README.md`,
  `git diff --check`.
- ChytraKoupe: `git diff --check` plus dangerous literal-secret marker scan on
  changed docs.
- Auth: `git diff --check` plus dangerous literal-secret marker scan on changed
  coordinator docs.

Validation evidence: Rent-a-box repo-local validation passed
`./scripts/intent_preflight.sh`, no-Cyrillic scan, `git diff --check`, and a
literal-secret marker scan before commit `fcfeb48`. ChytraKoupe repo-local
validation passed `git diff --check` and a literal-secret marker scan before
commit `a1dabca`.

Deployment plan: none. SQL apply, Auth deploy, consumer deploy, and live
checkout smoke remain owner-approval gated.

## Current Execution Addendum - 2026-07-02 Goal 10.11 Validation And Deployment Plan

Selected goal and chunk: Goal 10.11 cross-repo validation and deployment plan.

Pre-coding gate decision: pass for documentation-only coordination. The chunk
does not change runtime code, schema, JWT, RBAC, OAuth, magic-link, CORS,
internal-service contracts, or consumer source. Live SQL, Auth deploy, rollback
mutation, synthetic authenticated smoke, and consumer runtime smoke are
explicitly held for owner approval.

Sensitive-data handling: source metadata and HTTP status only. No DB connection
values, secret values, token values, passwords, decoded JWTs, password hashes,
raw production customer rows, address rows, invoice rows, or live checkout
payloads are read or recorded.

Contract impact: no runtime contract change in this chunk. The plan preserves
the existing Goal 10 contract: Auth owns reusable profile/address/invoice data;
Orders owns immutable order snapshots; consumer storefronts render selectors
and save back through Auth.

Allowed files:

- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/IMPLEMENTATION_STATE.md`

Parallel execution:

- Auth live-gate subagent: complete, read-only.
- Consumer validation subagent: complete, read-only.
- Auth coordinator: creates and validates the plan/status updates.
- Future Auth operator lane: dependency-gated on explicit owner approval for
  schema-only DB preflight, SQL apply, deploy, rollback mutation, and synthetic
  smoke.
- Future consumer lanes: dependency-gated on Auth wallet 401 smoke and
  repo-local decisions.

Validation plan:

- `git diff --check`
- targeted dangerous literal-secret scan on changed documentation files
- no build/test/deploy required for this docs-only chunk


## Current Execution Addendum - 2026-07-02 Auth Customer Data Wallet Pre-Approval Fixes

Selected goal and chunk: Goal 10 pre-approval hardening after A1 source
implementation.

Pre-coding gate decision: pass. Read-only sidecars identified concrete
pre-approval defects: wallet path params lacked UUID validation and
`docs/orchestrator/GOALS.md` lagged behind the source-implemented state.

Sensitive-data handling: source/docs/runtime metadata only. No production user
rows, customer addresses, invoice data, decoded JWTs, secrets, token values,
passwords, or raw customer logs are read or recorded.

Contract impact: wallet endpoints now reject malformed UUID path params at the
controller boundary. This is a defensive validation improvement and does not
change JWT, RBAC, OAuth, magic-link, CORS, internal-service, token, credential,
or consumer-service contracts.

Validation plan:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts
src/users/users.service.spec.ts`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`
- documentation missing-marker scan, allowing documented blockers only
- documentation/source secret-pattern scan

Deployment plan:

- No deploy in this pre-approval fix pass.
- First restore/confirm current Auth runtime health on the existing deployed
  image, then request owner approval for schema-only DB preflight, SQL apply,
  and deploy.
- `npm run build`
- `npm run lint`
- deploy with `./scripts/deploy.sh` after source validation
- post-deploy hosted register/login browser CDP flow and fail-closed race check

## Current Execution Addendum - 2026-07-02 Auth Hosted Profile Wallet UI

Selected goal and chunk: Goal 10.14 - Auth hosted `/profile` wallet management
UI source prep.

Pre-coding gate decision: pass. A1 Auth wallet API source exists and the
hosted web container already serves `/profile`; the remaining work is bounded
to the profile web source and hosted web contract tests.

Intent chain:

- Vision: Auth is the Statex identity and reusable customer data authority.
- Goal impact: registered users can manage reusable profile, delivery, and
  invoice data once in Auth and consumers can later select the same entries.
- System: `auth-microservice` hosted web profile page plus existing
  `/auth/profile/...` wallet APIs.
- Feature: hosted profile wallet management UI.
- Task: add source-only profile/address/invoice management controls and static
  contract coverage; do not deploy or mutate live data.
- Coding prompt: patch only hosted profile web files, focused tests, and
  orchestrator status docs; preserve tokens/secrets/password safety.

Sensitive-data handling: source and static contract tests only. No DB
connection values, live customer rows, address rows, invoice rows, secrets,
token values, decoded JWTs, passwords, cookies, or live checkout payloads are
read or recorded.

Contract impact: no backend API contract change. The UI consumes existing
same-origin Auth wallet endpoints with bearer auth from `sessionStorage`,
strips token-bearing snake-case and camel-case hash fragments after hosted
handoff, and uses the central `{ identifier, password }` login contract for
direct `/profile` sign-in.

Allowed files:

- `web/public/profile.html`
- `web/public/js/profile.js`
- `web/public/css/style.css`
- `src/auth/hosted-auth-web.spec.ts`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/IMPLEMENTATION_STATE.md`

Parallel execution:

- UI implementation owner: Auth coordinator, complete.
- Read-only hosted UI explorer: complete; confirmed `/profile` surface and
  wallet APIs before coding.
- Read-only source review subagent: complete; token-fragment cleanup and
  identifier-login findings fixed before commit.
- Live deployment/operator lane: dependency-gated on explicit owner approval
  for schema preflight, SQL apply, deploy, and smoke.

Validation plan:

- `node --check web/public/js/profile.js`
- `node --check web/server.js`
- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`
- targeted dangerous literal-secret scan on changed hosted profile files

## Current Execution Addendum - 2026-07-02 Auth Wallet Runtime Gate Verifier

Selected goal and chunk: Goal 10.15 - source-only Auth wallet runtime 401 smoke
verifier.

Pre-coding gate decision: pass. Goal 10 deployment docs currently contain
manual public curl probes for the wallet 401 gate; a reusable verifier can
improve post-deploy evidence without running SQL, deploying, reading secrets,
or touching customer data.

Intent chain:

- Vision: Auth is the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: the rollout has a repeatable post-deploy gate proving wallet
  routes are live and protected before consumer runtime smoke starts.
- System: public Auth HTTPS endpoint and existing wallet route contracts.
- Feature: unauthenticated runtime gate verifier.
- Task: add a source-only status-code verifier and update runbooks/status.
- Coding prompt: bodyless unauthenticated GETs only; print status metadata
  only; do not send tokens/cookies, request bodies, DB queries, or customer
  payloads.

Sensitive-data handling: public status-code metadata only. No Authorization
headers, cookies, response bodies, DB connection values, secrets, tokens,
decoded JWTs, passwords, customer rows, address rows, invoice rows, or
authenticated smoke data are read or recorded.

Contract impact: no API contract change. The verifier asserts the existing
contract: before deploy the wallet routes remain 404; after deploy they must be
present and guarded with HTTP 401 when unauthenticated.

Allowed files:

- `scripts/check-customer-data-wallet-runtime-smoke.js`
- `package.json`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-live-gate.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/IMPLEMENTATION_STATE.md`

Parallel execution:

- Runtime verifier discovery subagent: complete, read-only; confirmed only SQL
  preflight helper existed and recommended a bodyless status-code verifier.
- Auth coordinator: implement verifier and docs/status updates.
- Auth operator lane: still dependency-gated on explicit owner approval for
  schema preflight, SQL apply, deploy, rollback mutation, and synthetic smoke.

Validation plan:

- `node --check scripts/check-customer-data-wallet-runtime-smoke.js`
- `npm run check:customer-data-wallet-runtime -- --expect=predeploy`
- `npm run check:customer-data-wallet-runtime`
- `npm run check:customer-data-wallet-preflight`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`
- targeted dangerous literal-secret scan on changed verifier/docs

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
