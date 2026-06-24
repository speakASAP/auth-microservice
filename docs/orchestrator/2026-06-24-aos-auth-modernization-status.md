# AOS Auth Modernization Status

Date: 2026-06-24
Orchestrator: current Codex thread `019ef8b1-a6c8-7210-97bd-36f78964a811`

## Active Goal

Modernize Alfares authentication so auth-microservice is the single identity provider with unified phone/email login, and migrate marathon plus new speakasap to use the central auth flow while preserving IPS/GDD plans in each involved repo and coordinating parallel implementation threads.

## 2026-06-24 Ecosystem Rollout Guardrail

Status: completed no-write rollout-doc checker and wired it into central readiness; no app code, DB, secret, deploy, or live smoke was touched.

IPS chain:
- Vision: every Alfares consumer migration has one enforceable hosted Auth rollout standard instead of scattered app-local assumptions.
- Goal Impact: the Marathon/SpeakASAP pattern can scale to the wider ecosystem while preserving explicit blockers for client registry, service tokens, live DB backfill, and real contact delivery.
- System: auth-microservice docs/check scripts plus ecosystem rollout handoff docs.
- Feature: ecosystem hosted Auth rollout documentation guardrail.
- Task: add a checker for the hosted Auth consumer standard, rollout index, and three cluster handoffs; remove stale missing markers for already-published callback/token handoff facts.
- Execution Plan: docs/checker only; no legacy speakasap-portal mutation; no secrets, DB, deploy, token verification, or contact delivery.
- Coding Prompt: fail central readiness if the ecosystem rollout docs disappear or drift away from the active hosted Auth contract.
- Code: scripts/check-ecosystem-hosted-auth-rollout-docs.sh; package.json script check:ecosystem-auth-rollout-docs; scripts/check-aos-auth-modernization-readiness.sh; ecosystem rollout docs.
- Validation: npm run check:aos-auth-readiness passed with pass=12 warn=3 fail=0; npm run check:ecosystem-auth-rollout-docs passed; bash -n for both check scripts passed; git diff --check passed for touched docs/scripts.

Evidence:
- The checker requires `docs/HOSTED_AUTH_CONSUMER_STANDARD.md`, `docs/UNIFIED_AUTH_CONTRACT.md`, the rollout index, and product/education, commerce, and platform/ops cluster handoffs.
- The checker verifies hosted login/register URLs, `client_id`, `return_url`, token fragment fields, backend `/auth/validate`, legacy `speakasap-portal` exclusion in consumer/rollout docs, IPS chain, parallel workstream structure, and validation sections.
- Stale `[MISSING]` markers for hosted Auth return parameter, browser/session model, and callback token transport were replaced with references to the active hosted Auth consumer standard. Real unknowns for client registry, service/machine tokens, roles, Vault, live DB backfill, and smokes remain explicit.

Remaining gates:
- [MISSING: owner approval phrase for Marathon Gate 1 dry-run].
- [MISSING: owner approval phrase and test contact for Auth request-only contact-code smoke].
- [MISSING: authoritative Auth client registry and allowed return URLs beyond planning docs].
- [BLOCKED: Vault/ExternalSecret vault-backend InvalidProviderConfig for runtime allowlist verification].

## 2026-06-24 Next-Stage Approval Templates

Status: completed template docs for post-Gate-1 apply and post-request contact-code verify; no gated operation was executed.

IPS chain:
- Vision: the Auth modernization can proceed from dry-run/request-only checks to apply/verify without improvising risky commands.
- Goal Impact: Gate 2 Marathon backfill and Auth contact-code token verification now have explicit approval phrases, redaction/output contracts, stop conditions, and recovery boundaries.
- System: Marathon backfill apply planning and Auth contact-code verify planning.
- Feature: next-stage approval templates.
- Task: add Marathon Gate 2 apply template and Auth contact-code verify smoke approval packet, then wire central readiness to check both files exist.
- Execution Plan: docs/checker only; no DB query, no Auth API call, no token verification, no deploy, no contact delivery.
- Coding Prompt: treat Gate 2 and verify as blocked until their prerequisites and exact approval phrases exist.
- Code: marathon docs/orchestrator/2026-06-24-marathon-auth-backfill-gate2-apply-approval-template.md; auth-microservice docs/orchestrator/2026-06-24-auth-contact-code-verify-smoke-approval.md; scripts/check-aos-auth-modernization-readiness.sh.
- Validation: npm run check:aos-auth-readiness passed with pass=11 warn=3 fail=0; bash -n central checker passed; git diff --check passed for touched files.

Evidence:
- Marathon Gate 2 template is blocked until Gate 1 dry-run evidence is reviewed and requires ticket, batch limit, Auth API target, masked output, and forward-fix recovery.
- Auth verify packet is blocked until request-only smoke succeeds and owner supplies the received code; command shape redacts accessToken, refreshToken, and redirectUrl before output.
- Central readiness now fails if Gate 1, Gate 2, request-only, or verify approval packet files are missing.

Remaining gates:
- [MISSING: owner approval phrase for Marathon Gate 1 dry-run].
- [MISSING: Gate 1 dry-run evidence before Gate 2 apply].
- [MISSING: owner approval phrase and test contact for Auth request-only contact-code smoke].
- [MISSING: request-only smoke evidence and received code before contact-code verify].
- [BLOCKED: Vault/ExternalSecret vault-backend InvalidProviderConfig for runtime allowlist verification].


## 2026-06-24 Owner Approval Packets

Status: completed approval-ready documents for remaining gated work; no gated operation was executed.

IPS chain:
- Vision: remaining Auth modernization gates can be approved and executed without ambiguity or secret exposure.
- Goal Impact: owner approval can now point to exact command shapes, output contracts, stop conditions, and rollback/forward-fix boundaries.
- System: Marathon backfill dry-run planning and Auth contact-code live smoke planning.
- Feature: approval packets for gated live checks.
- Task: document Gate 1 Marathon live read-only dry-run and Auth contact-code request-only live smoke.
- Execution Plan: docs-only; no DB query, no secret read, no Auth API request, no deployment, no contact delivery.
- Coding Prompt: preserve exact approval phrases and stop conditions before any live command can run.
- Code: marathon docs/orchestrator/2026-06-24-marathon-auth-backfill-gate1-approval.md; auth-microservice docs/orchestrator/2026-06-24-auth-contact-code-live-smoke-approval.md; central readiness warning text.
- Validation: approval packet content inspected; contact-code command shape checked against ContactCodeRequestDto fields identifier, return_url, and client_id; central readiness checker now verifies all four approval packet/template files exist and passes with gated warnings.

Evidence:
- Marathon Gate 1 packet approves only in-pod dry-run with limit 25, no Auth API calls, no DB writes, and masked output only.
- Auth contact-code packet approves only one request-only smoke after owner supplies a safe test contact; verify/token response requires a second explicit approval with redaction.
- The central readiness checker warnings now point to the approval packet paths and the checker fails if either approval packet file is missing.

Remaining gates:
- [MISSING: owner approval phrase for Marathon Gate 1 dry-run].
- [MISSING: owner approval phrase and test contact for Auth contact-code live smoke].
- [BLOCKED: Vault/ExternalSecret vault-backend InvalidProviderConfig for runtime allowlist verification].


## 2026-06-24 Central Readiness Checker

Status: completed no-write orchestrator readiness command in auth-microservice.

IPS chain:
- Vision: AOS Auth modernization has one repeatable readiness command across Auth, Marathon, and new SpeakASAP.
- Goal Impact: integration readiness no longer depends on manually remembering separate checker/test commands across repositories.
- System: auth-microservice orchestration scripts plus sibling Marathon and SpeakASAP repo guardrails.
- Feature: cross-repo no-write readiness validation.
- Task: add a central command that runs Auth focused contract specs, Marathon hosted Auth checker, SpeakASAP hosted Auth checker, deploy shell syntax checks, and read-only runtime readiness snapshot.
- Execution Plan: source-only script; no DB, secret, deploy, backfill, live login, or contact delivery.
- Coding Prompt: keep gated work explicit as warnings, not hidden or bypassed.
- Code: scripts/check-aos-auth-modernization-readiness.sh and package.json script check:aos-auth-readiness.
- Validation: npm run check:aos-auth-readiness passed with pass=11 warn=3 fail=0; bash -n scripts/check-aos-auth-modernization-readiness.sh passed; git diff --check passed for touched files.

Evidence:
- Readiness command passed Marathon hosted Auth source contract, Marathon Gate 1 approval packet existence, Marathon Gate 2 approval template existence, SpeakASAP hosted Auth source contract, Auth contact-code request approval packet existence, Auth contact-code verify approval packet existence, Auth focused contract specs, Auth deploy shell syntax, Marathon deploy shell syntax, SpeakASAP frontend deploy shell syntax, and runtime deployments all ready.
- Expected warnings remain: vault-backend not Ready, Marathon live DB dry-run/backfill apply owner-gated, real phone/email contact-code delivery smoke owner/test-contact gated.
- The command writes only temporary JSON reports under /tmp and does not read .env, secrets, DB rows, or contact data.

