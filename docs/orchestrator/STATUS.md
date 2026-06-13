# Auth Orchestrator Status

## 2026-06-13 - DocsRAG JWT Token Pickup Fixed

Current focus:

- Owner request: fix DocsRAG unavailability caused by `JWT_TOKEN` not being set in the remote SSH shell, using the same operational pattern as RunLayer and AI microservice.
- Runtime code changes: none.
- Deployment manifest changes: none; `k8s/external-secret.yaml` already maps `JWT_TOKEN` from `secret/prod/auth-microservice`.

Implementation evidence:

- Verified live `ExternalSecret` `auth-microservice-secret` maps `JWT_TOKEN` from `secret/prod/auth-microservice` property `JWT_TOKEN`.
- Verified live Kubernetes Secret `auth-microservice-secret` contains a `JWT_TOKEN` key without printing or decoding its value.
- Restarted `deployment/auth-microservice` so the running pod picked up the synced secret.
- Updated `AGENTS.md` to document that remote SSH shells are not expected to export `JWT_TOKEN`; future DocsRAG queries should run from `deployment/auth-microservice` using the pod environment and must not print token values.

Validation evidence:

- `kubectl -n statex-apps rollout status deployment/auth-microservice --timeout=180s` passed.
- `kubectl -n statex-apps exec deployment/auth-microservice -- sh -c "printenv JWT_TOKEN >/dev/null && echo JWT_TOKEN_ENV_PRESENT || echo JWT_TOKEN_ENV_MISSING"` returned `JWT_TOKEN_ENV_PRESENT`.
- DocsRAG retrieval from inside `deployment/auth-microservice` returned `HTTP 200` using the pod `JWT_TOKEN` without printing the token.
- `https://auth.alfares.cz/health` returned status `ok`.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, production user data, database changes, or runtime code changes.

Next action:

- Continue with the next owner-selected Auth remediation chunk when requested.

## 2026-06-13 - RBAC-REM-03 Catalog Frontend Role-Aware Admin Guard Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-03 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Catalog branch: `feature/catalog-goal-04-channel-readiness-model`.
- Catalog commit: `5f0e087 Make catalog admin guard role aware`.
- Auth runtime code changes: none.
- Catalog backend authorization changes: none.
- Deployment: not run.

Implementation evidence:

- Removed stale Catalog frontend AdminGuard text that said Auth does not support roles/admin flags.
- AdminGuard now requires one of: `global:superadmin`, `app:catalog-microservice:admin`, `internal:catalog-microservice:admin`, or `catalog:write` before rendering admin children.
- Authenticated users without those roles see an access-required state rather than admin content.
- Catalog continuation docs were updated with validation evidence.

Validation evidence:

- `services/frontend npm run build` passed.
- `git diff --check -- services/frontend/components/AdminGuard.tsx` passed.
- Catalog pre-commit checks passed.
- Auth documentation `git diff --check` and secret scans are required before final Auth commit.
- DocsRAG was unavailable because `JWT_TOKEN` is absent in the remote shell; source evidence came from Auth contract docs and Catalog source.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, production user data, deployment, or database changes.

Next action:

- Recommended next remediation chunk: RBAC-REM-04 SpeakASAP scoped-role normalization review.

## 2026-06-12 - RBAC-REM-02 Consumer JWT Validation Standardization Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-02 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Runtime Auth code changes: none.
- Consumer runtime code changes: none.
- Deployment: not run.

Decision evidence:

- Default consumer pattern is `POST /auth/validate` for admin panels, browser-facing backends, lower-throughput APIs, and consumers that do not need JWT verification secret material.
- High-throughput backend exception is an approved shared local verifier pattern, constrained to Auth-sourced verification material, expiry/signature validation, unsafe-algorithm rejection, full Auth role-string preservation, safe logging, and consumer-owned endpoint authorization.
- Static service tokens and API keys remain separate from Auth user identity and are deferred to RBAC-REM-06.

Implementation evidence:

- Added `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`.
- Updated `docs/UNIFIED_AUTH_CONTRACT.md` with the consumer token validation standard.
- Updated `docs/RBAC_CONSUMING_SERVICES_AUDIT.md` with RBAC-REM-02 completion, consumer classification, and follow-up chunks.
- Updated continuation and execution-plan state for RBAC-REM-02 completion.

