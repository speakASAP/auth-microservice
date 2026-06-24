# AOS Auth Modernization Orchestrator Plan

Date: 2026-06-24
Owner role: Auth modernization orchestrator
Repositories in scope: auth-microservice, marathon, speakasap, school-committee reference
Repositories explicitly out of scope: speakasap-portal legacy

## Intent Preservation Chain

Vision: one Alfares ecosystem identity provider for all current and future applications. Users must authenticate through one central AOS/auth-microservice UI and identity contract, similar to Google/Yandex account login, while product applications consume tokens and never own passwords or duplicated registration forms.

Goal Impact: users from Marathon, SpeakASAP, School Committee and future Alfares apps can enter with phone or email, recover/set passwords when needed, and use the same account across services. Maintenance moves from forty duplicated auth forms to one central auth surface and one token contract.

System: auth-microservice is the single source of identity, credentials, contact methods, JWT issuance, refresh, validation, application audience/redirect allowlists, roles and auth audit events. Consumer apps use redirect/callback/BFF adapters only.

Feature: unified login and registration contract supporting phone without password, email login, optional password setup, magic link/OTP path, token callback handoff, refresh, logout, and user source attribution.

Task: modernize contact-login into first-class auth; create migration contracts for marathon and new speakasap; keep school-committee as a reference implementation; create reusable adoption runbook for other apps.

Execution Plan: run parallel workstreams listed below with auth contract as the integration blocker. Do not mutate legacy speakasap-portal. Do not run live DB backfills or irreversible data writes without explicit owner approval.

Coding Prompt: each worker must preserve this chain, operate only in its assigned repo/files, avoid secrets/customer data, keep logs redacted, run repo-local validation, and hand off exact changed paths and validation evidence.

Code: planned across auth-microservice, marathon, speakasap, and school-committee docs/reference. Implementation starts only after contract docs are written.

Validation: contract tests in auth-microservice, consumer integration tests in marathon/speakasap, school-committee regression checks, and cluster smoke only after deploy approval.

## Target Architecture

1. auth-microservice owns all user identities and contact methods.
2. auth-microservice exposes one hosted login UI and API contract for email/phone/password/magic-link/OTP.
3. Consumer apps redirect unauthenticated users to central auth with `client_id`, `redirect_uri`, `state`, optional `next`, and PKCE/nonce where supported.
4. auth-microservice redirects back with a short-lived authorization code or token handoff, depending on phase.
5. Browser-facing apps store tokens only through their BFF/session layer where available; static apps may store short-lived access tokens only as transitional debt.
6. Domain services validate access tokens through `/auth/validate` or future JWKS. They do not query or store credentials.
7. Domain user profile tables may mirror auth user ids and app-specific attributes only; no app becomes identity owner.
8. Leads/CRM services consume identity events after auth registration, but do not decide identity.

## Required Auth Contract

- `POST /auth/register-contact`: create or update a central user from contact methods and `source`, returning the canonical auth user id. This remains a provisioning endpoint, not login.
- `POST /auth/login`: accept an identifier that may be email or phone plus password, return `accessToken` and `refreshToken`.
- `POST /auth/login-contact`: must either be deprecated or upgraded to return the same JWT/refresh contract after a verified passwordless challenge, not an opaque local `sessionId`.
- `POST /auth/magic-link/request`: accept email or phone-capable identifier if delivery exists.
- `[NEW] POST /auth/passwordless/start`: start phone/email OTP or magic-link challenge.
- `[NEW] POST /auth/passwordless/verify`: verify challenge and return `accessToken`, `refreshToken`, and sanitized user.
- `[NEW] GET /auth/login`: hosted central login page with safe `client_id`, `redirect_uri`, `state`, `next` handling.
- `[NEW] GET /auth/callback` or `/auth/authorize`: complete central callback handoff.
- `POST /auth/validate`: remains backwards compatible for existing consumers.
- `POST /auth/refresh`: remains backwards compatible.
- `POST /auth/logout`: revoke refresh/session state where implemented.

## Data Ownership Rules

- Canonical fields in auth: id, email, phone, contactInfo, verified contacts, password hash if set, source, roles, lastActivity, audit timestamps.
- App-local fields outside auth: Marathon participant progress, SpeakASAP course/student state, School Committee domain profile, payment/order data.
- Marathon participant `userId` must be auth-microservice UUID for all new users.
- Legacy numeric ids may only be mapped through explicit legacy mapping tables/contracts; do not overwrite them blindly.
- Backfill/export of live users is DB mutation and requires explicit approval and bounded dry-run/apply gates.

## Parallel Workstreams

### WS-A Auth Contract Owner - ready now