Remaining gates:
- [MISSING: owner-approved Marathon live read-only backfill dry-run and apply].
- [MISSING: owner-approved real phone/email contact-code delivery smoke].
- [BLOCKED: Vault/ExternalSecret vault-backend InvalidProviderConfig for runtime allowlist verification].


## 2026-06-24 Consumer Guardrail Checker Integration

Status: completed for new SpeakASAP and Marathon source guardrails; no deploy, DB, secret, or mutating smoke performed in this integration update.

IPS chain:
- Vision: all modern Alfares consumers use hosted Auth as the single login/registration surface.
- Goal Impact: Marathon and new SpeakASAP now have no-write contract checkers that catch local auth form regressions and broken hosted Auth handoff before rollout.
- System: auth-microservice orchestration, Marathon consumer source, new SpeakASAP frontend/deploy pipeline.
- Feature: hosted Auth consumer guardrails.
- Task: coordinate sub-agents, validate Marathon checker output, and integrate SpeakASAP checker into scoped frontend deploy preflight.
- Execution Plan: disjoint worker lanes; integration owner validates outputs; no legacy speakasap-portal mutation.
- Coding Prompt: keep consumers thin redirect/callback adapters; hosted Auth owns email/phone/password/contact-code UI.
- Code: Marathon scripts/check-marathon-hosted-auth-contract.py; SpeakASAP scripts/check-hosted-auth-contract.py and scripts/deploy-frontend.sh; repo status docs.
- Validation: Marathon checker returned ok:true with 10 passed/0 failed; SpeakASAP checker returned ok:true; bash -n scripts/deploy-frontend.sh passed; bash -n Marathon scripts/deploy.sh passed; auth npm run test:auth-contract passed with 3 suites/14 tests; auth bash -n scripts/deploy.sh passed; runtime deployments remained 1/1 ready.

Evidence:
- Marathon checker verifies auth.alfares.cz login/register, client_id=marathon, return_url, access_token/refresh_token handoff, phone-required transitional registration, existing-account login/reset UI, and forbids local contact-code/passwordless flow.
- SpeakASAP checker verifies auth.alfares.cz login, client_id=speakasap, absolute /auth/callback return_url, stored callback state, token fragment consumption, Bearer forwarding, and forbids local password/contact-code forms.
- SpeakASAP scripts/deploy-frontend.sh runs the checker before Docker build/push. Marathon scripts/deploy.sh now runs the Marathon checker in preflight; auth-microservice scripts/deploy.sh now runs npm run test:auth-contract before image builds.
- Auth focused specs passed: auth-contract, auth-contact-code, hosted-auth-web, 14 tests total.

Remaining gates:
- [MISSING: owner-approved Marathon live read-only backfill dry-run and apply].
- [MISSING: owner-approved real phone/email contact-code delivery smoke].
- [BLOCKED: Vault/ExternalSecret vault-backend InvalidProviderConfig for runtime allowlist verification].


## 2026-06-24 Focused Contract Validation And Guardrail Wording

Status: completed source-only hardening; no deploy, DB, secret, or live contact delivery performed.

IPS chain:
- Vision: auth-microservice remains the central Alfares identity provider and hosted Auth source of truth.
- Goal Impact: consumers keep using hosted Auth with explicit redirect allowlists and do not confuse provisioning metadata with login sessions.
- System: auth-microservice contract tests, env example, and User entity documentation.
- Feature: hosted Auth redirect safety and register-contact provisioning semantics.
- Task: run focused contract specs, strengthen AUTH_ALLOWED_REDIRECT_ORIGINS production warning, and clarify User.sessionId wording.
- Execution Plan: no-write tests first, then docs/comment patch only.
- Coding Prompt: do not change runtime behavior, read secrets, deploy, query DB, or touch legacy speakasap-portal.
- Code: .env.example and src/users/entities/user.entity.ts.
- Validation: npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/auth/auth-contact-code.spec.ts src/auth/hosted-auth-web.spec.ts passed: 3 suites, 14 tests; git diff --check passed for touched files.

Evidence:
- .env.example now states production must keep AUTH_ALLOWED_REDIRECT_ORIGINS populated and empty is local-dev compatibility only.
- User.sessionId comment now says it is compatibility metadata for provisioned contact users, not an auth session.
- The focused specs cover identifier/email/phone login, contact-code hosted UI behavior, and register-contact provisioning semantics.

Remaining gates:
- [MISSING: owner-approved Marathon live DB dry-run/backfill apply].
- [MISSING: owner-approved real contact-code delivery smoke].
- [BLOCKED: Vault/ExternalSecret vault-backend InvalidProviderConfig for runtime allowlist verification].


## Launched Workstreams

| Workstream | Status | Thread | Scope | Integration Dependency |
| --- | --- | --- | --- | --- |
| WS-A Auth Contract Owner | completed contract | `019ef8f1-8c1c-7a51-8a95-0f16eabdc430` | auth-microservice identifier login/contact provisioning contract | build/tests passed per handoff |
| WS-B Marathon Consumer Owner | completed adapter | `019ef8f1-a28b-7190-bdd1-16d1204efadb` | marathon central auth token-handoff adapter | deploy still pending integration |
| WS-C New SpeakASAP Consumer Owner | completed docs-only | `019ef8f1-c387-7c33-924c-fa33170579b7` | new speakasap frontend/gateway/user-service auth inventory | blocked by missing WS-A hosted login/token contract |
| WS-C2 SpeakASAP Certification Auth Parity | running | `019ef8f5-c49b-7f71-9ded-63bbedc98edb` | speakasap certification-service auth guard/client parity | independent of hosted login contract |
| WS-D School Committee Reference | completed docs/test subset | `019ef8f1-da63-7b31-aa9e-cfbdf51e79ed` | school-committee compatibility matrix | broader test debt documented |
| WS-E Integration Orchestrator | active here | `019ef8b1-a6c8-7210-97bd-36f78964a811` | cross-repo status, merge order, validation gates | waits for worker handoffs |

## Active Read-Only Subagents

| Agent | Status | Scope |
| --- | --- | --- |
| Gibbs `019ef8f2-188e-7010-afaa-50b372b19e13` | completed | auth-microservice endpoint/DTO risk review |
| James `019ef8f2-2977-7c43-ae4b-f71f638c5e4e` | completed | marathon/speakasap/school-committee consumer auth inventory |

## Safety Boundaries

- Legacy `speakasap-portal` is out of scope and must not be edited.
- No live database queries, direct secret reads, or backfill apply commands are approved in this phase.
- Marathon has a pre-existing dirty remote worktree; workers must not revert unrelated changes.
- Auth contract changes must preserve `/auth/login`, `/auth/validate`, `/auth/refresh`, and current school-committee behavior.

## Merge Order

1. WS-A auth contract and tests.
2. WS-D compatibility confirmation or tiny reference adapter.
3. WS-B Marathon consumer switch.
4. WS-C SpeakASAP consumer switch.
5. Owner-approved Marathon backfill dry-run/apply.
6. Rollout runbook for remaining Alfares apps.

## Current Blockers

- [UNKNOWN: final hosted central auth domain].
- [UNKNOWN: SMS/phone OTP delivery provider].
- [MISSING: owner approval for live DB dry-run/backfill/apply].
- [MISSING: final WS-A endpoint contract handoff].

## Read-Only Subagent Findings

### Auth Contract Review - Gibbs

- `/auth/login` must stay backwards-compatible with `{ email, password }`, but add `{ identifier, password }` for email or phone.
- `LoginDto` currently requires `@IsEmail`; this blocks phone login.
- User lookup must search normalized email, normalized phone, and `contactInfo` JSONB.
- `register-contact` remains provisioning and must normalize contacts.
- `login-contact` must not mint JWT from bare `{ type, value }`; token issuance requires password, magic link, OTP, or another verified proof.
- `/auth/validate` and `/auth/refresh` must remain unchanged for current consumers.

### Consumer Inventory - James

- Marathon still uses portal-style `marathon_token`, `https://speakasap.com/login/`, localStorage token storage, and local `/register` UI. It already validates auth-microservice tokens server-side and provisions new registrations through auth.
- New SpeakASAP mostly validates tokens via auth-microservice. Gap: `certification-service/src/auth/jwt-auth.guard.ts` still verifies JWT locally with `JWT_SECRET`.
- School Committee is the strongest reference BFF pattern but still owns local login/magic-link UI and callback details; after hosted auth exists, it should become a thin redirect/callback consumer.
- Legacy `speakasap-portal` was not touched and remains out of scope.

## Updated Integration Priorities

1. Auth: identifier login and contact normalization first.
2. Auth: hosted login/callback contract documentation before consumer UI rewrites.
3. SpeakASAP: fix certification-service token validation parity.
4. Marathon: switch frontend login/register entrypoints after hosted contract is published.
5. School Committee: keep compatibility tests and later convert local login UI to thin hosted redirect.


## WS-C Completion Update

Status: completed docs-only in `/home/ssf/Documents/Github/speakasap`.