Validation evidence:

- DocsRAG remained unavailable because `JWT_TOKEN` is absent in the remote shell; gate remains pass-with-exception with source-code and Auth contract evidence.
- Missing-marker scan returned no matches for gate-critical docs.
- Documentation secret-pattern scan returned no matches.
- `git diff --check` passed for changed docs/state files.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed, decoded, or persisted.

Next action:

- Recommended next remediation chunk: RBAC-REM-03 Catalog frontend role-aware admin guard and stale comment cleanup.

## 2026-06-12 - RBAC-REM-02 Selected: Consumer JWT Validation Standardization

Current focus:

- Owner-selected remediation chunk: RBAC-REM-02 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Objective: standardize when consumers use POST /auth/validate versus an approved shared local verifier for Auth-issued JWTs.
- Runtime Auth code changes: none in this selection/planning update.
- Consumer runtime code changes: none in this selection/planning update.
- Deployment: not run.

Gate evidence:

- Required Auth orchestrator, contract, environment, verification, IPS, goal, and audit docs were read from the remote Auth source of truth.
- JWT_TOKEN is absent in the remote shell, so DocsRAG retrieval cannot be authenticated. Gate decision for this planning update: pass-with-exception for AUTH-INV-007, with compensating evidence from existing Auth contract docs and the completed RBAC consuming-services audit.
- Sensitive-data classification: masked. No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed, decoded, or persisted.

Planning evidence:

- Updated docs/orchestrator/EXECUTION_PLAN.md for RBAC-REM-02.
- Updated docs/orchestrator/CONTEXT_PACKAGE.md target task to the owner-selected chunk.
- Updated continuation state so the next Auth orchestrator session resumes at RBAC-REM-02.

Validation evidence:

- Missing-marker scan returned no matches for gate-critical docs.
- Documentation secret-pattern scan returned no matches.
- git diff --check passed for STATE.json, TASKS.md, docs/IMPLEMENTATION_STATE.md, and the changed orchestrator docs.
- Unrelated pre-existing dirty files remain untouched: .env.example and k8s/external-secret.yaml.

Next action:

- Implement RBAC-REM-02 decision documentation: choose the default consumer JWT validation standard and split any consumer code changes into separately approved implementation chunks.

## 2026-06-12 - RBAC-REM-01 Secret-Source Alignment Review

Current focus:

- Owner-selected remediation chunk: `RBAC-REM-01` from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Runtime Auth code changes: none.
- Consumer runtime code changes: none.
- Consumer manifest changes: `k8s/external-secret.yaml` only in catalog, warehouse, suppliers, orders, and payments.
- Deployment: not run.

Gate evidence:

- Required Auth orchestrator, contract, environment, verification, README, BUSINESS, SYSTEM, state, and audit docs were read from the remote Auth source of truth.
- DocsRAG was unavailable because `JWT_TOKEN` was absent in the remote shell. Gate decision: pass-with-exception for `AUTH-INV-007` with compensating remote source and Kubernetes metadata evidence.
- Sensitive-data classification: masked. Only secret key names, Vault path names, source file paths, and commit IDs were recorded. No secret values, JWTs, tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed, decoded, or persisted.

Review evidence:

- Live ExternalSecret metadata before remediation mapped `JWT_SECRET` to service-specific Vault paths for catalog, warehouse, suppliers, orders, and payments.
- `notifications-microservice` remained the positive aligned pattern with `JWT_SECRET` sourced from `secret/prod/auth-microservice`.
- Live Kubernetes Secret key-name checks confirmed the relevant secrets expose a `JWT_SECRET` key, without decoding or printing values.

Implementation evidence:

- `catalog-microservice`: committed `fcb1919 Align JWT secret source with auth`.
- `warehouse-microservice`: committed `015cf4f Align JWT secret source with auth`.
- `suppliers-microservice`: committed `c1e92d2 Align JWT secret source with auth`.
- `orders-microservice`: committed `e05c2c3 Align JWT secret source with auth`.
- `payments-microservice`: committed `66bf990 Align JWT secret source with auth`.
- Each commit changes only the `JWT_SECRET` ExternalSecret `remoteRef.key` to `secret/prod/auth-microservice` and leaves other service-owned secret keys unchanged.
- `orders-microservice` had pre-existing adjacent `JWT_TOKEN` changes in `k8s/external-secret.yaml`; only the `JWT_SECRET` source-path hunk was staged and committed.

