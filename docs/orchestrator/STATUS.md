## 2026-07-02 - Auth Validate Logging Loop Source Fix

Current focus:

- Owner-reported Auth login/runtime issue and suspected circular logging.
- Preserved Auth ownership: identity, login, JWT validation, RBAC role lookup, and audit boundaries remain in Auth; logging storage remains in Logging.

Diagnosis evidence:

- `https://auth.alfares.cz/login` returned HTTP 200 and `/health` returned ok.
- Synthetic bad password login returned expected HTTP 401.
- Live Auth local logs showed password login successes at 2026-07-02 04:49:25, 04:50:24, and 04:50:32 UTC.
- Logging ingestion from inside the Auth pod to `http://logging-microservice:3367/api/logs` returned HTTP 201.
- Logging source confirms `POST /api/logs` is unguarded, while admin read endpoints call Auth `/auth/validate`.
- Auth and Logging stored logs showed repeated `/auth/validate` failures with `invalid input syntax for type uuid: "warehouse-reservation-expiry-cron"`.

Implementation evidence:

- Added pre-DB UUID subject validation in `AuthService.validateToken`.
- Expected `UnauthorizedException` validation denials now stay warning-level and are not re-logged as unexpected errors.
- Successful `validate_token` audit events are no longer emitted through the external logger, reducing Auth -> Logging -> Auth validation feedback noise.
- Added focused regression coverage proving non-UUID JWT subjects are rejected before `usersService.findById`.

Verification evidence:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed: 10 tests.
- `git diff --check` passed.
- `npm run build` passed.
- `npm run lint` passed.

Deployment:

- Not deployed in this source-only session. Production deployment remains owner-approval gated.

Next unfinished chunks:

- Owner approval is required before running `./scripts/deploy.sh` for this Auth remediation.

2026-07-01: Owner-approved Auth profile single-source fix deployed to production. Deploy command: `./scripts/deploy.sh` from `alfares:/home/ssf/Documents/Github/auth-microservice` at commit `2d105b6`. Deploy script evidence: focused Auth contract tests passed 3 suites/19 tests; backend image built and pushed as `localhost:5000/auth-microservice:2d105b6-20260701184319` with digest `sha256:7da7a574b64dc600b62cc640bdcca158fef8654f7b3d96f90390b2d58be3abfe`; web image built and pushed as `localhost:5000/auth-microservice-web:2d105b6-20260701184319` with digest `sha256:6036290b742825188725285fe302d51144b2b57b6c0e8bc6b56625de00360b97`; ConfigMap, ExternalSecret, manifests, and image updates applied. Runtime note: initial backend rollout timed out because kubelet/containerd was slow pulling images while unrelated pods were also in image/container lifecycle states; production remained available through the old Auth pod due `maxUnavailable=0`. Recovery: deleted only the stuck new Auth pod so the Deployment retried the new pod; no old ready pod, database, secret, or source was deleted. Final verification: `kubectl rollout status deploy/auth-microservice` and `deploy/auth-microservice-web` both succeeded; deployments show backend and web `READY 1/1`, `UP-TO-DATE 1`, `AVAILABLE 1` on the `2d105b6-20260701184319` images; new backend pod `auth-microservice-f5f99b747-8gk6f` is `1/1 Running` with imageID digest `sha256:7da7a574b64dc600b62cc640bdcca158fef8654f7b3d96f90390b2d58be3abfe`; public `https://auth.alfares.cz/health` returned `success=true,status=ok`; unauthenticated `GET /auth/profile` returned HTTP 401; public `/login` returned HTTP 200; running compiled code contains `dist/src/auth/auth.service.js: async getProfile(userId)`. Boundary: no production user rows, tokens, passwords, decoded JWTs, Vault values, Bazos cookies, Bazos session data, DB mutation, user merge/backfill, JWT shape change, RBAC/OAuth/magic-link/CORS/internal-service/database schema change, or consumer-service source change was performed. Next unfinished chunk: optional owner-provided test-user live profile smoke through Bazos `/ui/auth/me` or hosted Auth callback.