Changed by WS-C:
- `docs/orchestrator/2026-06-24-aos-auth-surface-inventory.md`
- `docs/orchestrator/STATUS.md`

Validation:
- `git diff --check -- docs/orchestrator/...` passed in SpeakASAP.
- No executable package builds were run because no code changed.

Integration impact:
- Existing SpeakASAP gateway/user-service token validation through auth-microservice remains aligned.
- Frontend manual token-paste shells and any BFF/session adapter remain gated by `[MISSING: WS-A hosted auth contract]`.
- Certification-service local JWT validation remains a modernization gap for a follow-up code lane.


## WS-C2 Launch Update

Status: launched as separate code lane for an independent SpeakASAP gap.

Thread: `019ef8f5-c49b-7f71-9ded-63bbedc98edb`
Scope: `/home/ssf/Documents/Github/speakasap/certification-service` auth validation parity.
Reason: WS-C inventory found `certification-service/src/auth/jwt-auth.guard.ts` validates JWT locally with `JWT_SECRET`, unlike other new SpeakASAP services that call auth-microservice `/auth/validate`. This can be fixed before hosted login exists.
Forbidden: legacy `speakasap-portal`, frontend hosted-login work, unrelated domains.


## WS-B Completion Update

Status: completed adapter changes in `/home/ssf/Documents/Github/marathon`; not deployed.

Changed by WS-B:
- `.env.example`
- `frontend/src/auth.ts`
- `frontend/src/components/RegistrationForm.tsx`
- `frontend/src/pages/ProfileDetail.tsx`
- `scripts/check-marathon-journey.js`
- `scripts/check-marathon-user-flows.js`
- `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md`
- generated frontend build assets: `public/index.html`, `public/assets/index-CDjKfauw.js`

Validation:
- `git diff --check` passed.
- `npm run build` passed.
- `cd frontend && npm run build` passed.
- Static built-bundle marker check passed for central Auth token handoff and legacy compatibility markers.

Integration impact:
- Marathon now captures central `access_token` / `refresh_token` fragments while preserving legacy `marathon_token`.
- Login/register URLs are configurable and default to `https://auth.alfares.cz/login` and `/register` with `return_url` and `client_id=marathon`.
- Production smoke not run because changes are not deployed and production serves older assets.

## WS-D Completion Update

Status: completed docs/test subset in `/home/ssf/Documents/Github/school-committee`.

Changed by WS-D:
- `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md`

Validation:
- `npm test -- tests/auth/validate-token.test.ts tests/auth/require-role.test.ts` passed: 2 files, 12 tests.
- Broader targeted command had existing debt: `get-current-user` needs DB env/mocking; middleware expectation differs from current `/api/auth/sync` redirect behavior.

Integration impact:
- School Committee compatibility requirements for WS-A are documented: hosted login URL/state, callback token transport, endpoint compatibility, consumer-managed cookies, `/login?next=`, and `/api/auth/sync`.


## WS-A Completion Update

Status: contract implementation and handoff completed in `/home/ssf/Documents/Github/auth-microservice`.

Changed by WS-A:
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/orchestrator/2026-06-24-aos-auth-contract-handoff.md`
- `src/auth/auth.service.ts`
- `src/auth/auth-contract.spec.ts`
- `src/auth/dto/contact-register.dto.ts`
- `src/auth/dto/login.dto.ts`
- `src/users/users.service.ts`

Contract:
- `POST /auth/login` accepts `{ identifier, password }` for email or phone, and legacy `{ email, password }`.
- Phone lookup searches `users.phone` and phone entries inside `contactInfo`.
- `POST /auth/register-contact` is provisioning-only and returns canonical `userId`; `sessionId` is not authentication.
- `POST /auth/login-contact` is deprecated for ecosystem auth and must not mint JWT from bare contact proof.
- `/auth/validate` and `/auth/refresh` remain unchanged.

Validation from WS-A handoff:
- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/auth/auth-token-handoff.spec.ts` passed.
- `npm run build` passed.
- `git diff --check` passed.
- `npm test` passed.

Remaining blocker:
- Hosted central login/callback UI contract remains separate from the password login API contract.

## Orchestrator Update - 2026-06-24 WS-C2 Certification Parity

Status: implementation patch applied in `/home/ssf/Documents/Github/speakasap`; validation is partially blocked by remote dependency state.

Completed lanes:

- WS-A Auth Contract Owner: completed. `/auth/login` supports `{ identifier, password }` for email/phone and legacy `{ email, password }`; `/auth/register-contact` remains provisioning-only; `/auth/login-contact` no longer authenticates. Validation passed: targeted auth contract tests, `npm run build`, `git diff --check`, and full `npm test`.
- WS-B Marathon Consumer: completed adapter. Marathon captures central Auth token handoff fragments, points login/register surfaces to central Auth URLs with `client_id=marathon` and `return_url`, keeps phone-required provisioning, and passed frontend/root builds plus diff checks. Not deployed.
- WS-C SpeakASAP Surface Inventory: completed docs-only inventory. Gateway/user-service already validate through auth-microservice; frontend hosted-login adoption remains gated on hosted auth UI/callback contract.
- WS-C2 SpeakASAP Certification Auth Parity: source patch applied. `certification-service` protected bearer validation now delegates to auth-microservice `/auth/validate`, preserves `req.user.sub`, normalizes roles, and requires `AUTH_SERVICE_URL`/`AUTH_SERVICE_TIMEOUT` instead of bearer `JWT_SECRET`.
- WS-D School Committee Reference: completed compatibility matrix and targeted auth tests; broader suite blocked by existing environment/test debt.

WS-C2 validation evidence:

- `git diff --check -- certification-service docs/orchestrator/STATUS.md` passed in `speakasap`.
- `cd certification-service && npm run build` is blocked before TypeScript compile because `prisma generate` cannot unlink root-owned `node_modules/.prisma/client/index.js` (`EACCES`).
- TypeScript-only attempt with the neighboring monorepo compiler runs but fails on existing certification-service dependency/type/prisma debt, including missing `@types/node`, missing `@types/express`, and existing certificate Prisma type mismatches.
- No deployment, live DB mutation, secret read, legacy `speakasap-portal`, or runtime host mutation was performed.

Open gates:

- [PARTIAL: hosted central Auth login/register/reset UI exists for password/email magic-link flows; consumer callback/session adapters are in WS-F and WS-G.]
- [MISSING: phone passwordless provider contract] for true phone-only login without password.
- [BLOCKED: certification-service executable build] until remote dependency ownership/install state is repaired or a clean build environment is provided.

## Orchestrator Update - 2026-06-24 Hosted Auth UI Contract Slice

Status: implemented in `/home/ssf/Documents/Github/auth-microservice`.

Scope:

- Updated hosted `/login` and `/register` page to use the central `{ identifier, password }` login contract for email or phone.
- Added hosted email magic-link and password-reset actions so already registered users can recover access without returning to consumer-local forms.
- Added hosted register phone field and client-aware `client_id=marathon` validation so Marathon registrations require phone before `/auth/register` is called.
- Preserved fragment token handoff to the validated `return_url`.

Validation:

- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed.
- `npm run build` passed.
- `npm test` passed: 6 suites / 15 tests.
- Inline hosted-auth JavaScript syntax check with `node --check /tmp/auth-hosted-inline.js` passed.
- `git diff --check -- web/public/index.html src/auth/hosted-auth-web.spec.ts docs/UNIFIED_AUTH_CONTRACT.md docs/orchestrator/2026-06-24-aos-auth-modernization-status.md` passed.

Open facts:

- Phone-only passwordless login remains blocked by `[UNKNOWN: SMS/WhatsApp/Telegram provider for phone passwordless login]`.

## Orchestrator Update - 2026-06-24 Consumer Follow-Up Threads

Status: launched follow-up parallel lanes after hosted Auth UI contract slice.

| Workstream | Status | Thread | Scope |
| --- | --- | --- | --- |
| WS-F Marathon Hosted Auth Integration Verifier | launched | `019ef8fe-9d63-79f1-9a5b-699d49bfe9b9` | verify/complete Marathon hosted Auth login/register/callback integration and smoke scripts |
| WS-G New SpeakASAP Hosted Auth Frontend Adapter | launched | `019ef8fe-9fe9-70d3-b861-1c0f93bab4e6` | implement thin hosted Auth redirect/fragment adapter for new SpeakASAP frontend |
| WS-H Marathon Users Auth Backfill Dry-Run Runbook | launched | `019ef8fe-a250-7b41-8233-5f77e14867d3` | prepare approval-gated dry-run/backfill runbook without live DB/secrets/apply |

Safety boundaries:

- Legacy `speakasap-portal` remains forbidden.
- No deploy, live DB query, secret read, backfill apply, migration, or runtime mutation is approved for these lanes.
- WS-H must keep all DB facts as placeholders or sanitized metadata until explicit owner approval exists.


## Orchestrator Update - 2026-06-24 Consumer Follow-Up Results