Validation evidence:

- `kubectl apply --dry-run=server -f k8s/external-secret.yaml` passed for all five target consumer manifests.
- `git diff --check -- k8s/external-secret.yaml` passed for all five target consumer manifests.
- Staged diff review confirmed only the intended `JWT_SECRET` source-path hunk was committed in each consumer repo.
- Consumer repository pre-commit hooks passed for all five commits.
- Auth documentation missing-marker, secret-pattern, and `git diff --check` checks were run after documentation updates.

Residual risks and follow-ups:

- Source manifests are committed but not deployed by this session. Final live metadata showed catalog already aligned, while warehouse, suppliers, orders, and payments still used their previous source paths; those remaining live changes require consumer deployment or GitOps sync.
- `suppliers-microservice`, `orders-microservice`, and `payments-microservice` retain unrelated dirty worktree files from other sessions. Those were not staged or committed here.
- Next remediation chunk: `RBAC-REM-02` standardize consumer JWT validation pattern (`/auth/validate` versus shared local verifier).

## 2026-06-12 - Goal 06 RBAC Consuming Services Audit

Current focus:

- Owner-selected next task: Goal 06, RBAC audit across consuming services.
- Runtime code changes: none.
- Consumer service changes: none.

Gate evidence:

- Required Auth orchestrator, contract, environment, verification, README, BUSINESS, SYSTEM, and goal docs were read from the remote Auth source of truth.
- DocsRAG query was attempted against `docs-rag-microservice.statex-apps.svc.cluster.local:3397`, but the remote shell did not have `JWT_TOKEN` set. Gate decision: pass-with-exception for `AUTH-INV-007`; compensating evidence came from remote source scans only.
- Sensitive-data classification: masked. No decoded secrets, JWTs, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or raw production user records were printed or recorded.

Implementation evidence:

- Added `docs/RBAC_CONSUMING_SERVICES_AUDIT.md` with inspected consumer list, Auth contract baseline, compatibility findings, and owner-approvable remediation backlog.
- Updated Goal 06 status in `docs/orchestrator/GOALS.md`, `implementation-goals/GOAL-06-rbac-consuming-services-audit.md`, `implementation-goals/README.md`, `TASKS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/EXECUTION_PLAN.md`, and `docs/IMPLEMENTATION_STATE.md`.
- Updated `STATE.json` milestone and next focus.

Source evidence summary:

- Direct JWT role guards inspected in catalog, warehouse, suppliers, orders, payments, and notifications.
- `/auth/validate` consumers inspected in shop-assistant, runlayer, speakasap, school-committee, and logging web admin.
- K8s ExternalSecret/ConfigMap references inspected for catalog, warehouse, suppliers, orders, payments, and notifications.
- App-local role systems identified in school-committee and SpeakASAP.

Findings summary:

- Direct JWT consumers generally match Auth role-string shape, but catalog, warehouse, suppliers, orders, and payments source `JWT_SECRET` from service-specific Vault paths instead of the Auth Vault path in their K8s ExternalSecret files; notifications shows the aligned pattern.
- Catalog frontend AdminGuard contains stale text saying Auth does not support roles and only gates by authentication client-side.
- SpeakASAP scope-stripping role normalization can collapse Auth role scopes into unscoped names.
- School Committee uses Auth for identity validation and local DB roles for school authorization; this should remain documented as app-local authorization.
- Runlayer, notifications, payments, and catalog have machine-auth bypass paths that need separate service-auth review.
- Logging web admin Auth validation was found, but role enforcement was not proven in inspected web files.

Validation evidence:

- Documentation report created without runtime deployment.
- Final documentation presence, missing-marker scan, secret-pattern scan, and `git diff --check` were run after edits; see latest session command output.

Next action:

- Owner should select one remediation chunk from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`, starting with `RBAC-REM-01` secret-source alignment review for direct JWT consumers.


## 2026-06-12 - IPS Documentation Compliance Update

Current focus:

- Owner-selected documentation update: implement the company intent-preservation-system approach in this Auth project.
- Runtime code changes: none.

Source context:

- Reviewed Auth orchestrator pack, implementation state docs, unified Auth contract docs, goal templates, and Goal 06 RBAC audit instructions.
- Reviewed company IPS source at `/Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system`, including documentation completeness, operational gate, project invariants, execution-plan, context-package, task, and readiness-gate templates.
- DocsRAG was not queried for this documentation-only local workflow update because no service JWT was available in the session and the task did not require new ecosystem architecture facts beyond existing local source-of-truth docs.

Implementation evidence:

- Added remote source-of-truth memory: all future Auth changes must be made and committed on `alfares` in `/home/ssf/Documents/Github/auth-microservice`.
- Added `docs/orchestrator/PROJECT_INVARIANTS.md` with Auth-specific invariant IDs for ownership, non-ownership boundaries, contract compatibility, sensitive-data handling, hosted Auth, evidence, and DocsRAG usage.
- Added `docs/orchestrator/PRE_CODING_GATE.md` defining required inputs, gate checklist, documentation scans, runtime checks, DocsRAG rule, and pass/fail policy.
- Added `docs/orchestrator/CONTEXT_PACKAGE.md` defining target-task selection, included/excluded documents, Auth constraints, allowed/forbidden changes, prompt source, and validation instructions.
- Added `docs/orchestrator/EXECUTION_PLAN.md` defining the reusable Auth execution-plan frame with traceability, invariant, sensitive-data, contract, replay/idempotency, scope, test, validation, rollback, and completion sections.
- Added `docs/orchestrator/READINESS_GATES.md` defining integration, deployment, and documentation-only readiness evidence.
- Updated `AGENTS.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/PLAN.md`, and `docs/orchestrator/PROMPTS.md` so future coding must pass context, invariant, sensitive-data, contract, validation, pre-coding, and readiness checks.

Verification evidence:

- Documentation file presence check passed on `alfares`: `find docs/orchestrator -maxdepth 1 -type f -name '*.md' -print` lists `PROJECT_INVARIANTS.md`, `PRE_CODING_GATE.md`, `CONTEXT_PACKAGE.md`, `EXECUTION_PLAN.md`, `READINESS_GATES.md`, and the existing orchestrator files.
- Missing-marker scan passed on `alfares` for active docs with no matches. Reusable templates under `implementation-goals/templates/` intentionally retain placeholder markers for future agents to fill.
- Secret-pattern scan passed on `alfares` with no matches: `rg -n "Authorization: Bearer ...|(access_token|client_secret|password|private_key) assignment pattern" docs AGENTS.md TASKS.md`.
- Remote commit created for orchestration documentation; unrelated pre-existing remote change `scripts/bootstrap-speakasap-legacy-users.ts` was not included.

Next unfinished chunks:

- No runtime implementation chunk selected. Next owner-selected item remains Goal 06 - RBAC Consuming Services Audit.

## 2026-06-12 - Goal 5 Goalkeeper-Style Orchestrator Workflow

Current focus:

- Goal 5 - Goalkeeper-Style Orchestrator Workflow: done.
- Next focus: owner selection. Suggested next goal: Goal 6 - RBAC Consuming Services Audit.

Goalkeeper reference evidence:

- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/AGENTS.md`.
- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/docs/IMPLEMENTATION_STATE.md`.
- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/docs/IMPLEMENTATION_ORCHESTRATOR.md`.
- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/implementation-goals/README.md`.
- Reviewed Goalkeeper execution, context package, coding prompt, and validation report templates.

Implementation evidence:

- Added `docs/IMPLEMENTATION_ORCHESTRATOR.md` as the Auth master-agent prompt.
- Added `docs/IMPLEMENTATION_STATE.md` as the state-driven continuation checkpoint.
- Added `implementation-goals/README.md`.
- Added completed goal files for Goals 1-5 and ready backlog goal file for Goal 6.
- Added `implementation-goals/templates/EXECUTION_PLAN.md`, `CONTEXT_PACKAGE.md`, `CODING_PROMPT.md`, and `VALIDATION_REPORT.md`.
- Updated `AGENTS.md` with the `AUTH ORCHESTRATOR: continue implementation` command, required reading, core intent, and orchestrator duties.
- Updated `MASTER_PROMPT.md`, `GOALS.md`, `PLAN.md`, and `PROMPTS.md` to route future work through `docs/IMPLEMENTATION_STATE.md`.

Verification evidence:

- Documentation file presence and cross-reference scan passed on `alfares`.
- No runtime Auth source files, frontend files, deployment scripts, or production configuration were changed.
- `README.md`, `BUSINESS.md`, and `SYSTEM.md` are not present in this local snapshot; the new docs instruct future sessions to read them if restored.

Next unfinished chunks:

- Goal 6: RBAC Consuming Services Audit, pending owner selection.

## 2026-06-12

Current focus:

- Goal 1 - Admin Token Copy UX And Safety: done.
- Goal 2 - Auth Intent Preservation Pack: done.
- Next focus: Goal 3 - Unified Auth Contract Recovery.

Evidence gathered:

- Local working directory was empty; live source is on `alfares` at `/home/ssf/Documents/Github/auth-microservice`.
- Auth production frontend is `https://auth.alfares.cz/admin`.
- Auth live repo has static admin frontend files under `web/public/admin.html` and `web/public/js/admin.js`.
- Admin JS already strips URL parameters named `email`, `password`, `token`, `accessToken`, and `refreshToken`.
- Existing Copy Token button was hidden until Show Token was clicked.
- DocsRAG was queried from the `docs-rag-microservice` pod because the Auth image lacks `curl`.
- DocsRAG confirmed Auth source-of-truth themes: centralized login/registration, cross-domain token handoff, JWT/RBAC compatibility, no secrets in docs, structured logging, and the shared ecosystem single-source-of-truth boundaries.
- DocsRAG confirmed Goalkeeper/Project OS themes: human sets goals, coordinator plans/decomposes, workers execute atomic tasks, validators verify, and goal lifecycle includes planning/approval/active execution.