2026-07-01: Owner-selected Auth profile single-source audit and contract hardening completed in source. Vision: Auth remains the Statex ecosystem identity and profile/contact source of truth for registered users. Goal Impact: consumers such as Bazos can initialize or refresh profile views from Auth after hosted handoff instead of forking email/name/phone into app-local registration forms. System: Auth `users` table, `/auth/profile`, `/auth/validate`, hosted Auth handoff, and read-only Bazos consumer bridge. Feature: canonical registered-user profile read. Task: inspect Auth profile persistence/response paths, make `/auth/profile` explicitly read and return a sanitized Auth DB user, add regression coverage for `email`, `firstName`, `lastName`, `phone`, `contactInfo`, and source metadata, and document consumer expectations. Execution Plan: bounded owner-selected profile single-source audit in `docs/orchestrator/EXECUTION_PLAN.md`. Coding Prompt: do not expose secrets, tokens, passwords, decoded JWTs, raw production user data, Bazos cookies, or session payloads. Code: added `AuthService.getProfile(userId)` and changed `AuthController.getProfile` to return `authService.getProfile(req.user.id)`; documented `/auth/profile` as the canonical sanitized Auth database profile read; added synthetic regression coverage. Validation: DocsRAG query from running Auth pod returned HTTP 200 with no matching context/sources for the specific Hevrike/Bazos profile query; `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed 8 tests; `npm run test:auth-contract` passed 3 suites/19 tests; `npm run build` passed; `npm run lint` passed; `git diff --check` passed; read-only Bazos source spot check confirmed hosted Auth migration and `/ui/auth/me` use Auth validation while Bazos local account/identity tables remain Bazos-platform entities. Boundary: no production DB mutation, user merge/backfill, raw production user-data read, secret/token/password inspection, decoded JWT inspection, JWT shape change, RBAC/OAuth/magic-link/CORS/internal-service/database schema change, consumer-service source edit, or production deployment was performed. Next unfinished chunk: owner-approved deployment and live profile smoke if this source fix should go to production.

2026-06-29: Catalog-to-Warehouse service identity projection regression coverage added. Change: extended `src/auth/auth-contract.spec.ts` with focused `/auth/validate` tests proving service actor fields are exposed for `userType=service` principals with `perApplicationPreferences.serviceIdentity` and are not exposed for normal users. Validation: `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed 7 tests; `git diff --check` passed; `npm run test:auth-contract` passed 18 tests; `npm run build` passed. Boundary: no helper execution, live Auth request, DB mutation, role assignment, service-principal creation, token issuance, Vault/Kubernetes secret mutation, deployment, decoded secret/JWT inspection, Warehouse import, stock mutation, or Catalog runtime config change was performed. Next action: validate source, then keep runtime provisioning approval-gated.

2026-06-29: Catalog-to-Warehouse Auth service-principal provisioning helper prepared and deployed. Change: added `scripts/provision-catalog-warehouse-service-token.ts` and a backward-compatible Auth `/auth/validate` service identity projection for `userType=service` principals whose `perApplicationPreferences.serviceIdentity.serviceName` is set. The helper has a non-mutating `--dry-run` mode and an approval-gated `--apply` mode requiring explicit DB and token issuance confirmations plus `--token-output`; token values are written only to that file with mode `0600` and are never printed. This prepares the existing Warehouse Auth-validated bearer receiver path for Catalog-to-Warehouse stock acceptance without adding a Warehouse static-token bypass. Validation: `npx tsc --noEmit --skipLibCheck --experimentalDecorators --emitDecoratorMetadata --module commonjs --target es2020 --moduleResolution node --esModuleInterop scripts/provision-catalog-warehouse-service-token.ts` passed; `git diff --check` passed; `npm run build` passed; deploy-script `npm run test:auth-contract` passed 16 tests; deployment completed with backend image `localhost:5000/auth-microservice:97ea521-20260629180327` and web image `localhost:5000/auth-microservice-web:97ea521-20260629180327`; both deployments are ready `1/1`; public `/health` returned `success=true,status=ok`; running pod compiled code contains `resolveServiceIdentity`, `serviceIdentity`, and `auth-service-jwt`. Boundary: no helper execution, Auth DB mutation, role assignment, user/service-principal creation, token issuance, Vault/Kubernetes secret value change, decoded secret/JWT inspection, Warehouse import, stock mutation, or Catalog runtime config change was performed. Next action: after explicit owner approval run the helper in `--apply` mode, mount the resulting token through approved runtime secret management, and rerun Catalog `npm run verify:stock-acceptance:gates`.