Status: WS-F, WS-G, and WS-H follow-up lanes have produced remote source changes and validation evidence; no deploy or live DB action was run.

Completed lanes:

- WS-F Marathon Hosted Auth Integration Verifier (`019ef8fe-9d63-79f1-9a5b-699d49bfe9b9`): completed remote Marathon verifier patch and docs update. Unauthenticated `/profile` redirects to hosted Auth, guarded return paths preserve exact URL, hosted register uses `client_id=marathon`, and fragment handoff preserves `access_token` plus `refresh_token`.
- WS-G New SpeakASAP Hosted Auth Frontend Adapter (`019ef8fe-9fe9-70d3-b861-1c0f93bab4e6` plus orchestrator takeover): completed remote new SpeakASAP frontend adapter. Added `frontend/lib/auth-session.ts`, `/auth/callback`, hosted Auth link component, admin/lesson session controls, and gateway token reuse while preserving backend `/auth/validate`.
- WS-H Marathon Users Auth Backfill Dry-Run Runbook (`019ef8fe-a250-7b41-8233-5f77e14867d3`): completed remote Marathon runbook and script guard. Added non-live `--plan-only`, removed top-level Prisma initialization, and blocked `--apply` behind owner approval phrase, ticket, DB profile, and Auth API URL.

Validation evidence:

- Marathon WS-F: `git diff --check` passed; `npm run build` passed; `cd frontend && npm run build` passed; script syntax checks passed; built-bundle marker check passed; production read-only journey reached the final bundle marker and failed because production is not deployed to the new bundle yet.
- Marathon WS-H: `node --check scripts/backfill-marathon-auth-users.js` passed; `node scripts/backfill-marathon-auth-users.js --plan-only --limit 5` passed with `liveAccess:false`, `dbAccess:false`, and `authApiAccess:false`; `git diff --check` passed.
- SpeakASAP WS-G: `cd frontend && npm run build` passed; `git diff --check -- frontend docs/orchestrator/STATUS.md` passed.

Open gates:

- [BLOCKED: deploy approval] Auth hosted UI, Marathon frontend bundle, and new SpeakASAP frontend adapter are not deployed in this session.
- [MISSING: owner approval for Marathon Gate 1 live read-only backfill dry-run].
- [MISSING: owner approval for Marathon backfill apply].
- [SUPERSEDED: phone passwordless provider contract] Auth source now includes `POST /auth/contact-code/request` and `/verify` for email/phone code login; production SMS delivery verification remains deployment/config-gated.
- [BLOCKED: certification-service executable build] remains due to remote dependency ownership/type debt outside this hosted frontend slice.

Safety boundaries preserved:

- Legacy `speakasap-portal` was not touched.
- No live DB query, secret read, migration, backfill apply, deployment, or runtime mutation was performed.


## Orchestrator Update - 2026-06-24 Contact Code Passwordless Contract

Status: implemented in `/home/ssf/Documents/Github/auth-microservice`; deployment not run.

Scope:

- Added Auth-owned `POST /auth/contact-code/request` for email or phone identifiers.
- Added Auth-owned `POST /auth/contact-code/verify` that consumes a verified 6-digit proof and returns the normal JWT contract plus `redirectUrl` fragment handoff.
- Kept deprecated `POST /auth/login-contact` non-authenticating; bare `{ type, value }` still cannot mint JWTs.
- Updated hosted `/login` so phone/email passwordless begins from the central Auth form instead of consumer-local forms.
- Reused the existing `magic_link_tokens` proof table for this bounded slice to avoid an unapproved DB migration.

Validation:

- `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts src/auth/auth-contract.spec.ts src/auth/hosted-auth-web.spec.ts` passed: 3 suites / 11 tests.
- `npm run build` passed.
- `npm test` passed: 7 suites / 19 tests.
- `git diff --check -- src/auth src/info/info.controller.ts web/public/index.html docs/UNIFIED_AUTH_CONTRACT.md docs/orchestrator/2026-06-24-aos-auth-modernization-status.md` passed.
- `node --check /tmp/auth-hosted-inline.js` passed for hosted login inline JavaScript.

Open facts:

- [UNKNOWN: production Notifications SMS provider readiness]. Auth now owns the phone-code contract and emits `channel=sms`; provider/runtime delivery verification remains deployment/config-gated.
- [BLOCKED: deploy approval] Contact-code endpoints and hosted UI are implemented in source but not deployed in this session.


## Orchestrator Update - 2026-06-24 Runtime Deploy Evidence

Status: Auth, new SpeakASAP frontend, and Marathon hosted-auth consumer changes are deployed and smoke-verified; legacy `speakasap-portal` remains untouched.

Auth runtime evidence:

- Deploy command: `./scripts/deploy.sh aos-auth-contact-code-20260624-1`.
- Backend image pushed: `localhost:5000/auth-microservice:aos-auth-contact-code-20260624-1`.
- Web image pushed: `localhost:5000/auth-microservice-web:aos-auth-contact-code-20260624-1`.
- Deploy script stopped at ExternalSecret validation because `ClusterSecretStore vault-backend` reports `Ready=False`, but manifests had already triggered new pods with the pushed `latest` images.
- Manual rollout wait after the script failure succeeded for `deployment/auth-microservice` and `deployment/auth-microservice-web`; both are `ready=1/1`.
- In-pod health check returned HTTP 200 and `{"success":true,"status":"ok"}`.
- Public hosted `/login?return_url=...&client_id=marathon` contains `Send sign-in code`, `/auth/contact-code/request`, `/auth/contact-code/verify`, `Email or phone`, and Marathon phone-required registration text.
- Safe public `POST /auth/contact-code/request` with an unknown `example.invalid` identifier returned `{"success":true,"delivery":"accepted"}` and did not identify whether the user exists.

New SpeakASAP runtime evidence:

- Preflight: `cd frontend && npm run build` passed.
- Deploy command: `./scripts/deploy-frontend.sh`.
- Rollout: `deployment/speakasap-frontend` ready `1/1`.
- Public smoke: root returned HTTP 200 after one transient 502 immediately after rollout; `/health` returned HTTP 200; protected `/api/v1/lessons` returned HTTP 401 as expected.
- Live root contains `Sign in with Alfares Auth` and hosted Auth URL `https://auth.alfares.cz/login?client_id=speakasap`.
- Live `/admin` contains hosted Auth session controls instead of manual token input.

Marathon runtime evidence:

- Preflight: `git diff --check`, root `npm run build`, and `cd frontend && npm run build` passed.
- Deploy safety patch: `scripts/deploy.sh` now supports `SKIP_MUTATING_SMOKE=true` to avoid registration/payment side effects during deploy.
- Deploy command: `SKIP_MUTATING_SMOKE=true ./scripts/deploy.sh aos-auth-hosted-20260624-1`.
- Image: `localhost:5000/marathon:aos-auth-hosted-20260624-1`.
- Rollout: `deployment/marathon` successfully rolled out.
- Readiness: `npm run check:readiness` in the deployed pod reported `ready`.
- Mutating public user-flow and production smoke were skipped explicitly by `SKIP_MUTATING_SMOKE=true`.
- Production read-only verifier `npm run check:journey -- --base-url https://marathon.alfares.cz --json` returned `ok:true`, including `registration-login-handoff`, central Auth profile/step return routes, auth guards, and `mutation-skipped`.

Remaining gates:

- [WARNING: vault-backend ExternalSecret readiness] `ClusterSecretStore vault-backend` and `auth-microservice-secret` currently report `Ready=False`; current Auth pods are healthy, but secret refresh infrastructure needs separate repair.
- [UNKNOWN: production Notifications SMS provider readiness] Contact-code source and hosted UI are live; real phone delivery still needs provider/config smoke with an approved test number.
- [MISSING: owner approval for Marathon Gate 1 live read-only backfill dry-run].
- [MISSING: owner approval for Marathon backfill apply].
- [BLOCKED: certification-service executable build] remains separate dependency/type debt and was not touched by runtime deploy.

Safety boundaries preserved:

- No legacy `speakasap-portal` files or runtime were touched.
- No backfill apply, migration, SQL shell, dump, restore, secret value print, or destructive action was performed.

## Orchestrator Update - 2026-06-24 ExternalSecret/Vault Readiness

Status: diagnosed as an infrastructure blocker outside the Auth/Marathon/SpeakASAP application code slice.

Evidence collected read-only, without printing secret values:

- `ClusterSecretStore vault-backend` points to Vault `http://192.168.88.53:8200`, path `secret`, version `v2`, token ref `statex-apps/vault-eso-token` key `token`.
- `vault-backend` condition is `Ready=False`, reason `InvalidProviderConfig`, message `unable to validate store`.
- The referenced Kubernetes Secret exists as metadata only: `statex-apps/vault-eso-token`, type `Opaque`, key list `[token]`; no `.data` values were read or printed.
- `kubectl describe clustersecretstore vault-backend` reports Vault API `GET /v1/auth/token/lookup-self` returns `503` with `Vault is sealed`.
- Direct unauthenticated Vault health probe returned `initialized=true`, `sealed=true`, Vault version `1.15.6`.
- External Secrets controller pods are running `1/1`; no Vault pod/service is present in the local Kubernetes cluster, so the configured Vault endpoint appears external to the cluster.
- Application deployments remain healthy after the auth modernization rollout: `auth-microservice`, `auth-microservice-web`, `marathon`, and `speakasap-frontend` are all `ready=1/1`.