Implementation evidence:

- Updated admin token UI so Copy Token is visible after login.
- Copy Token now reads the current access token from session storage and does not require revealing the masked input.
- Added secure clipboard API path plus hidden-textarea fallback.
- Added `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `PROMPTS.md`, and `STATUS.md`.
- Updated `AGENTS.md` to require future agents to follow the Auth orchestrator pack.
- `node --check web/public/js/admin.js` passed locally and on the remote repo.
- Remote `npm run build` passed.
- Ran `./scripts/deploy.sh`; deployment completed successfully in 355.39s.
- Deployment image tag: `localhost:5000/auth-microservice:79ebc08-20260612091531`.
- Deploy health check returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Remote public verification found `Copy Token` in `https://auth.alfares.cz/admin`.
- Remote public verification found deployed `admin.js` includes `copyTokenToClipboard`, `const token = getAccessToken()`, `copyTokenBtn.disabled`, and `fallbackCopyText`.
- Triggered docs-rag-microservice ingestion for `auth-microservice`; job `a236f5f7-8b0f-44ea-9bb7-9ab67c264e2f` returned HTTP 202.
- DocsRAG retrieval for `Auth Orchestrator Master Prompt intent preservation workflow` returned the new `auth-microservice/docs/orchestrator/*` files.

Next unfinished chunks:

- Goal 3: locate or reconcile historical unified Auth contract docs currently referenced by DocsRAG.

## 2026-06-12 - Goal 3 Contract Recovery

Current focus:

- Goal 3 - Unified Auth Contract Recovery: done.
- Next focus: Goal 4 - Auth Observability And Safety Checks.

DocsRAG evidence:

- Queried DocsRAG from the `docs-rag-microservice` pod using an in-memory service JWT with issuer `docs-rag-microservice`; no token or secret value was printed or persisted.
- DocsRAG returned historical references to `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, `docs/UNIFIED_AUTH_VERIFICATION.md`, and `docs/agents/*`.
- Retrieved source headings included: `Deliverables (All Required, No "Optional Later" Bucket)`, `Inputs (read first)`, `Success Criteria`, `Related Documentation`, `Core Design Principles`, `Input Artifacts (Source of Truth)`, `1. Centralized Login/Registration Form (Hosted Only in Auth-Microservice)`, and `Task Group A0.1 - Unified Auth Contract (Auth Unified Contract Validator)`.

Git history evidence:

- `git log --all --name-only` confirmed historical files: `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, `docs/UNIFIED_AUTH_VERIFICATION.md`, and `docs/agents/{master-prompt.md,AUTH_PHASE1_IMPLEMENTATION_AND_VALIDATION.md,AUTH_REFACTOR_TASKS_INDEX.md,AUTH_REFACTOR_VALIDATION_REPORT.md}`.
- Commit `3338638 chore: remove obsolete documentation and command files` removed the historical docs.
- The current `README.md` still linked to `docs/UNIFIED_AUTH_CONTRACT.md`, making the missing contract path an active stale reference.

Implementation evidence:

- Restored `docs/UNIFIED_AUTH_CONTRACT.md` as the current authoritative contract for hosted entry points, core API endpoints, JWT shape, OAuth, magic links, redirect allowlist, CORS, internal service auth, registered-user preferences, and client responsibilities.
- Restored `docs/ENV_CORS_AND_AUTH_CHECK.md` with current K8s/Vault-managed CORS and Auth URL behavior.
- Restored `docs/UNIFIED_AUTH_VERIFICATION.md` with static, reachability, contract, redirect-safety, and secret-safety checks.
- Added supersession stubs under `docs/agents/` so historical DocsRAG references resolve but point future agents to `docs/orchestrator/*` and the restored contract docs.

Verification evidence:

- Remote `test -f` check passed for restored contract, CORS, verification, and historical agent paths.
- Remote route inspection found current Auth controller endpoints for login, register, validate, refresh, OAuth, magic-link, redirect validation, internal preferences, and internal magic-link/check-email.
- Secret-pattern scan across restored docs returned no matches for inline JWTs, secret assignments, internal-service tokens, notification tokens, or password-value patterns.
- Local trailing-whitespace scan across restored docs returned no matches.
- Triggered DocsRAG ingestion for `auth-microservice`; job `cee8c6d9-1db8-43e9-a3af-cc9d0746df04` completed successfully with `20/20` chunks processed.
- Post-ingestion DocsRAG retrieval for the current unified Auth contract returned `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md` and `auth-microservice/docs/ENV_CORS_AND_AUTH_CHECK.md` from the current repo.
- Remote `git status --short` showed unrelated pre-existing modified files `src/auth/admin-users.controller.ts` and `src/users/users.service.ts`; this chunk did not edit them.

Next unfinished chunks:

- Goal 4: review Auth-sensitive logs for login, refresh, password reset, magic link, OAuth, admin user management, and role changes.

## 2026-06-12 - Goal 4 Auth Observability And Safety Checks

Current focus:

- Goal 4 - Auth Observability And Safety Checks: done.
- Next focus: owner selection. Remaining broad backlog item: RBAC roles audit across consuming services.

DocsRAG evidence:

- Queried DocsRAG for `auth-microservice observability logging redaction login refresh password reset magic link OAuth admin users role changes sensitive tokens`.
- Retrieved source headings included: `Features`, `Business: auth-microservice`, `Active Work`, `Preserved Intent`, `Goal 4 - Auth Observability And Safety Checks`, `Non-Negotiable Boundaries`, and `Client Responsibilities`.
- DocsRAG confirmed the contract rule that applications and Auth must not log tokens, password reset tokens, magic-link tokens, OAuth tokens, client secrets, or JWT secrets.

Review evidence:

- Reviewed current log statements in `src/auth/auth.service.ts`, `src/auth/admin-users.controller.ts`, `src/admin/admin-roles.controller.ts`, `src/roles/roles.service.ts`, and `shared/logger/logger.service.ts`.
- Found that production logging had no centralized redaction layer before this change.
- Found and removed a risky OAuth error log that serialized provider token response bodies.

Implementation evidence:

- Added `LoggerService.redactSensitive()` and applied it to central logging payloads, local log files, and development console output.
- Redaction covers JWTs, bearer headers, token/password/client-secret query parameters, and JSON-like sensitive fields.
- Added structured audit fields for login, registration, token validation, refresh, password reset, password change/set, magic-link request/verify, OAuth init/callback, admin user management, and RBAC role assignment/removal.
- Added `shared/logger/logger.service.spec.ts` regression coverage for JWT, bearer, token URL, password, OAuth token, and client-secret redaction.

Verification evidence:

- Remote focused test passed: `npm test -- --runTestsByPath shared/logger/logger.service.spec.ts`.
- Remote full test suite passed: `3` suites, `6` tests.
- Remote `npm run build` passed.
- Static scan returned no direct logger references to provider token response bodies, reset URLs, verify URLs, token DTOs, refresh/access token variables, or `JSON.stringify(tokenResponse.data)`.
- Ran `./scripts/deploy.sh`; deployment completed successfully in `194.14s`.
- Deployment image tag: `localhost:5000/auth-microservice:af00816-20260612095714`.
- Deploy health check returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- `curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin` returned HTTP `200`.
- Production failed-login probe returned HTTP `401` in `0.349419s`.
- Production pod check showed two backend pods running image `localhost:5000/auth-microservice:af00816-20260612095714`, both ready with restart count `0`.
- Pod log file contained `[AuthAudit] service=auth-microservice operation=login outcome=failure identifier=codex-observability-check@example.invalid reason=invalid_credentials duration_ms=78`.
- The probe password `not-a-real-password` did not appear in the matched production audit log output.
- Triggered DocsRAG ingestion for `auth-microservice`; job `7cd50a90-3493-44b5-81d2-69cb00c2694b` completed successfully with `20/20` chunks processed.

Next unfinished chunks:

- No active orchestrator goal remains. Suggested next owner-selected item: audit RBAC roles across consuming services.

## 2026-06-12 - Admin Users List Production Fix

Current focus:

- Owner-selected production fix for `/admin` registered-user management section.
- Preserved Auth ownership: the change stays inside registered Auth user management and does not move catalog, orders, marketing sending, notification, logging, gateway, or database ownership into Auth.

Diagnosis evidence:

- Production `/admin` users section showed `Error loading users: Unknown error`.
- Unauthenticated `GET https://auth.alfares.cz/auth/admin/users` returned expected JSON `401 Unauthorized`, so routing existed.
- Authenticated login with stored remote test credentials returned HTTP `201`; the old users-list request then returned Cloudflare `502`.
- Kubernetes described the Auth container as `OOMKilled` with exit code `137` at the `512Mi` memory limit.
- The old endpoint attempted to load all registered users with full `User` entities.

Implementation evidence:

- Added `UsersService.findAdminListPage(limit, offset)` with a narrow selected column set for the admin table.
- Updated `AdminUsersController.getAllUsers` to accept bounded `limit` and `offset`, clamp `limit` to `100`, and return `count`, `limit`, and `offset`.
- Updated `web/public/js/admin.js` to request `/auth/admin/users?limit=100&offset=0`, track pagination state, and render Previous/Next controls.

Verification evidence:

- Remote `node --check web/public/js/admin.js` passed.
- Remote `npm run build` passed.
- Ran `./scripts/deploy.sh` for the API/UI pagination change; deployment completed successfully in `199.22s`.
- Ran `./scripts/deploy.sh` again after adding the admin JS cache-busting query; deployment completed successfully in `198.71s`.
- Final deployment image tag: `localhost:5000/auth-microservice:af00816-20260612094806`.
- Deploy health check returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Authenticated production check for `GET /auth/admin/users?limit=100&offset=0` returned HTTP `200` in `213ms` after the pagination deploy and `269ms` after the final cache-bust deploy.
- Production users response returned `success=true`, `count=214246`, `users.length=100`, `limit=100`, and `offset=0`.
- Returned user-list keys were limited to `createdAt,email,firstName,id,isActive,isVerified,lastName,phone,updatedAt,userType`; no password field was returned.
- `curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin` returned HTTP `200`.
- Web pod verification showed `/app/public/admin.html` references `/js/admin.js?v=20260612094229`.
- Web pod verification showed `/app/public/js/admin.js` fetches `/auth/admin/users` with `limit: String(usersLimit)` and `offset: String(usersOffset)`.
- Kubernetes pod check showed image `localhost:5000/auth-microservice:af00816-20260612094806`, state `Running`, ready `True`, and restart count `0`.

Next unfinished chunks:

- Goal 4: review Auth-sensitive logs for login, refresh, password reset, magic link, OAuth, admin user management, and role changes.