Objective: upgrade auth-microservice contact login into a first-class token issuing contract.
Scope: auth-microservice only.
Allowed files: src/auth/**, src/users/**, tests/specs, docs/orchestrator/**, README/API docs, migrations only if approved by repo evidence.
Forbidden files: consumer app code, secrets, legacy speakasap-portal, live DB direct writes.
Expected output: documented API contract, backwards-compatible DTOs, identifier normalization, phone lookup through `phone` and `contactInfo`, JWT return for password login by email/phone, passwordless challenge plan/implementation if infrastructure exists, tests.
Blockers: delivery provider for phone OTP may be [UNKNOWN]; live migration requires approval.
Validation owner: auth worker.
Handoff: publish endpoint shapes and migration notes for WS-B and WS-C.

### WS-B Marathon Consumer Owner - dependency-gated by WS-A contract

Objective: remove local registration/login ownership from Marathon and migrate UI to central auth redirect/handoff.
Scope: marathon only.
Allowed files: frontend auth/login/register surfaces, src/shared/auth-client.ts, registration service integration, smoke scripts, docs/orchestrator/**.
Forbidden files: unrelated Marathon UI redesign, winners/reviews unless needed by compile, live backfill apply without approval, legacy speakasap-portal.
Expected output: Marathon registration CTA redirects to central auth where possible; backend provisions through auth; profile routes require auth token without redirect loops; existing public flows continue.
Blockers: central hosted auth URL/redirect contract from WS-A.
Validation owner: marathon worker.
Handoff: smoke results and remaining backfill approval plan.

### WS-C New SpeakASAP Consumer Owner - dependency-gated by WS-A contract

Objective: migrate new speakasap monorepo frontend/api-gateway/user-service auth surfaces to the unified auth-microservice login/callback contract.
Scope: speakasap repo only, not speakasap-portal.
Allowed files: frontend auth pages/adapters, api-gateway auth routing, user-service auth user id mapping, docs/orchestrator/**, tests.
Forbidden files: speakasap-portal, legacy host, unrelated salary/payment/content features.
Expected output: SpeakASAP app redirects to central auth UI, validates auth tokens through existing auth-microservice validation, keeps domain data in user-service only as auth id mirror.
Blockers: central hosted auth contract, current Next/frontend auth shape.
Validation owner: speakasap worker.
Handoff: routes changed, env keys needed, smoke instructions.

### WS-D Reference Compatibility Owner - ready now

Objective: use school-committee as a reference consumer and ensure the new auth contract does not break existing login, magic link, refresh, validate and cookie session flows.
Scope: school-committee only.
Allowed files: docs/orchestrator/**, tests if compatibility gaps appear, app/api/auth/** only if contract adaptation is necessary.
Forbidden files: domain feature refactors, DB migrations, legacy apps.
Expected output: compatibility matrix and any small adapter changes needed for new central login URLs.
Blockers: WS-A final endpoint shapes for hosted auth.
Validation owner: school-committee/reference worker.
Handoff: reference pattern for the broader 40-app rollout.

### WS-E Integration Orchestrator - final integration

Objective: own merge order, cross-repo contract consistency, validation gates, deploy sequencing and rollout risk.
Scope: orchestration docs and final integration reviews.
Allowed files: docs/orchestrator plans/status in each repo.
Forbidden files: implementing conflicting code in worker-owned files while workers are active.
Expected output: updated status matrix, validation evidence, deploy/runbook, remaining approval requests.
Blockers: worker handoffs.
Validation owner: orchestrator.
Merge order: auth contract first, school-committee compatibility second, marathon/speakasap consumers third, backfill and broad rollout last.

## Milestones

1. Planning committed to each involved repo.
2. Auth contract implemented with backwards-compatible tests.
3. Reference compatibility verified in school-committee.
4. Marathon switched to central auth redirect/callback and backend provisioning.
5. New SpeakASAP switched to central auth redirect/callback and token validation.
6. Backfill dry-run report for Marathon users, no raw PII.
7. Owner-approved bounded backfill apply.
8. Rollout template for remaining Alfares apps.

## Validation Gates

- Auth: build, unit/contract tests for email login, phone login, passwordless start/verify where implemented, token validate/refresh regression.
- Marathon: backend build, frontend build, user-flow smoke, missing-phone rejection, existing auth account flow, profile no-loop check.
- SpeakASAP: package builds/tests for affected frontend/gateway/user-service, token validation regression.
- School Committee: existing auth tests, middleware redirect tests, magic-link/login/refresh route tests.
- Cross-service: no secrets printed; no raw user data; all user ids masked in reports.

## Open Facts

- [UNKNOWN: whether AOS is the final public product name for auth-microservice or an alias for the same service].
- [UNKNOWN: final hosted central auth domain, e.g. auth.alfares.cz].
- [UNKNOWN: SMS/WhatsApp/Telegram provider for phone passwordless login].
- [UNKNOWN: whether all forty apps are browser apps, API services, or mixed].
- [MISSING: owner approval for live DB dry-run/backfill queries and apply].

## Non-Goals

- No changes to legacy speakasap-portal.
- No direct production DB writes in this planning phase.
- No duplicated login forms in Marathon or new SpeakASAP as the target state.
- No removal of backwards-compatible `/auth/login`, `/auth/validate`, or `/auth/refresh` until all consumers are migrated.
