# Auth Orchestrator Status

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