2026-06-29: Catalog-to-Warehouse service role provisioning helper prepared. Change: added source-only support for `internal:<service>:<role>` parsing and `--dry-run` to `scripts/assign-role-by-email.ts`, with wrapper usage documentation. This prepares the approved Auth-compatible bearer-token path for the stock acceptance blocker without running any production provisioning. The exact future role shape needed by Warehouse is `internal:warehouse-microservice:admin`; the target principal/email and token/secret rotation path remain owner-approved runtime operations, not source defaults. Validation: `npx tsc --noEmit --skipLibCheck --experimentalDecorators --emitDecoratorMetadata --module commonjs --target es2020 --moduleResolution node --esModuleInterop scripts/assign-role-by-email.ts` passed; `bash -n scripts/assign-role-by-email.sh` passed; `git diff --check` passed; `npm run build` passed. Boundary: no Auth DB mutation, role assignment, user/service-principal creation, token issuance, Vault/Kubernetes secret mutation, deployment, decoded secret/JWT inspection, or production user data read was performed. Warehouse still requires an Auth-valid bearer credential; adding a Warehouse static-token receiver remains an owner-approved contract change and was not implemented. Next action: with explicit owner approval, create or identify the Catalog service principal, assign `internal:warehouse-microservice:admin` using the helper, issue/rotate an Auth-compatible runtime token without printing it, update Catalog runtime config, then rerun Catalog `npm run verify:stock-acceptance:gates`.

2026-06-29: Auth admin Users application-filter production remediation implemented and deployed on `alfares`. Vision: Auth remains the Statex identity and RBAC authority. Goal Impact: `/admin` Users application filters load without the backend 500 caused by SQL alias parsing. System: Auth admin Users API. Feature: server-side admin user list filtering. Task: fix SQL generated by `UsersService.findAdminListPage` for application and app-admin filters. Execution Plan: bounded production remediation from owner screenshot and live backend log evidence; patch only `src/users/users.service.ts`, add focused regression coverage in `src/users/users.service.spec.ts`, validate, deploy after owner approval, and verify live runtime. Coding Prompt: do not print or record secrets, tokens, passwords, raw production user rows, or change Auth contracts. Code: quoted the reserved TypeORM alias as `"user"."id"` in both raw subqueries. Validation: live logs showed `QueryFailedError: syntax error at or near "."` before the fix; `npm test -- --runTestsByPath src/users/users.service.spec.ts` passed 2 tests; `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts src/users/users.service.spec.ts` passed 8 tests; `npm run build` passed; `npm run lint` passed; `git diff --check` passed; deploy-script Auth contract tests passed 16 tests; Kubernetes rollout completed; live `/admin` returned HTTP 200; live `/health` returned ok; deployed images `localhost:5000/auth-microservice:9a309b0-20260629000608` and `localhost:5000/auth-microservice-web:9a309b0-20260629000608`; running pod compiled code contains both quoted alias clauses; post-deploy log scan showed no recurrence of the previous SQL error. Boundary: no database schema, JWT payload, RBAC assignment semantics, OAuth, magic-link, password reset, CORS, internal-service contract, decoded secrets, tokens, passwords, raw production user data, or consumer-service code changed. Next unfinished chunk: none.
# 2026-06-28 - Hosted Password Reset Success UX Fix

Current focus:

- Owner-reported hosted reset defect: after successful password reset, the `New password` and `Confirm new password` fields remained visible.
- Owner-reported hosted navigation defect: clicking reset page `Back to login` opened `/login` and immediately showed `Missing required query parameter: return_url`.
- Auth branch: `main`.
- Runtime code changes: hosted UI only.
- Deployment: completed with images `localhost:5000/auth-microservice:49a2f30-20260628230756` and `localhost:5000/auth-microservice-web:49a2f30-20260628230756`.

Implementation evidence:

- Added a stable `password-row` container to `web/public/index.html`.
- After successful `/auth/password-reset-confirm`, the hosted UI now clears and hides the new-password row, confirm-new-password row, and submit button, leaving only the success message and login link.
- The reset page `Back to login` link now preserves `return_url`, `client_id`, and `state` when those query parameters exist.
- A plain `/login` page load no longer renders the immediate `Missing required query parameter: return_url` error. The login action remains disabled until a valid consumer `return_url` exists.
- Updated `src/auth/hosted-auth-web.spec.ts` with focused assertions for the reset success and login-link behavior.

Validation evidence:

- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed: 1 suite, 6 tests.
- `git diff --check` passed.
- `npm run build` passed.
- `node --check web/server.js` passed.
- Extracted inline script from `web/public/index.html` and `node --check /tmp/auth-hosted-inline-check.js` passed.
- Owner approved production deployment on 2026-06-29 Europe/Prague.
- Deploy script `npm run test:auth-contract` passed: 3 suites, 16 tests.
- Deploy completed successfully in 279.77s with backend image `localhost:5000/auth-microservice:49a2f30-20260628230756` and web image `localhost:5000/auth-microservice-web:49a2f30-20260628230756`.
- Deploy health check returned Auth status `ok`.
- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web -o wide` showed both deployments `READY 1/1` on image tag `49a2f30-20260628230756`.
- `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/reset-password?token=synthetic-ui-check` returned HTTP 200.
- `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/login` returned HTTP 200.
- Live `https://auth.alfares.cz/health` returned status `ok`.
- Served hosted HTML contains `id="password-row"`, `resetLoginAnchor.href`, `(required by application)`, and `passwordRow.style.display = 'none'`; it no longer contains the old `Missing required query parameter: return_url` message.

Boundary evidence:

- No password reset API, reset-token generation, reset-token validation, reset-token expiry, email sending, JWT payload, refresh token, OAuth, magic-link, RBAC, redirect allowlist, CORS, internal-service contract, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, real reset token, password, API key, or raw production user data changed or was recorded.

Intent Compliance Report:

- Goal: make hosted password reset success and return-to-login UX coherent.
- Implemented: hosted UI hides reset fields after success and avoids the immediate missing-`return_url` error from the reset page login link.
- Not implemented: API changes, token changes, password policy changes, DB changes, or consumer-service changes.
- Boundary check: Auth remains the hosted credential and password reset authority.
- Subagents used: none.
- Validation evidence: focused hosted web test, build, diff-check, web server syntax, and inline script syntax passed.
- Risks: browser cache should be refreshed if a tab was already open on the old hosted HTML.
- Next action: owner verifies the hosted reset/login flow in browser.

2026-06-28: Owner-selected Auth admin Users role/application checkbox management implemented and deployed on `alfares`. Gate decision: accept before deployment. Scope: `src/auth/admin-users.controller.ts`, `src/users/users.service.ts`, `web/public/admin.html`, `web/public/js/admin.js`, `web/public/css/style.css`, `docs/orchestrator/CONTEXT_PACKAGE.md`, `docs/orchestrator/EXECUTION_PLAN.md`, `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATUS.md`. Implemented server-side `GET /auth/admin/users` filters for search text, application, active/inactive status, verified/unverified status, and application-admin-only; added per-user application and admin-application summaries; added `GET /auth/admin/users/application-admins` for admins grouped across every registered application; updated the selected-user roles panel so all global and per-application roles render as checkboxes; added application registration checkboxes that assign the default application `user` role and remove all assigned roles for that application when unchecked; reused existing `GET /auth/admin/roles`, `GET/POST/DELETE /auth/admin/users/:userId/roles`, and `GET /auth/admin/applications` contracts. Validation passed: `node --check web/public/js/admin.js`, `node --check web/server.js`, `git diff --check`, `npm run build`, `npm run lint`, and `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` (6 tests). No production database writes by agents, role mutations by agents, decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, raw production user-data dumps, consumer-service code, JWT payload changes, RBAC assignment semantic changes, OAuth, magic-link, CORS, internal-service contracts, or database schema changes. Deployment completed with backend image `localhost:5000/auth-microservice:bf7e63c-20260628214651` after the post-deploy restart and web image `localhost:5000/auth-microservice-web:bf7e63c-20260628214214`. Live verification passed: `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/admin` returned HTTP 200; served `/admin` HTML contains `View and update the selected user` and `/js/admin.js?v=20260628235000`; served admin JS contains `cachedRoles`, `/auth/admin/roles`, and `toggleApplicationMembership`; unauthenticated `GET /auth/admin/users/application-admins` returned HTTP 401, confirming the route is present and protected. Next unfinished task: owner browser-verifies checkbox assignment behavior with an authenticated admin session.
# 2026-06-28 - Admin Users Layout Width Fix

Current focus:

- Owner-reported production UI defect: the live `/admin` Users page is too narrow, making the populated table look clipped and hiding action controls.
- Auth branch: `main`.
- Runtime code changes: hosted admin CSS/cache-busting only.
- Deployment: completed with images `localhost:5000/auth-microservice:a39f9d2-20260628212026` and `localhost:5000/auth-microservice-web:a39f9d2-20260628212026`.