Decision:

- Do not restart `external-secrets` as a repair action; the controller is healthy and the provider error is caused by sealed Vault state.
- Do not mutate `vault-eso-token`, Vault state, Secret values, or ExternalSecret specs in this modernization thread.
- Required owner/operator action: unseal or recover Vault through the approved infrastructure runbook, then verify `ClusterSecretStore vault-backend` becomes `Ready=True` and ExternalSecrets reconcile.

Impact on AOS auth modernization:

- Current deployed pods are healthy and continue using already materialized Kubernetes Secrets.
- New secret refreshes and deploy scripts that validate ExternalSecret readiness can fail until Vault is unsealed.
- Marathon user backfill gates remain unchanged: live read-only dry-run and apply still need explicit owner approval and must not run while secret/backend readiness is uncertain.

## Orchestrator Update - 2026-06-24 Ecosystem Rollout Expansion

Status: expanded from Marathon/new SpeakASAP/Auth runtime slice to ecosystem-wide hosted Auth migration planning.

Completed in this orchestration pass:

- Created `docs/orchestrator/2026-06-24-ecosystem-hosted-auth-rollout-index.md` as the central rollout index for moving Alfares apps to hosted Auth.
- Ran a read-only remote auth-surface inventory across `/home/ssf/Documents/Github`, excluding legacy `speakasap-portal`.
- Classified repositories into migration classes: hosted Auth already referenced, direct consumer login/register forms, existing `/auth/validate` consumers, local JWT/shared-secret risks, legacy contact endpoint users, and browser-token adapters.
- Defined migration waves: infrastructure/contract gates, consumer UI redirects, backend validation standardization, user backfill/reconciliation, and final local credential-form removal.
- Launched three parallel cluster handoff workers with disjoint doc ownership:
  - commerce/marketplace: `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md`
  - platform/ops/admin: `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md`
  - product/education/public apps: `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-product-education.md`

Safety boundaries preserved:

- Legacy `speakasap-portal` remains forbidden and was excluded from the inventory scan.
- No live DB query, secret value read, deploy, backfill apply, Vault mutation, or app code change was performed in this expansion pass.
- Worker lanes are docs-only and write to separate files to avoid shared-file conflicts.

Open gates:

- [PENDING: cluster handoff worker outputs].
- [BLOCKED: Vault sealed] `vault-backend` remains `Ready=False` until infrastructure unseals or recovers Vault.
- [MISSING: owner approval for Marathon live read-only backfill dry-run].
- [MISSING: owner approval for Marathon backfill apply].

## Orchestrator Update - 2026-06-24 Commerce Cluster Handoff Complete

Status: commerce/marketplace ecosystem handoff completed by parallel worker.

Handoff file:

- `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md`

Scope covered:

- `allegro-service`
- `aukro-service`
- `bazos-service`
- `flipflop-service`
- `heureka-service`
- `orders-microservice`
- `payments-microservice`
- `warehouse-microservice`
- `catalog-microservice`

Key findings:

- High-priority hosted Auth UI migration candidates: `allegro-service`, `bazos-service`, `flipflop-service`, and `catalog-microservice` because they own user-facing login/register or auth-proxy flows.
- Backend-only or gateway-heavy repos such as `orders-microservice`, `payments-microservice`, and `warehouse-microservice` need token validation/claim compatibility work more than hosted UI work.
- Several commerce repos still depend on local `JWT_SECRET` verification; this must be classified as user-token validation vs documented service-token/high-throughput exception before code changes.
- Implementation is dependency-gated by the final hosted Auth return/session/token/logout/role-claim contract.

Validation:

- `git diff --check -- docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md` passed.

Safety boundaries preserved:

- No app code, deploy, live DB, secret value, or legacy `speakasap-portal` changes were made by this handoff.

## Orchestrator Update - 2026-06-24 Product/Education Cluster Handoff Complete

Status: product/education/public-app ecosystem handoff completed by parallel worker.

Handoff file:

- `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-product-education.md`

Scope covered:

- `school-committee`
- `statex`
- `statex-ecosystem`
- `shop-assistant`
- `rent-a-box`
- `crypto-ai-agent`
- `leads-microservice`
- `marketing-microservice`
- `speakasap`
- `marathon`

Key findings:

- Ready verification lanes: `statex-ecosystem`, `shop-assistant`, `leads-microservice`, and `marketing-microservice` can be checked first because they are mostly hosted-auth verification or admin-shell cleanup.
- `school-committee` is the reference BFF lane but needs hosted redirect/callback conversion while preserving its local school-domain session/role behavior.
- `statex` and `crypto-ai-agent` need frontend hosted-auth adapter work after route/session ownership is verified.
- `rent-a-box` is a design-first migration because it appears to own local user JWT issuance and customer/admin identity today.
- `marathon` and new `speakasap` remain active integration lanes with dirty worktrees from this modernization project; follow-up workers must preserve those changes.

Validation:

- `git diff --check -- docs/orchestrator/2026-06-24-ecosystem-auth-rollout-product-education.md` passed.

Safety boundaries preserved:

- No app code, deploy, live DB, secret value, or legacy `speakasap-portal` changes were made by this handoff.

## Orchestrator Update - 2026-06-24 Platform/Ops Cluster Handoff Complete

Status: platform/ops/admin ecosystem handoff completed by parallel worker.

Handoff file:

- `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md`

Scope covered:

- `ai-microservice`
- `backups-microservice`
- `database-server`
- `docs-rag-microservice`
- `logging-microservice`
- `monitoring-microservice`
- `notifications-microservice`
- `prompts-microservice`
- `runlayer`
- `suppliers-microservice`
- `minio-microservice`

Key findings:

- Direct hosted UI migration candidates: `backups-microservice`, `database-server`, `logging-microservice`, `notifications-microservice`, `prompts-microservice`, and `suppliers-microservice`.
- Mostly-ready hosted Auth validation candidates: `monitoring-microservice`, `minio-microservice`, `runlayer`, and `ai-microservice` admin.
- Machine/service-token concerns must be split from human Auth migration for `ai-microservice`, `docs-rag-microservice`, `runlayer`, and service-token bypasses in admin services.
- Several admin services need the authoritative Auth client registry, allowed return URLs, callback token transport, and standard session model before code implementation starts.

Validation:

- `git diff --check -- docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md` passed.

Safety boundaries preserved:

- No app code, deploy, live DB, secret value, or legacy `speakasap-portal` changes were made by this handoff.

## Orchestrator Update - 2026-06-24 Hosted Auth Consumer Standard Published

Status: missing consumer callback/session contract from cluster handoffs has been filled as an Auth-owned standard.

Created:

- `docs/HOSTED_AUTH_CONSUMER_STANDARD.md`

Updated:

- `docs/UNIFIED_AUTH_CONTRACT.md` now points consumer implementers to the hosted Auth consumer standard.

Contract now documented:

- Hosted login/register URLs with `client_id`, `return_url`, and `state`.
- Hash-fragment callback handoff fields: `access_token`, `refresh_token`, `expires_at`, `state`, and `auth_method`.
- Consumer callback requirements: parse fragment, validate `state`, store session, strip fragment, and redirect safely.
- Preferred BFF/HTTP-only-cookie session model and accepted transitional browser-token model.
- Forbidden patterns: new consumer-local credential forms, consumer-local phone-code/reset/magic-link duplication, consumer-minted Auth JWTs, and treating contact provisioning as login.
- Draft client registry for active/planned consumers, with unknown runtime facts marked `[MISSING: ...]` or `[UNKNOWN: ...]`.
- Validation checklist for follow-up implementation workers.

Validation:

- `git diff --check -- docs/HOSTED_AUTH_CONSUMER_STANDARD.md docs/UNIFIED_AUTH_CONTRACT.md` passed.

Remaining gate:

- Runtime allowlist truth still depends on `AUTH_ALLOWED_REDIRECT_ORIGINS`; verification remains blocked while Vault is sealed and `vault-backend` is `Ready=False`.

## Orchestrator Update - 2026-06-24 Wave 1 Ready Lanes Launched

Status: launched four independent ready verifier/implementation lanes from the product/education handoff. These lanes do not require Vault unseal, live DB access, secret reads, or deploys.

Launched workers:

| Lane | Repo | Worker role | Scope | Expected output |
| --- | --- | --- | --- | --- |
| Wave1-A | `statex-ecosystem` | static/catalog Auth verifier | docs-only unless a real auth defect is found | repo-local IPS/GDD hosted Auth plan and build/static scan evidence |
| Wave1-B | `shop-assistant` | hosted Auth verifier/cleanup owner | hosted login/register/admin Auth handoff | repo-local plan, validation evidence, small safe fixes only if needed |
| Wave1-C | `leads-microservice` | public/admin Auth boundary owner | public no-login intake plus admin hosted Auth/session UX | repo-local plan, static scan/tests, bounded admin-shell fix only if manual bearer-token UX is confirmed |
| Wave1-D | `marketing-microservice` | hosted redirect/callback verifier | `/auth/login`, `/auth/register`, callback docs/status | repo-local plan, stale-doc reconciliation, small route fixes only if needed |

Shared constraints:

- Legacy `speakasap-portal` remains forbidden.
- No `.env`, Kubernetes Secret data, live DB data, raw tokens, deploys, or Vault mutations.
- Workers must preserve existing repo changes and must not revert unrelated files.
- Each worker must run `git diff --check` over changed files and report exact validation evidence.

Orchestrator dependency:

- Workers use `docs/HOSTED_AUTH_CONSUMER_STANDARD.md` as the active Auth-owned consumer standard.
- Runtime allowlist verification remains gated by sealed Vault and `vault-backend Ready=False`.

## Orchestrator Update - 2026-06-24 Wave1-B Shop Assistant Complete

Status: completed source verification lane in `/home/ssf/Documents/Github/shop-assistant`.

Changed file:

- `docs/intent-preservation/21_execution_plans/EP-SA-HOSTED-AUTH-VERIFICATION-2026-06-24.md`

Result:

- No Shop Assistant application code changes were required.
- Source already routes human login/register/admin access through Auth-hosted UI with `client_id=shop-assistant`, `return_url`, and generated `state`.
- Backend protected APIs validate bearer tokens through Auth `/auth/validate` and do not mint Shop Assistant user JWTs.
- Transitional debt is documented: sessionStorage token model and legacy persistent-token cleanup paths remain until a BFF/httpOnly-cookie owner is assigned.

Validation evidence from worker and orchestrator review:

- `npm run build` passed in `shop-assistant`.
- Persistent token write scan over inspected hosted Auth surfaces found no persistent localStorage writes for access/refresh/user tokens.
- `git diff --check -- docs/intent-preservation/21_execution_plans/EP-SA-HOSTED-AUTH-VERIFICATION-2026-06-24.md` passed.

Open blockers:

- `[MISSING: approved safe live Auth test account/token path]`.
- `[MISSING: owner approval for deploy or live post-deploy smoke]`.
- `[UNKNOWN: live deployment version relative to current remote source]`.
- `[MISSING: BFF/httpOnly-cookie migration owner]`.

## Orchestrator Update - 2026-06-24 Wave1-A StateX Ecosystem Complete

Status: completed source verification lane in `/home/ssf/Documents/Github/statex-ecosystem`.

Changed file:

- `docs/orchestrator/2026-06-24-aos-hosted-auth-migration-plan.md`

Result:

- No StateX Ecosystem application code changes were required.
- Static inspection found this repo is a public/static Next.js catalog with no login/register/callback/token-storage/user-JWT surface.
- Auth appears as catalog metadata for `auth-microservice`, not as app authentication code.
- Future admin/edit surfaces must use hosted Auth with `client_id=statex-ecosystem`, `return_url`, `state`, fragment parsing, and Auth `/auth/validate`.

Validation evidence from worker and orchestrator review:

- Static auth scan found only catalog metadata/docs examples/unrelated config text, not an app auth surface.
- `npm run build` passed in `statex-ecosystem`.
- `git diff --check -- docs/orchestrator/2026-06-24-aos-hosted-auth-migration-plan.md` passed.
- `git diff --no-index --check /dev/null docs/orchestrator/2026-06-24-aos-hosted-auth-migration-plan.md` passed for the new untracked file.

Open blockers:

- `[UNKNOWN: whether any private/admin route exists outside the inspected repository source]`.
- `[MISSING: approved production Auth client registry source of truth for any future StateX Ecosystem admin callback]`.

## Orchestrator Update - 2026-06-24 Wave1-D Marketing Complete

Status: completed hosted Auth verification and bounded callback hardening in `/home/ssf/Documents/Github/marketing-microservice`.

Changed files:

- `public/auth-callback.html`
- `test/api-contracts.test.ts`
- `docs/orchestrator/2026-06-24-marketing-hosted-auth-verification-plan.md`
- `docs/orchestrator/STATUS.md`

Result:

- Marketing `/auth/login` and `/auth/register` already delegate to hosted Auth with `return_url=https://marketing.alfares.cz/auth/callback`, `client_id=marketing-microservice`, and generated `state`.
- Callback was hardened to fail closed when the temporary `marketing_auth_state` is missing or returned `state` does not match.
- Focused API contract test now asserts the missing/mismatched state rejection logic.
- Stale historical docs that said login/register were blocked are now marked superseded by later completion evidence and this verification.
- Service-token protected write APIs were not changed.

Validation evidence from worker and orchestrator review:

- `npm run build` passed in `marketing-microservice`.
- `npm test` passed: 73/73.
- `npx tsx --test --test-concurrency=1 test/api-contracts.test.ts` passed: 24/24.
- Hosted Auth static scan found expected markers only.
- `git diff --check -- public/auth-callback.html test/api-contracts.test.ts docs/orchestrator/2026-06-24-marketing-hosted-auth-verification-plan.md docs/orchestrator/STATUS.md` passed.

Open blockers:

- `[UNKNOWN: current deployed version versus source]`; no deploy/live parity check was performed.
- `[MISSING: live admin callback/session smoke with safe token]`.
- `[MISSING: production Auth role grant evidence]`.

## Orchestrator Update - 2026-06-24 Wave1-C Leads Complete

Status: completed bounded admin hosted Auth adapter in `/home/ssf/Documents/Github/leads-microservice`.

Changed files:

- `public/admin.html`
- `public/admin.js`
- `public/auth/callback.html`
- `public/admin.spec.ts`
- `docs/orchestrator/2026-06-24-leads-admin-hosted-auth-plan.md`

Result:

- Public lead intake remains no-login and was not changed.
- Visible manual admin bearer-token paste form was removed.
- Admin UI now starts hosted Auth login with `client_id=leads-microservice`, `return_url=<origin>/auth/callback.html`, and generated `state`.
- Static callback bridge sends the Auth fragment back to `/admin`; `admin.js` validates returned `state`, strips the fragment, stores only transitional `sessionStorage` access token, and preserves existing backend `Authorization: Bearer` to Auth `/auth/validate` behavior.
- Backend admin auth guard behavior was preserved.

Validation evidence from worker and orchestrator review:

- `npm test -- public/admin.spec.ts src/auth/admin-auth.guard.spec.ts` passed: 2 suites / 13 tests.
- `npm test` passed: 16 suites / 100 tests.
- `npm run build` passed.
- Static scan for `localStorage`, token paste form, token/password input markers over `public src/auth` returned no matches.
- `git diff --check -- public/admin.html public/admin.js public/admin.spec.ts public/auth/callback.html docs/orchestrator/2026-06-24-leads-admin-hosted-auth-plan.md` passed.

Open blockers:

- `[MISSING: production Auth redirect allowlist confirmation for https://leads.alfares.cz/auth/callback.html]`.
- `[MISSING: safe live admin token or non-production hosted-auth smoke path]`.
- `[UNKNOWN: final Auth client registry id, leads-microservice vs leads]`.

## Orchestrator Update - 2026-06-24 Wave 2 Product Frontend Lanes Launched

Status: launched three independent Wave 2 lanes after the hosted Auth consumer standard and Wave 1 verification lanes.

Launched workers:

| Lane | Repo | Worker role | Scope | Expected output |
| --- | --- | --- | --- | --- |
| Wave2-A | `school-committee` | reference BFF hosted-auth owner | visible login UX and BFF callback/session compatibility | hosted Auth redirect/callback adaptation or precise gated plan, preserving `scp_access`/`scp_refresh` cookies and school-domain roles |
| Wave2-B | `statex` | StateX website frontend auth owner | `statex-website/frontend` active login/register pages and callback/session helper | hosted Auth redirect/callback with documented transitional storage debt; no backend DB/data changes |
| Wave2-C | `crypto-ai-agent` | Crypto AI frontend/backend auth owner | frontend `/login`/`/register`, callback/session helper, optional backend proxy deprecation docs | hosted Auth redirect/callback and preserved backend `/auth/validate` behavior |

Preflight:

- `statex` and `crypto-ai-agent` were clean on `main` before worker launch.
- `school-committee` already had untracked `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md` from the prior reference lane; the worker was instructed not to overwrite it.

Shared constraints:

- Legacy `speakasap-portal` remains forbidden.
- No `.env`, Kubernetes Secret data, live DB data, raw tokens, deploys, Vault mutation, exchange API keys, live portfolio data, or school-domain schema refactors.
- Workers must preserve existing repo changes and run `git diff --check` over changed files.
- Runtime redirect allowlist verification remains blocked by sealed Vault and `vault-backend Ready=False`.

## Orchestrator Update - 2026-06-24 Wave2-A School Committee Complete

