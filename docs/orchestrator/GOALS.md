# Auth Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

## Goal 1 - Admin Token Copy UX And Safety

Status: done

Intent: Auth admin users must be able to copy their access token for cross-service admin work without unnecessary token exposure.

Chunks:

- [x] 1.1 Add always-available Copy Token button in the admin access-token section.
- [x] 1.2 Copy from authenticated session storage instead of requiring the token to be revealed.
- [x] 1.3 Verify deployed admin UI can copy the token and still strips token-like URL parameters.

Acceptance criteria:

- `/admin` shows a Copy Token button after login.
- Copy writes the current access token to the clipboard.
- Token remains masked unless the user clicks Show Token.
- URL credential stripping remains in place for `token`, `accessToken`, and `refreshToken`.

## Goal 2 - Auth Intent Preservation Pack

Status: done

Intent: Auth must have a durable local workflow for future development that preserves ecosystem ownership boundaries.

Chunks:

- [x] 2.1 Add orchestrator pack files under `docs/orchestrator/`.
- [x] 2.2 Update `AGENTS.md` so future agents follow the pack.
- [x] 2.3 Deploy or ingest docs into docs-rag-microservice after repository changes are accepted.

Acceptance criteria:

- `MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, and `PROMPTS.md` exist.
- The pack names Auth ownership and non-ownership boundaries.
- The workflow includes planning stages, goal selection, coordinator status, verification, and next-task reporting.
- DocsRAG usage is documented as mandatory before broad architecture work.

## Goal 3 - Unified Auth Contract Recovery

Status: done

Intent: Auth contract docs indexed in DocsRAG must be restored or reconciled with the live repo.

Chunks:

- [x] Locate historical `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, and `docs/agents/*` from DocsRAG snapshot or git history.
- [x] Restore current contract docs if they are still authoritative, or document what replaced them.
- [x] Verify login, refresh, validate, OAuth, magic-link, redirect, CORS, and RBAC contract sections.

Acceptance criteria:

- Future agents can find current auth contracts in the repo.
- Stale DocsRAG references are either restored or superseded explicitly.
- No secrets are introduced.

## Goal 4 - Auth Observability And Safety Checks

Status: done

Intent: Auth-sensitive flows must be observable without leaking credentials.

Chunks:

- [x] Review logs for login, refresh, password reset, magic link, OAuth, admin user management, and role changes.
- [x] Add missing structured metadata where safe.
- [x] Add regression checks that logs do not include passwords, JWTs, reset tokens, magic-link tokens, OAuth tokens, or secrets.

Acceptance criteria:

- Auth events include service, operation, identifier, outcome, and duration where appropriate.
- Sensitive values are redacted or absent.
- Verification evidence is recorded.

## Goal 5 - Goalkeeper-Style Orchestrator Workflow

Status: done

Intent: Auth implementation work must be organized like Goalkeeper: a single master orchestrator coordinates goals, plans, workers, validation, status, and continuation from repository state.

Chunks:

- [x] 5.1 Add state-driven continuation docs: `docs/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/IMPLEMENTATION_STATE.md`.
- [x] 5.2 Add `implementation-goals/` with a goal index, completed goal records, next ready backlog goal, and execution templates.
- [x] 5.3 Update `AGENTS.md` and the existing Auth orchestrator pack to use the Goalkeeper-style master-agent workflow.
- [x] 5.4 Record validation evidence and next action.

Acceptance criteria:

- A future session can continue with `AUTH ORCHESTRATOR: continue implementation`.
- The next action can be selected from `docs/IMPLEMENTATION_STATE.md` without asking the owner.
- Execution plan, context package, coding prompt, and validation report templates exist.
- The workflow preserves Auth ownership and secret-safety rules.

## Goal 6 - RBAC Consuming Services Audit

Status: done

Intent: Auth role authority and consumer RBAC enforcement must be audited across consuming services without duplicating identity ownership or breaking JWT/RBAC contracts.

Chunks:

- [ ] 6.1 Query DocsRAG for RBAC and consuming-service contract context.
- [ ] 6.2 Identify consumers that validate Auth JWTs or roles.
- [ ] 6.3 Compare consumer expectations with `docs/UNIFIED_AUTH_CONTRACT.md`.
- [ ] 6.4 Record findings and split remediation into owner-approvable chunks.

Acceptance criteria:

- Audit report names inspected services or panels.
- Findings distinguish Auth-owned role assignment from consumer-owned enforcement.
- JWT/RBAC compatibility risks are evidence-backed.
- No secrets or production user data are recorded.

## Goal 7 - IPS Documentation Compliance Update

Status: done

Intent: Auth documentation must comply with the company Intent Preservation System while preserving the compact Auth-local orchestration structure.

Chunks:

- [x] 7.1 Review company IPS standards and templates from `/Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system`.
- [x] 7.2 Add Auth-local invariants, pre-coding gate, context package, execution-plan frame, and readiness gates.
- [x] 7.3 Update existing Auth orchestrator, state, and prompt docs so future coding is blocked until IPS checks are complete.
- [x] 7.4 Run documentation presence, missing-marker, and secret-pattern scans.

Acceptance criteria:

- Future coding chunks require upstream traceability, invariant review, sensitive-data classification, contract impact review, context package, execution plan, pre-coding gate, readiness checks, and status evidence.
- Auth ownership and non-ownership boundaries remain unchanged.
- Documentation-only verification passes locally.

## Goal 8 - Auth Alpha Hosted Token Handoff URL Normalization

Status: done

Intent: Auth-hosted login, OAuth, and magic-link flows must construct token handoff redirects safely and consistently.

Chunks:

- [x] 8.1 Define Auth Alpha as hosted token handoff URL normalization.
- [x] 8.2 Centralize backend OAuth and magic-link fragment handoff URL construction.
- [x] 8.3 Normalize hosted email/password UI handoff URL construction.
- [x] 8.4 Add focused tests proving existing caller fragments are replaced by Auth handoff fragments.

Acceptance criteria:

- Hosted login/register redirects to the validated return URL with one final token handoff fragment.
- OAuth callback redirects to the validated return URL with one final token handoff fragment.
- Magic-link verify redirects to the validated return URL with one final token handoff fragment.
- Existing caller fragments do not create double-fragment handoff URLs.
- No endpoint path, JWT payload, OAuth provider, magic-link token storage, CORS, or redirect allowlist behavior changes.
- No secrets, JWTs, refresh tokens, magic-link tokens, OAuth tokens, reset tokens, passwords, or production user data are recorded.

## Goal 9 - Auth Contract Production Smoke Verification

Status: done

Intent: Verify the live Auth production surface after the latest deployment without changing runtime behavior or exposing sensitive data.

Chunks:

- [x] 9.1 Refresh context package and execution plan for the verification task.
- [x] 9.2 Query DocsRAG for Auth contract/verification context.
- [x] 9.3 Run production-safe contract smoke checks.
- [x] 9.4 Record verification evidence and continuation state.

Acceptance criteria:

- Production health returns ok.
- Hosted login/register/admin entry points are reachable.
- Synthetic invalid-token and safe redirect-validation checks behave safely.
- Build, frontend syntax, documentation scans, and diff-check pass.
- No runtime, deployment, database, contract, secret, token, or production user-data change is made.

## Goal 10 - Auth Customer Data Wallet

Status: active

Intent: Auth must be the single editable source of truth for registered-user profile data, delivery address books, and invoice/billing profiles, while Orders keeps immutable order snapshots and consumer checkouts use Auth selectors instead of app-local reusable profile stores.

Chunks:

- [x] 10.0 Document cross-repo plan, target contract, current gaps, and parallel workstreams.
- [x] 10.1 Decide and document the production-safe Auth schema migration path for address and invoice profile storage.
- [x] 10.2 Implement Auth delivery address book storage, DTOs, endpoints, sanitization, and tests.
- [x] 10.3 Implement Auth invoice profile storage, DTOs, endpoints, sanitization, and tests.
- [x] 10.4 Implement Auth checkout aggregate read and legacy `profileAddress` projection.
- [x] 10.5 Update Auth contract docs and source validation evidence; live SQL apply and deploy remain owner-approval gated.
- [x] 10.6 Integrate FlipFlop shared Auth client and user-service bridge with Auth address/invoice APIs; runtime remains gated.
- [x] 10.7 Integrate FlipFlop checkout/profile selectors while preserving guest checkout; runtime smoke remains gated.
- [x] 10.8 Confirm Orders snapshot contract compatibility; no source change before approved wallet provenance semantics.
- [x] 10.9 Create Rent-a-box hosted Auth/profile migration plan before any code changes.
- [x] 10.10 Create Chytrakoupe checkout selector integration plan.
- [x] 10.11 Run cross-repo validation and record deployment plan.
- [x] 10.12 Create Cliplot checkout wallet readiness plan/verifier.
- [x] 10.13 Complete marketplace/channel audit.
- [x] 10.14 Source-prepare Auth hosted `/profile` wallet management UI.
- [x] 10.15 Source-prepare Auth wallet runtime 401 smoke verifier.
- [x] 10.16 Refresh Auth release gate exact HEAD.
- [x] 10.17 Source-define Auth invoice profile field semantics.
- [x] 10.18 Source-prepare Orders and FlipFlop immutable order snapshots for optional Auth invoice fields `companyId`, `vatId`, and `email`.
- [x] 10.19 Source-prepare explicit FlipFlop checkout save-back for Auth invoice profiles and delivery addresses.
- [x] 10.20 Source-prepare FlipFlop account invoice profile management and Auth wallet default-method alignment.

Acceptance criteria:

- Auth supports multiple delivery addresses and multiple invoice profiles per authenticated user.
- Auth enforces per-user ownership, default selection, DTO validation, and sanitized output.
- Auth does not put address or billing data into JWT claims.
- FlipFlop authenticated checkout can select saved Auth delivery and invoice entries; guest checkout remains explicit and works.
- Orders receives immutable order snapshots and does not become reusable profile source of truth.
- Marketplace/channel order ingestion preserves external buyer/order evidence and does not back-write marketplace buyer data into Auth.
- No docs, logs, prompts, tests, reports, lifecycle events, or frontend bundles expose secrets, tokens, passwords, decoded JWTs, raw production user data, or full production customer address payloads.

Planning artifacts:

- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