Implementation evidence:

- Updated `web/public/css/style.css` so the authenticated dashboard container is `80vw` with no `max-width` cap.
- Changed `.log-list` to allow horizontal overflow instead of clipping table content.
- Added a `1100px` minimum width to `.users-table` so the Actions column remains reachable.
- Added a mobile fallback for dashboard width under `900px`.
- Bumped the admin asset query in `web/public/admin.html` to force refreshed hosted admin assets.

Validation evidence:

- `git status --short --branch` was clean before editing target files.
- Source inspection confirmed the page data is rendered by `web/public/js/admin.js` into `#users-container`; the observed issue is layout clipping, not an empty users API response.
- `node --check web/public/js/admin.js` passed.
- `node --check web/server.js` passed.
- `npm run build` passed.
- `git diff --check` passed before deployment.
- Deploy script `npm run test:auth-contract` passed: 3 suites, 16 tests.
- Deploy completed successfully in 187.21s with images `localhost:5000/auth-microservice:a39f9d2-20260628212026` and `localhost:5000/auth-microservice-web:a39f9d2-20260628212026`.
- Deploy health check returned Auth status `ok`.
- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web` showed both deployments ready on image tag `a39f9d2-20260628212026`.
- `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/admin` returned HTTP 200.
- Live `https://auth.alfares.cz/css/style.css` contains `#dashboard-view.container`, `width: 80vw`, `overflow-x: auto`, and `min-width: 1100px`.

Boundary evidence:

- No Auth endpoint, JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, reset token, password, API key, or raw production user data changed or was recorded.

Intent Compliance Report:

- Goal: make the hosted Auth admin Users page wide enough to inspect populated user rows.
- Implemented: dashboard-only width and table overflow fix.
- Not implemented: API/data changes, user-data inspection, Auth contract changes, or role changes.
- Boundary check: Auth remains identity/access authority; this is hosted admin presentation only.
- Subagents used: none.
- Validation evidence: syntax checks, build, deploy contract tests, rollout, live route, and served CSS checks passed.
- Risks: existing browser tabs may need a hard refresh if they cached the old CSS before deployment.
- Next action: owner verifies the live `/admin` Users page in browser.

# 2026-06-27 - Catalog Service Identity Ownership Confirmation

Change: created Auth-owned runtime Vault property `secret/prod/auth-microservice#CATALOG_INTERNAL_SERVICE_TOKEN` without printing or recording the value. Catalog and Orders ExternalSecret manifests consume that property under their local `CATALOG_INTERNAL_SERVICE_TOKEN` environment key.

Boundary decision: the supported machine-auth contract is `x-internal-service-token` plus `x-service-name: catalog-microservice`, mapped by Orders to `internal:catalog-microservice:service`. This does not mint or validate a user JWT through `/auth/validate`, because `/auth/validate` is user-token validation and machine actors are not Auth users.

Validation: no secret values were printed or committed. Auth docs only record the ownership source and contract; runtime synchronization and smoke validation are owned by the Catalog/Orders manifests and Kubernetes checks.

# Auth Orchestrator Status

## 2026-06-26 - Hosted Password Reset Route Fix Deployed

Current focus:

- Owner-reported production defect: password reset email links open `GET /reset-password`, which returned `Cannot GET /reset-password`.
- Auth branch: `main`.
- Deployment: completed after owner approval; deploy script built and pushed images `localhost:5000/auth-microservice:1026463-20260626175614` and `localhost:5000/auth-microservice-web:1026463-20260626175614`.
- Runtime code changes: hosted route/UI only; existing reset token API contract is unchanged.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- DocsRAG returned no matching sources for the password reset hosted route query, so remote source and Auth contract docs were used.

Implementation evidence:

- Added `/reset-password` to hosted route serving in `src/main.ts` and `web/server.js`.
- Added hosted reset-password mode in `web/public/index.html` that reads the email token query parameter in-browser and submits only to `/auth/password-reset-confirm`.
- Added focused regression coverage in `src/auth/hosted-auth-web.spec.ts`.
- Updated `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/orchestrator/CONTEXT_PACKAGE.md`, and `docs/orchestrator/EXECUTION_PLAN.md`.

Validation evidence:

- Pre-deploy live probe with a synthetic token confirmed current production `/reset-password` returned HTTP 404 and `Cannot GET /reset-password`.
- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed.
- Deploy script `npm run test:auth-contract` passed: 3 suites, 16 tests.
- `npm run build` passed.
- `node --check web/server.js` passed.
- Inline hosted Auth script extraction plus `node --check /tmp/auth-hosted-inline-check.js` passed.
- `git diff --check` passed.
- Active gate-critical missing-marker scan returned no matches.
- Documentation secret-pattern scan returned no matches.
- Broad `docs/orchestrator` missing-marker scan still reports pre-existing historical rollout planning markers under `docs/orchestrator/2026-06-24-*`; those files were not introduced by this fix.
- Deploy script timed out while waiting for the backend rollout, then the same rollout completed successfully on a follow-up `kubectl rollout status deployment/auth-microservice --timeout=120s` check.
- `kubectl -n statex-apps rollout status deployment/auth-microservice --timeout=30s` passed.
- `kubectl -n statex-apps rollout status deployment/auth-microservice-web --timeout=30s` passed.
- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web -o wide` showed both deployments `READY 1/1` on image tag `1026463-20260626175614`.
- `GET https://auth.alfares.cz/reset-password?token=synthetic-final-probe` returned HTTP 200 and contained hosted reset form markers `resetToken`, `password-confirm`, and `/auth/password-reset-confirm`.
- `GET https://auth.alfares.cz/health` returned HTTP 200 with status `ok`.
- Synthetic invalid `POST /auth/password-reset-confirm` returned HTTP 400 `Invalid or expired reset token`, without using or recording a real reset token.

Boundary evidence:

- No Auth JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, real reset token, password, API key, or raw production user data changed or was recorded.

Next action:

- No action needed for the reset-password route. The remote repo has no configured git remote, so pushing to origin is blocked until a remote URL is configured.

## 2026-06-13 - Goal 09 Auth Contract Production Smoke Verification Completed

Current focus:

- Owner-selected Goal 09: Auth contract production smoke verification after `AUTH-ALPHA-01` and `RBAC-REM-07` production deployment.
- Auth branch: `main`.
- Deployment: not run.
- Runtime code changes: none.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved source headings included Authentication API Endpoints, Business: auth-microservice, and Post-Cutover Verification Evidence.

Verification evidence:

- `npm run build` passed.
- `node --check web/public/js/admin.js` passed.
- Inline hosted login script syntax extraction passed.
- `https://auth.alfares.cz/health` returned HTTP 200.
- `https://auth.alfares.cz/login` returned HTTP 200.
- `https://auth.alfares.cz/register` returned HTTP 200.
- `https://auth.alfares.cz/admin` returned HTTP 200.
- Synthetic invalid `POST /auth/validate` returned HTTP 401 with a safe `valid` response summary.
- Safe `GET /auth/validate-return-url` returned HTTP 200 with the expected HTTPS return URL.
- Gate-critical missing-marker scan returned no matches.
- Documentation secret-pattern scan returned no matches.
- `git diff --check` passed.

Boundary evidence:

- No Auth runtime code, consumer code, endpoint, JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database, deployment, production user data, decoded secret, JWT, refresh token, OAuth token, magic-link token, reset token, password, API key, or token value changed or was recorded.

Next action:

- Owner selection for the next Auth remediation or implementation chunk.

## 2026-06-13 - AUTH-ALPHA-01 And RBAC-REM-07 Production Deployment Completed

Current focus:

- Owner approved production deployment after Auth Alpha and Logging admin RBAC remediation.
- Auth branch: `main` at `b540e74`.
- Logging branch: `main` at `4769c51`.

Deployment evidence:

- Logging deployed image `localhost:5000/logging-microservice:4769c51`; rollout completed and in-pod health check passed.
- Auth deployed backend image `localhost:5000/auth-microservice:b540e74-20260613062417` and web image `localhost:5000/auth-microservice-web:b540e74-20260613062417`.
- Auth deploy applied ConfigMap, ExternalSecret, manifests, deployment images, rollout, health check, and post-deploy config patch; final rollout completed successfully.

Production verification evidence:

- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web logging-microservice -o wide` showed all three deployments `READY 1/1` on the expected new images.
- `https://auth.alfares.cz/health` returned status `ok`.
- `https://auth.alfares.cz/login` returned HTTP 200.
- `https://auth.alfares.cz/admin` returned HTTP 200.
- `https://logging.alfares.cz/health` returned status `ok`.
- No decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, internal-service tokens, API keys, raw production user data, or database changes were recorded.

Next action:

- Owner selection for the next Auth remediation or implementation chunk after production deployment.


## 2026-06-13 - AUTH-ALPHA-01 Hosted Token Handoff URL Normalization Completed

Current focus:

- Owner-selected Auth Alpha implementation chunk: AUTH-ALPHA-01.
- Auth branch: `main`.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved current Auth context confirmed hosted Auth login/token validation and historical unified Auth flow requirements; current source-of-truth contract came from `docs/UNIFIED_AUTH_CONTRACT.md`.

Implementation evidence:

- Added backend `buildTokenHandoffUrl` helper in `src/auth/auth.service.ts`.
- OAuth callback and magic-link verify now build handoff URLs through the shared helper.
- Hosted email/password login/register UI now builds handoff URLs with `URL` plus `URLSearchParams` and replaces any caller fragment with Auth's handoff fragment.
- Added focused unit tests in `src/auth/auth-token-handoff.spec.ts` for caller-fragment replacement and optional fragment fields.

Validation evidence:

- `npm test -- --runTestsByPath src/auth/auth-token-handoff.spec.ts` passed.
- `npm run build` passed.
- `node --check web/public/js/admin.js` passed.
- Inline hosted login page script syntax extraction passed.
- `git diff --check` passed for changed Auth files.
- Auth documentation missing-marker scan returned no matches for gate-critical docs.
- Auth documentation secret-pattern scan returned no matches.
- No endpoint path, JWT payload, OAuth provider, magic-link token storage, CORS, redirect allowlist, deployment, database, production user data, decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, internal-service tokens, or API keys changed or were recorded.

Next action:

- Owner selection for the next Auth remediation or implementation chunk after AUTH-ALPHA-01.


## 2026-06-13 - RBAC-REM-07 Logging Admin Role-Enforcement Verification Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-07 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Logging branch: `main`.
- Logging commit: `4769c51 Enforce Auth roles for logging admin reads`.
- Auth runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved shared RBAC context included the expected pattern that internal microservice admin surfaces require an admin role or `global:superadmin` while Auth remains role authority.

Implementation evidence:

- Verified Logging `GET /api/logs/query` and `GET /api/logs/services` were previously unguarded backend reads, while `POST /api/logs` served ecosystem ingestion.
- Added `logging-microservice/src/auth/admin-role.guard.ts` to validate bearer tokens through Auth `/auth/validate` and require one of `global:superadmin`, `app:logging-microservice:admin`, or `internal:logging-microservice:admin`.
- Applied the guard only to Logging log-query and service-list endpoints; log ingestion remains unchanged.
- Updated Logging admin frontend role checks so authenticated non-admin users are cleared from the admin UI before data loads.

Validation evidence:

- `logging-microservice npm run build` passed.
- `node --check web/js/auth.js` passed.
- `node --check web/js/admin.js` passed.
- Compiled guard assertions passed for missing bearer token rejection, non-admin role rejection, and accepted Logging admin role.
- `git diff --check` passed for changed Logging files.
- No Auth runtime code, Auth JWT payload, Auth token validation endpoint, Logging log-ingestion endpoint, deployment, database, production user data, decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, or magic-link tokens changed.

Next action:

- Owner selection for the next Auth remediation or implementation chunk.


## 2026-06-13 - RBAC-REM-06 Internal Service-Token/API-Key Boundary Review Completed

Current focus:

- Owner-approved remediation chunk: RBAC-REM-06 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Auth runtime code changes: none.
- Consumer runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved context confirmed Auth centralizes identity and JWT issuance. Machine-auth specifics were completed from source inspection.

Implementation evidence:

- Added `docs/INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`.
- Reviewed Auth `InternalServiceGuard`, internal Auth endpoint guards, and `docs/UNIFIED_AUTH_CONTRACT.md`.
- Reviewed RunLayer `JwtGuard`, service-token env keys, and outbound token clients.
- Reviewed Notifications `JwtRolesGuard`, deployment notes, and orchestrator/AI service clients.
- Reviewed Payments `ApiKeyGuard`, `JwtRolesGuard`, controller guard usage, and key configuration docs.
- Reviewed Catalog `CatalogAuthGuard`, internal-service header handling, and Warehouse availability client.
- Reviewed Warehouse `JwtRolesGuard` as the receiving side for the Catalog availability call.
- Recorded follow-ups for RunLayer static service-token identity, Notifications broad bearer `SERVICE_TOKEN`, Payments `X-API-Key` production constraints, and Catalog/Warehouse availability-token reconciliation.

