# Ecosystem Auth Rollout Handoff: Platform, Ops, and Admin Cluster

Date: 2026-06-24
Mode: read-only migration handoff
Target Auth: `https://auth.alfares.cz/login` and `https://auth.alfares.cz/register`

## Constraints

- Remote-only source of truth: `/home/ssf/Documents/Github` on `alfares`.
- Inspected only: `ai-microservice`, `backups-microservice`, `database-server`, `docs-rag-microservice`, `logging-microservice`, `monitoring-microservice`, `notifications-microservice`, `prompts-microservice`, `runlayer`, `suppliers-microservice`, `minio-microservice`.
- Wrote only this file in `auth-microservice`.
- Did not touch legacy `speakasap-portal`.
- Did not read `.env` values, Kubernetes Secret data, live database data, or deploy anything.
- Existing dirty work in `auth-microservice` was left untouched.

## IPS Chain

| Node | Content |
| --- | --- |
| Vision | Alfares platform, ops, and admin apps use central hosted Auth for human identity while keeping service-local authorization boundaries explicit. |
| Goal Impact | Remove service-local password entry and reduce JWT-secret drift by standardizing hosted login/register and Auth `/auth/validate`. |
| System | Auth service, platform/admin UIs, backend guards, service-to-service callers, Kubernetes non-secret config, and validation scripts. |
| Feature | Hosted Auth handoff plus standard bearer-token validation for platform/ops/admin surfaces. |
| Task | Produce a repo-by-repo migration handoff and parallel execution plan. |
| Execution Plan | Split work into hosted UI migration, backend validation standardization, service-token boundary, validation, and final integration. |
| Coding Prompt | Replace direct browser POSTs to `/auth/login` or `/auth/register` with hosted `/login` and `/register`; validate user/admin bearer tokens via Auth `/auth/validate`; keep role checks service-local; do not conflate service tokens with human Auth. |
| Code | No application code changed. Only `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md` was created. |
| Validation | `git diff --check -- docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md`. |

## Repo-by-Repo Table