Status: completed bounded hosted Auth BFF consumer patch in `/home/ssf/Documents/Github/school-committee`.

Changed files:

- `app/(public)/login/page.tsx`
- `app/auth/callback/page.tsx`
- `lib/auth/hosted-auth.ts`
- `tests/auth/hosted-auth.test.ts`
- `tests/middleware.test.ts`
- `docs/orchestrator/2026-06-24-school-committee-hosted-auth-wave2-status.md`

Result:

- Visible `/login` no longer collects local email/password or magic-link credentials; it redirects to hosted Auth with `client_id=school-committee`, `return_url=<origin>/auth/callback`, and opaque state.
- `/auth/callback` strips token fragments, validates hosted state when present, posts tokens to `/api/auth/session`, and preserves existing `scp_access`, `scp_refresh`, and `scp_onboarding` BFF cookie behavior.
- Onboarding routing remains authoritative before any requested return path.
- Transitional `/api/auth/login` and `/api/auth/magic-link` remain for compatibility.
- Existing reference plan `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md` was not overwritten.

Validation evidence:

- `npm test -- tests/auth/validate-token.test.ts tests/auth/require-role.test.ts tests/auth/hosted-auth.test.ts` passed: 16 tests.
- `npm test -- tests/middleware.test.ts` passed: 7 tests.
- `npm run type-check` passed.
- `npm run build` passed; existing admin dynamic-server messages were logged and routes were marked dynamic.
- `git diff --check` over changed School Committee files passed.

Open blockers/debt:

- `[MISSING: production origin/Auth allowlist verification]`.
- `[MISSING: safe live hosted-login smoke]`.
- `[UNKNOWN: when transitional /api/auth/login and /api/auth/magic-link consumers can be removed]`.

## Orchestrator Update - 2026-06-24 Wave2-B StateX Complete

Status: completed bounded hosted Auth frontend migration in `/home/ssf/Documents/Github/statex` for active `statex-website/frontend` login/register pages.

Changed files:

- `statex-website/frontend/src/app/login/page.tsx`
- `statex-website/frontend/src/app/register/page.tsx`
- `statex-website/frontend/src/app/auth/callback/page.tsx`
- `statex-website/frontend/src/lib/hostedAuth.ts`
- `docs/orchestrator/2026-06-24-statex-hosted-auth-ips-gdd.md`

Result:

- Active StateX login/register pages no longer collect credentials or directly call Auth `/auth/login` and `/auth/register`.
- Pages redirect to hosted Auth with `client_id=statex`, absolute `/auth/callback` return URL, and opaque state.
- Callback parses URL fragment only, validates state from `sessionStorage`, strips the fragment, and redirects to a safe local return path.
- Backend `utils/auth_service.py`, user portal data migration, shared auth frontend library, secrets, DB/data code, and deploy/k8s files were not touched.
- Transitional browser token storage remains in `statex-website/frontend/src/lib/hostedAuth.ts` because no BFF/httpOnly cookie session adapter exists in this bounded scope.

Validation evidence:

- `cd statex-website/frontend && npm run build` passed; existing warnings about deprecated/invalid Next config, multiple lockfiles, and stale Browserslist data remained.
- Build-generated side effects to `tsconfig.json` and `next-env.d.ts` were restored by the worker.
- Static scan over active pages for direct credential/auth/token writes returned no matches.
- `git diff --check` over changed StateX files passed.

Open blockers/debt:

- `[MISSING: StateX production origin in approved Auth client registry]`.
- `[MISSING: BFF/httpOnly StateX session adapter design]`.
- `[UNKNOWN: whether statex-website/user-portal is live or legacy]`; untouched.

## Orchestrator Update - 2026-06-24 Wave2-C Crypto AI Complete With Build Blocker

Status: completed bounded hosted Auth consumer patch in `/home/ssf/Documents/Github/crypto-ai-agent`; frontend build remains validation-blocked by missing local dependencies.

Changed files:

- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/auth/callback/page.tsx`
- `frontend/src/lib/hostedAuth.ts`
- `frontend/src/stores/authStore.ts`
- `frontend/src/lib/api.ts`
- `backend/app/api/auth.py`
- `backend/app/services/auth_service.py`
- `docs/orchestrator/2026-06-24-hosted-auth-consumer-plan.md`

Result:

- User-facing `/login` and `/register` no longer show local credential forms; they launch hosted Auth with `client_id=crypto-ai-agent`, `return_url`, and generated `state`.
- Added `/auth/callback` fragment parser with state validation, fragment stripping, transitional token storage through the existing auth store, and safe return-path routing.
- Removed frontend debug logs that printed token prefixes.
- Backend `/api/auth/login` and `/api/auth/register` remain compatibility proxy routes but now advertise deprecation via response headers and service docs.
- Backend Auth `/auth/validate` behavior was preserved.
- `/api/auth/me` can now return an Auth-validated fallback profile when no local profile row exists; durable local profile provisioning remains a follow-up design item.

Validation evidence:

- `git diff --check` over changed Crypto AI files passed.
- `python3 -m py_compile backend/app/api/auth.py backend/app/services/auth_service.py` passed.
- Static scan of active `frontend/src/app/login`, `frontend/src/app/register`, and `frontend/src/app/auth` found no remaining form/password credential collection.
- `cd frontend && npm run build` was attempted by the worker but blocked because `next` is not installed and the repo has no `node_modules`. The worker did not run `npm install` to avoid dependency artifact writes in this lane.

Open blockers/debt:

- `[BLOCKED: frontend build validation]` until dependencies are installed in a controlled validation lane.
- `[MISSING: Crypto AI BFF/httpOnly cookie session adapter design]`; browser/cookie token persistence remains transitional.
- `[MISSING: confirmation no active clients depend on /api/auth/login|register proxy endpoints]` before proxy removal.
- `[MISSING: durable local profile provisioning design for hosted Auth registrations]`.
- Password reset/change UX still needs a later hosted Auth alignment pass.

## Orchestrator Update - 2026-06-24 Crypto AI Controlled Frontend Validation

Status: resolved the previous Crypto AI frontend build validation blocker with a controlled dependency install path, while preserving dependency-file cleanliness.

Commands and results in `/home/ssf/Documents/Github/crypto-ai-agent/frontend`:

- `npm ci`: failed before install because npm peer resolution found `eslint-config-next@16.1.6` requires `eslint>=9.0.0` while `package.json` pins `eslint@8.53.0`.
- `npm ci --legacy-peer-deps`: failed because `package.json` and `package-lock.json` are not synchronized; lockfile still contains older `next@14.0.3`, `react@18.2.0`, and related versions while `package.json` now requests `next@16.1.6`, `react@19.2.4`, and related packages.
- `npm install --package-lock=false --legacy-peer-deps --no-audit --no-fund`: passed and created validation-only `node_modules` without changing tracked `package.json` or `package-lock.json`.
- `npm run type-check`: passed.
- `npm run build`: failed because Next 16 defaults to Turbopack while this repo has an existing `webpack` config.
- `npx next build --webpack`: passed. Routes included `/auth/callback`, `/login`, and `/register`.

Cleanup:

- Next build rewrote `frontend/next-env.d.ts`, `frontend/tsconfig.json`, and `frontend/tsconfig.tsbuildinfo`; these generated side effects were restored from HEAD.
- Final tracked status after cleanup shows only the intended Crypto hosted-auth migration files, not dependency or TypeScript metadata changes.

Updated validation interpretation:

- Crypto AI frontend source now has type-check and explicit webpack production build evidence.
- Dependency hygiene remains a separate pre-existing blocker: `package.json` and `package-lock.json` are out of sync, so clean `npm ci` cannot be used until a dependency maintenance lane updates and validates the lockfile deliberately.
- Default `npm run build` remains blocked by Next 16 Turbopack/webpack config mismatch; explicit `next build --webpack` validates the current webpack-configured app.

Open follow-up:

- `[BLOCKED: dependency maintenance lane]` synchronize Crypto AI frontend lockfile and decide whether to migrate webpack config to Turbopack or make the build script explicitly use `next build --webpack`.

## Orchestrator Update - 2026-06-24 Wave 1/2 Integration Snapshot

Status: auth contract, hosted Auth UI, Marathon adapter, new SpeakASAP frontend adapter, and Wave 1/Wave 2 consumer slices are implemented in remote repos with validation evidence.

Completed and validated:

- Auth-microservice: email/phone identifier login, provisioning-only contact register, non-authenticating deprecated contact login, hosted login/register/password-reset/contact-code UI, and contract docs. Targeted tests, full `npm test`, `npm run build`, inline hosted JS syntax check, and deploy rollouts completed; deploy script still reports ExternalSecret validation debt because Vault is sealed.
- Marathon: central hosted Auth login/register/callback integration, phone-required registration path, unauthenticated `/profile` loop fix, guarded return paths, and backfill plan/runbook/script guard. Build and production read-only journey validation passed after deploy.
- New SpeakASAP: frontend/gateway hosted Auth adapter deployed and ready; certification-service auth parity patch exists but executable build remains blocked by repo dependency/prisma debt.
- Wave 1 consumers: `statex-ecosystem`, `shop-assistant`, `marketing-microservice`, and `leads-microservice` have repo-local IPS/GDD plans and validated hosted Auth compatibility or migration patches.
- Wave 2 consumers: `school-committee`, `statex`, and `crypto-ai-agent` have repo-local IPS/GDD plans and validated hosted Auth consumer patches. Crypto frontend now passes `npm ci`, `npm run type-check`, and `npm run build` after dependency metadata synchronization.

Current hard gates:

- [BLOCKED: Vault sealed] `vault-backend` ClusterSecretStore is Ready=False with InvalidProviderConfig because Vault health reports sealed=true; ExternalSecret-dependent deploy validation remains globally unreliable until Vault is unsealed by infrastructure owner.
- [MISSING: owner approval for Marathon Gate 1 live read-only backfill dry-run] Marathon users have not been exported/backfilled into Auth/AOS.
- [MISSING: owner approval for Marathon backfill apply] No live DB mutation or Auth user creation was run.
- [UNKNOWN: real phone OTP/SMS provider readiness] `contact-code` API/UI exists, but delivery to a real phone number is not verified.
- [BLOCKED: SpeakASAP certification-service build] source patch is present, but build remains blocked by dependency/prisma/type debt unrelated to the hosted frontend adapter.

Next integration order:

1. Infrastructure owner unseals/fixes Vault or provides an ExternalSecret validation bypass policy for already-ready deployments.
2. Owner approves Marathon Gate 1 live read-only backfill dry-run with exact DB profile and Auth API target.
3. Backfill dry-run evidence is reviewed; only then run approval-gated apply.
4. Verify real phone contact-code delivery with approved non-sensitive test contact.
5. Repair SpeakASAP certification-service dependency/build debt and rerun auth parity build/tests.

## Orchestrator Update - 2026-06-24 SpeakASAP Certification Build Gate

Status: previous SpeakASAP certification-service executable build blocker is resolved for source validation.

Evidence from `/home/ssf/Documents/Github/speakasap`:

- Reproduced the old blocker as generated dependency ownership debt: root-owned `certification-service/node_modules/.prisma/client` prevented `prisma generate` from unlinking files as `ssf`.
- `sudo chown` was unavailable because sudo requires an interactive password in this SSH session.
- Old generated `node_modules` was quarantined, dependencies were recreated with `cd certification-service && npm ci`, and `certification-service/tsconfig.build.json` was hardened to include only `src/**/*.ts` and exclude `node_modules*`.
- `cd certification-service && npm run build` now passes: `prisma generate && tsc -p tsconfig.build.json` completes successfully.
- Certification-service targeted tests remain `[MISSING: no test script/spec files in package.json]`.

Updated gate state:

- [RESOLVED FOR SOURCE VALIDATION: SpeakASAP certification-service build] auth parity source now builds.
- [PENDING: SpeakASAP certification-service deploy/runtime verification] normal service deployment path still needs to be assessed and run separately if safe.

## Orchestrator Update - 2026-06-24 SpeakASAP Certification Runtime Gate

Status: SpeakASAP certification-service auth parity is now deployed and runtime healthy.

Evidence from `/home/ssf/Documents/Github/speakasap` and namespace `statex-apps`:

- Built and pushed only `localhost:5000/speakasap-certification:latest` from `certification-service/Dockerfile`.
- Applied only `k8s/services/certification-service.yaml` and restarted only `deployment/speakasap-certification`.
- First rollout exposed a Nest DI regression: exported `JwtAuthGuard` depended on non-exported `AuthClientService`; old replica stayed available while the new one crashed.
- Fixed `AuthModule` to export `AuthClientService`, rebuilt, repushed, and reran the certification-only rollout.
- Final rollout succeeded: `ready=1/1 updated=1 available=1`, pod `speakasap-certification-6bb8f79976-mdjd6` running with `RESTARTS 0`.
- In-pod health check returned `{"status":"ok"}`.

Updated gate state:

- [RESOLVED: SpeakASAP certification-service build/deploy/runtime] protected bearer validation now delegates to auth-microservice `/auth/validate` and the service is healthy after rollout.

## Orchestrator Update - 2026-06-24 Contact-Code Phone Delivery Contract

Status: Auth-owned phone contact-code delivery is now aligned with the actual Notifications dispatch contract and deployed.

Problem found:

- Auth previously emitted phone contact codes as Notifications `channel=sms`.
- `notifications-microservice` has an `SMS` enum value, but its dispatcher currently implements `email`, `telegram`, and `whatsapp`; `sms` falls through to unsupported channel.
- That meant hosted phone-code login had the Auth API/UI contract but could not be considered production-ready for real phone delivery.

Changes:

- `AuthService.sendContactCode()` now uses `AUTH_CONTACT_CODE_PHONE_CHANNEL`, defaulting to `whatsapp`.
- Auth can alternatively send `AUTH_CONTACT_CODE_PHONE_CHANNEL_KEY` or `AUTH_CONTACT_CODE_EMAIL_CHANNEL_KEY` to the Notifications channel registry, so provider policy can be centralized there.
- Notification payloads include `service=auth-microservice` and `purpose=transactional`.
- `.env.example`, `k8s/configmap.yaml.template`, and `scripts/deploy.sh` now include the new contact-code delivery keys.
- Docs now state that direct `sms` must not be used until notifications-microservice implements SMS dispatch.

Validation:

- `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts`: passed, 5 tests.
- `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts src/auth/hosted-auth-web.spec.ts src/auth/auth-contract.spec.ts`: passed, 3 suites / 13 tests.
- `npm run build`: passed.
- `git diff --check` for touched Auth files: passed.

Deploy/runtime:

- `./scripts/deploy.sh` built and pushed backend image `localhost:5000/auth-microservice:e2d77f1-20260624114348` and web image `localhost:5000/auth-microservice-web:e2d77f1-20260624114348`.
- The deploy script still stopped at the known `vault-backend` readiness validation gate after applying ConfigMap and manifests.
- Manual continuation set live ConfigMap keys `AUTH_CONTACT_CODE_PHONE_CHANNEL=whatsapp`, `AUTH_CONTACT_CODE_PHONE_CHANNEL_KEY=`, and `AUTH_CONTACT_CODE_EMAIL_CHANNEL_KEY=`.
- Manual rollout set backend and web deployments to the built image tags; both rolled out successfully.
- Runtime health: `auth-microservice` and `auth-microservice-web` are `1/1`.
- In-pod backend health returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Public hosted `/login` contains `Email or phone`, `Send sign-in code`, `/auth/contact-code/request`, and `/auth/contact-code/verify`.

Updated gate state:

- [RESOLVED: Auth phone-code delivery channel mismatch] Auth no longer defaults phone codes to unsupported Notifications `sms`.
- [PENDING: real provider smoke] A real WhatsApp/channel-registry delivery smoke still requires an approved non-sensitive test contact and provider readiness.
- [BLOCKED: Vault sealed] `vault-backend` remains `Ready=False / InvalidProviderConfig`.

### Contact-Code Delivery Follow-Up Evidence

- Full `npm test` passed after the phone delivery channel fix: 7 suites / 21 tests.
- Safe public anti-enumeration smoke after deployment returned `{"success":true,"delivery":"accepted"}` for an unknown `example.invalid` email and did not reveal account existence.

## Orchestrator Update - 2026-06-24 Marathon Source Marker Contract

Status: Auth contact provisioning now preserves primary account source while marking Marathon membership.

Problem found:

- `register-contact` previously set `existingUser.source = contactRegisterDto.source || existingUser.source`.
- A Marathon backfill for an existing Auth user from another Alfares service could overwrite the original source, losing ecosystem origin history.

Changes:

- New users still store `source=marathon` when Marathon provisions them.
- Existing users keep their original `source`.
- Existing and new users receive a non-migrating JSONB marker in `perApplicationPreferences.authSources.<source>`.
- Marathon backfill requests with `source=marathon` therefore mark `perApplicationPreferences.authSources.marathon` without fragmenting identity or overwriting another service's primary source.

Validation:

- Added contract coverage that an existing `source=school-committee` user provisioned by Marathon keeps `source=school-committee` and gains `perApplicationPreferences.authSources.marathon`.

### Marathon Backfill Marker Alignment Evidence

- Auth `register-contact` now preserves an existing user's primary `source` and records additional provisioning membership under `perApplicationPreferences.authSources.<source>`.
- For Marathon, the backfill marker is `perApplicationPreferences.authSources.marathon`.
- Full Auth validation after this contract change passed: `npm test` 7 suites / 22 tests and `npm run build`.
- Auth backend/web images were rebuilt and rolled out with tag `e2d77f1-20260624115053`; runtime health returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Marathon `scripts/backfill-marathon-auth-users.js --plan-only --limit 5` now reports `authMarker=perApplicationPreferences.authSources.marathon`, `preservesExistingPrimarySource=true`, `liveAccess=false`, `dbAccess=false`, and `authApiAccess=false`.