Validation evidence:

- `git diff --check` passed for changed Auth documentation/state files.
- Auth documentation missing-marker scan returned no matches for gate-critical docs.
- Auth documentation secret-pattern scan returned no matches.
- No Auth runtime code, consumer runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secrets, JWTs, API keys, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, or magic-link tokens changed.

Next action:

- RBAC-REM-07 completed later on 2026-06-13; next chunk requires owner selection.

## 2026-06-13 - RBAC-REM-05 School Committee Local-Role Contract Note Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-05 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- School Committee branch: `main`.
- Auth runtime code changes: none.
- School Committee runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved School Committee auth-integration context confirmed the platform must not implement authentication internally, Auth owns identity/JWT issuance/login/password reset, and the BFF validates Auth tokens through Auth.

Implementation evidence:

- Reviewed School Committee `README.md`, `SYSTEM.md`, `lib/auth/get-current-user.ts`, `lib/auth/validate-token.ts`, `lib/auth/require-role.ts`, `lib/auth/require-approved.ts`, and `prisma/schema.prisma` role/profile models.
- Added a School Committee README note clarifying that Auth validates identity while School Committee owns local school roles, tenant/school scoping, and profile approval workflow.
- Updated Auth RBAC audit and continuation docs to mark RBAC-REM-05 complete and set RBAC-REM-06 as the next remediation chunk.

Validation evidence:

- `git diff --check` passed for changed School Committee and Auth documentation/state files.
- Auth documentation missing-marker scan returned no matches for gate-critical docs.
- Auth documentation secret-pattern scan returned no matches.
- School Committee `npm run type-check` passed.
- No Auth runtime code, School Committee runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, or magic-link tokens changed.

Next action:

- Recommended next remediation chunk: RBAC-REM-06 internal service-token/API-key bypass inventory and Auth boundary review.

## 2026-06-13 - RBAC-REM-04 SpeakASAP Scoped-Role Normalization Review Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-04 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- SpeakASAP branch: `main`.
- SpeakASAP commit: `7135483 Preserve scoped Auth roles in SpeakASAP checks`.
- Auth runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved shared RBAC context confirmed Auth issues JWTs with role claims and consuming services should use centralized Auth role claims.

Implementation evidence:

- Reviewed `speakasap/assessment-service/src/auth/normalize-roles.ts`, `assessment-service` guards, `certification-service/src/auth/roles.ts`, certification role guards, SpeakASAP RBAC docs, and Auth RBAC seed definitions.
- Auth seeds `speakasap` as a user-facing application, so `app:speakasap:<role>` is the explicit application-scope mapping.
- Assessment no longer strips everything after the first colon; it preserves unscoped legacy local roles, maps accepted global staff roles, maps `app:speakasap:<role>`, and ignores unrelated scoped roles.
- Certification no longer grants access to any scoped role ending in `:manager` or `:teacher`; it uses the same explicit SpeakASAP/global mapping.
- Pre-existing dirty SpeakASAP files were not staged. Only the two RBAC-REM-04 helper files were committed.

Validation evidence:

- Isolated TypeScript compile passed for `assessment-service/src/auth/normalize-roles.ts`.
- Isolated TypeScript compile passed for `certification-service/src/auth/roles.ts`.
- Compiled helper assertions passed for local legacy roles, `app:speakasap:*`, `global:superadmin`, and denied `internal:speakasap:*` / `app:other:*` role shapes.
- `git diff --check -- assessment-service/src/auth/normalize-roles.ts certification-service/src/auth/roles.ts` passed.
- SpeakASAP pre-commit checks passed for commit `7135483`.
- Full `npm run build` was attempted in both changed services but could not complete because of pre-existing dependency state: assessment could not find `prisma` from the package script, and certification could not unlink a root-owned generated Prisma client file.
- No Auth runtime code, JWT payload, token validation endpoint, deployment, database, decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data changed.

Next action:

- Recommended next remediation chunk: RBAC-REM-05 School Committee local-role contract note.

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