| Repo | Current auth surface | Hosted-auth migration needed | Local JWT risk | Validation command candidate | Blockers |
| --- | --- | --- | --- | --- | --- |
| `ai-microservice` | Admin flow uses hosted Auth login URL and Auth `/auth/validate`; service APIs use local HMAC service JWT in `src/service-identity`. | Human admin mostly ready; confirm whether `/register` is intentionally absent. Service-token changes belong to a separate machine-identity task. | Medium for service identity; low for admin human flow. | `npm run build && npm run test -- --runInBand`; targeted `test/service-identity`. | `[UNKNOWN: final service-token standard contract]`; existing unrelated `auth-microservice` dirty work. |
| `backups-microservice` | Admin UI posts email/password to `/admin/session`; server forwards to Auth `/auth/login`; `JwtRolesGuard` verifies local `JWT_SECRET`; `SERVICE_TOKEN` bypass exists. | Replace local password form with hosted `/login` callback; add `/register` only if non-admin onboarding exists; validate human/admin tokens through Auth `/auth/validate`. | High: local verification of Auth-issued admin token. | `npm run build && npm test -- --runInBand`. | `[MISSING: backups callback URL and client_id]`; `[UNKNOWN: final restore/admin role names]`. |
| `database-server` | Express proxies `/auth/*`; admin UI posts to `/auth/login`; `/api/stats` validates via Auth proxy `/auth/validate`. | Replace direct credential login with hosted `/login` and optional `/register`; keep backend validation. | Low for backend validation; medium for browser token/session handling. | `cd web && node --check server.js && node --check public/js/admin.js`. | `[MISSING: database-server callback route contract]`; no live DB validation by design. |
| `docs-rag-microservice` | No human/admin UI observed; global `ServiceAuthGuard` verifies local HMAC service JWT. | No hosted login/register unless UI is added; service token migration is separate. | Medium: protected endpoints depend on local service JWT. | `npm run build && npm run test:unit`; `npm run gate:pre-coding`. | `[MISSING: central machine-token validation contract]`. |
| `logging-microservice` | Backend guards call Auth `/auth/validate`; admin web helper posts credentials to Auth `/auth/login`. | Convert browser login/register to hosted redirects and callback; preserve backend Auth validation and role checks. | Low in backend guards; direct credential POST remains a UX/security migration item. | `npm run build && npm test -- --runInBand`; syntax check changed `web/js/*.js`. | `[MISSING: logging callback URL/client_id]`; `[UNKNOWN: customer registration route]`. |
| `monitoring-microservice` | Next web app already builds hosted `/login` and `/register` with `client_id=monitoring-web`; backend validates via Auth `/auth/validate`. | Mostly validation and contract confirmation. | Low for human/admin validation. | Backend `npm run build && npm test -- --runInBand`; web `cd web && npm run build`. | `[UNKNOWN: Auth registry has monitoring-web and allowed return URLs]`. |
| `notifications-microservice` | Admin UI posts credentials to Auth `/auth/login`; `JwtRolesGuard` locally verifies `JWT_SECRET`; `JwtAuthGuard` calls Auth `/auth/validate`. | Convert admin UI to hosted `/login`/`/register`; consolidate human/admin routes on Auth validation; isolate service-token bypass. | High: duplicate guard styles and local JWT verification. | `npm run build && npm test -- --runInBand`. | `[MISSING: route map for JwtRolesGuard vs JwtAuthGuard]`; `[UNKNOWN: final notifications admin role contract]`. |
| `prompts-microservice` | Local `/api/auth/login` and `/api/auth/register` proxy credentials to Auth; auth guard validates through Auth and stores cookie. | Replace local login/register forms with hosted redirects/callback; decide whether to preserve HTTP-only cookie session. | Low for validation; medium for local auth proxy and credential handling. | `npm run check`; add callback/API smoke after change. | `[MISSING: prompts callback URL/client_id]`; `[UNKNOWN: required cookie/session model]`. |
| `runlayer` | Public app already builds hosted `/login` and `/register` for `client_id=runlayer`; `JwtGuard` validates through Auth; `AdminGuard` is open if admin ID list is empty. | Validate callback contract and harden admin authorization policy; keep service-token fallback separate. | Medium: not local JWT, but admin policy can be open by config. | `npm run build && npm test -- --runInBand`; e2e only with mocked Auth or approved non-secret test setup. | `[UNKNOWN: intended admin policy when orchestratorAdminIds is empty]`; `[MISSING: service-token fallback contract]`. |
| `suppliers-microservice` | Login form POSTs to `https://auth.alfares.cz/auth/login`; registration stores local interest; backend `JwtRolesGuard` verifies local `JWT_SECRET`. | Move UI to hosted `/login` and `/register`; replace local human/admin JWT verification with Auth `/auth/validate`. | High: admin APIs verify Auth-issued tokens locally. | `npm run build`; add focused guard tests because no test script was observed. | `[MISSING: suppliers callback URL/client_id and test harness]`; `[UNKNOWN: customer registration vs interest-only flow]`. |
| `minio-microservice` | Static web already uses hosted `/login` and `/register` with `client_id=minio-microservice`; wrapper validates bearer through Auth `/auth/validate`. | Mostly validation/contract confirmation; do not alter S3 SigV4 proxy behavior. | Low for human/admin Auth; S3 auth is separate and must stay unchanged. | `python3 -m py_compile backend/wrapper_api.py`; `node --check web/app.js`; IPS gates if touched. | `[UNKNOWN: Auth registry has minio-microservice return URLs]`; runtime smoke needs approved non-secret token. |

## Parallel Workstreams

### A. Hosted Login/Register UI Migration

- Status: ready now, callback-contract gated.
- Owner role: frontend/platform integration engineer.
- Scope: `backups-microservice`, `database-server`, `logging-microservice`, `notifications-microservice`, `prompts-microservice`, `suppliers-microservice`.
- Allowed files: browser UI/auth helpers, callback/session route files, non-secret public Auth config, repo-local tests.
- Forbidden files: `.env*`, Kubernetes Secret data, live DB data, deploy scripts execution, `speakasap-portal`.
- Dependencies: hosted Auth `return_url`, `state`, token transport, `client_id`, refresh behavior, allowed callback URLs.
- Expected output: hosted login/register links, callback parser, token/session persistence, logout behavior, validation evidence.
- Validation evidence: JS syntax/build plus mocked Auth callback/browser/API smoke; no real credentials.
- Merge order: `database-server` and `prompts-microservice`, then `backups`, `logging`, `notifications`, `suppliers`.
- Handoff notes: preserve HTTP-only cookies where already used unless integration owner standardizes otherwise.

### B. Backend Human/Admin Token Validation

- Status: ready now for local-verification repos; helper-shape gated.
- Owner role: backend auth integration engineer.
- Scope: `backups-microservice`, `notifications-microservice`, `suppliers-microservice`.
- Allowed files: auth guards/services/modules, route decorators, tests/specs, non-secret config references.
- Forbidden files: `.env*`, secret-bearing data, live DB queries, deploy execution, service-token generation from live secrets.
- Dependencies: Auth `/auth/validate` response schema, role taxonomy, error semantics.
- Expected output: guards validate human/admin bearer tokens through Auth and fail closed on Auth errors.
- Validation evidence: tests for missing bearer, invalid token, Auth unavailable, role denied, role allowed.
- Merge order: after A where callback payload affects guard inputs; `notifications` needs guard usage inventory first.
- Handoff notes: keep machine-token compatibility explicit and separate.

### C. Machine/Service Token Boundary

- Status: dependency-gated.
- Owner role: service identity/platform engineer.
- Scope: `ai-microservice`, `docs-rag-microservice`, `runlayer`, and service-token bypasses in `backups-microservice` and `notifications-microservice`.
- Allowed files: service identity guards/utilities, tests, non-secret docs.
- Forbidden files: live secret reads, `.env*`, Kubernetes Secret data, deploys, production token introspection.
- Dependencies: `[MISSING: central machine-token standard]` and `[UNKNOWN: whether Auth owns service identities]`.
- Expected output: no-op out-of-scope confirmation or separate IPS chain for machine identity migration.
- Validation evidence: mocked token tests only.
- Merge order: after human/admin hosted Auth lanes unless Auth owner publishes one shared user/service helper.
- Handoff notes: do not block hosted Auth UI migration on service-token decisions unless the same guard path is shared.

### D. Already-Migrated Validation

- Status: ready now.
- Owner role: validation engineer.
- Scope: `monitoring-microservice`, `minio-microservice`, `runlayer`, `ai-microservice` admin, `logging-microservice` backend guards.
- Allowed files: validation reports, repo-local tests, non-secret docs.
- Forbidden files: app code changes unless assigned back to implementation, `.env*`, live token reads, deploys.
- Dependencies: Auth client registry facts.
- Expected output: pass/fail matrix with exact commands and evidence.
- Validation evidence: build/syntax/test outputs and mocked callback proof.
- Merge order: runs in parallel with A/B; feeds E before readiness.
- Handoff notes: `minio-microservice` validation must also protect S3 SigV4 behavior.

### E. Final Integration Owner

- Status: final integration.
- Owner role: Auth modernization integration owner.
- Scope: shared Auth contract docs and final rollout readiness.
- Allowed files: `auth-microservice` contract/orchestrator docs and final status docs.
- Forbidden files: scoped repo application code unless resolving a declared conflict; live secrets; deploys without approval.
- Dependencies: A/B/D evidence and `[MISSING: Auth registry source of truth]`.
- Expected output: final migration readiness doc and conflict decisions.
- Validation evidence: `git diff --check`, contract review, linked per-repo command evidence.
- Merge order: A UI changes -> B guard changes -> D validation -> E readiness; C only after service-token standard approval.
- Handoff notes: reject migrations that keep service-domain password forms when hosted Auth is available.

## Open Facts

- `[MISSING: authoritative Auth client registry and allowed return URLs]`
- Hosted Auth callback token transport is fragment handoff (`#access_token`, optional `#refresh_token`, `#expires_at`, `#state`, `#auth_method`) per `docs/HOSTED_AUTH_CONSUMER_STANDARD.md`.
- `[MISSING: central service/machine token strategy]`
- `[UNKNOWN: whether admin-only services need `/register` links]`
- `[UNKNOWN: final normalized Auth `/auth/validate` response shape across legacy clients]`
- `[UNKNOWN: standard session model after hosted callback: HTTP-only cookie vs browser storage]`

## Inspection Evidence

Read-only inspection used remote `ssh alfares` commands, `git status --short --branch`, `git log -1 --oneline`, package script reads, and targeted `rg`/`sed` over auth guards and browser auth helpers. Secret values, `.env` files, Kubernetes Secret data, live database data, and deploys were intentionally excluded.
