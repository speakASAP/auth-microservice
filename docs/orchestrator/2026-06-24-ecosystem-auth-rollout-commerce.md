# Commerce Ecosystem Hosted Auth Rollout Handoff

Date: 2026-06-24
Owner: Auth modernization orchestrator
Scope: Read-only migration handoff for marketplace and commerce repositories.
Target hosted auth entrypoints: `https://auth.alfares.cz/login` and `https://auth.alfares.cz/register`.

## Boundaries

- Inspection was read-only across `allegro-service`, `aukro-service`, `bazos-service`, `flipflop-service`, `heureka-service`, `orders-microservice`, `payments-microservice`, `warehouse-microservice`, and `catalog-microservice` under `/home/ssf/Documents/Github`.
- This file is the only intended write for this worker.
- No legacy `speakasap-portal` work, no deploy, no live database access, no secret value reads, no `.env` value reads, no Kubernetes Secret data reads.
- Existing in-progress `auth-microservice` changes are not owned by this handoff and must not be reverted.

## IPS Chain

### Vision

Centralize human credential collection in hosted Auth so commerce apps stop maintaining their own user password forms and converge on one login and registration experience.

### Goal Impact

- Reduce duplicated credential UI and password-handling code in marketplace and commerce frontends.
- Preserve service authorization boundaries for protected commerce APIs while moving human login/register UX to hosted Auth.
- Make later implementation parallelizable by separating storefront/frontend redirects, gateway auth proxies, local JWT verification risks, and service-to-service authorization concerns.

### System

Commerce ecosystem apps rely on `auth-microservice` for user identity but currently mix several patterns:

- Frontend credential forms that post email/password to local or gateway auth endpoints.
- API gateway auth proxy endpoints such as `/api/auth/login` and `/api/auth/register`.
- Shared local JWT verification using `JWT_SECRET` in marketplace wrappers.
- NestJS role guards in commerce microservices using locally configured `JwtModule` and `process.env.JWT_SECRET`.
- Service API keys for some service-to-service boundaries.

### Feature

Hosted Auth migration for commerce cluster:

- User-facing login links should route to `https://auth.alfares.cz/login`.
- User-facing registration links should route to `https://auth.alfares.cz/register`.
- Apps should stop owning user credential forms where hosted Auth can own the flow.
- Apps may keep token-consuming API guards, profile loading, and service-to-service checks until the central Auth token validation contract is confirmed.

### Task

Create repo-by-repo migration handoff, blockers, validation candidates, and parallel workstreams for the commerce cluster.

### Execution Plan

1. Confirm repo status and current branch without modifying inspected repos.
2. Inspect candidate auth files, route surfaces, frontend login/register pages, guards, and package scripts while excluding secret/env/runtime data.
3. Classify each repo by current auth surface, hosted-auth migration need, local JWT risk, validation command candidate, and blockers.
4. Define parallel workstreams with explicit ownership, allowed files, forbidden files, dependencies, validation evidence, and merge order.
5. Validate this handoff file with `git diff --check -- docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md` in `auth-microservice`.

### Coding Prompt

Use this prompt for implementation workers after auth owner confirms the hosted Auth return/callback contract:

```text
You are an Alfares auth modernization worker. Work only in the assigned remote repo under /home/ssf/Documents/Github. Preserve the IPS chain: Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation. Do not read secrets, .env values, Kubernetes Secret data, live DB rows, or production logs. Do not deploy. Replace local human login/register credential forms with links or redirects to https://auth.alfares.cz/login and https://auth.alfares.cz/register where applicable. Preserve protected API authorization behavior. Mark unavailable facts as [MISSING: ...] or [UNKNOWN: ...]. Run only the validation commands approved for the assigned repo and produce a concise handoff with changed files and evidence.
```

### Code

This handoff does not change application code. The next implementation wave should produce repo-local code diffs only after the hosted Auth app return/callback contract is confirmed.

### Validation

Required validation for this handoff:

```bash
git diff --check -- docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md
```

Implementation validation must be repo-specific and should not require live secrets or deployments unless separately approved.

## Repo-by-Repo Migration Table

| Repo | Current auth surface | Hosted-auth migration needed | Local JWT risk | Validation command candidate | Blockers |
| --- | --- | --- | --- | --- | --- |
| `allegro-service` | React frontend has `services/frontend/src/pages/LoginPage.tsx` and `RegisterPage.tsx` collecting email/password. `services/frontend/src/services/auth.ts` posts to `/auth/login`, `/auth/register`, `/auth/refresh` and stores access/refresh tokens in `localStorage`. Gateway exposes auth proxy routes. Shared `JwtAuthGuard` verifies tokens locally with `JWT_SECRET`. | High. Replace human login/register forms and nav links with hosted Auth redirects or links. Keep Allegro OAuth flows separate from Alfares user auth. Review gateway `/api/auth/*` compatibility after hosted Auth return contract is known. | High. Shared guard locally verifies HS256 with `JWT_SECRET`, logs decoded token structure in normal flow, and localStorage stores refresh token. Needs contract review for central validation or safer token handling. | `npm run ips:check`; targeted frontend build command is [MISSING: package script not found at root]. | [MISSING: hosted Auth callback/return URL contract]; [MISSING: token storage/session contract]; avoid touching Allegro OAuth token flows. |
| `aukro-service` | No standalone frontend login page found in inspected candidates. API gateway routes `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, and protected Aukro/settings/import routes via shared `JwtAuthGuard`. Shared auth service calls auth-microservice endpoints. | Medium. If this repo exposes gateway auth endpoints for users, route login/register callers to hosted Auth or deprecate proxy ownership. API consumers may only need token validation compatibility. | High. Shared `JwtAuthGuard` locally verifies JWT with `JWT_SECRET` and logs decoded token structure. | [MISSING: test/build script beyond `start:dev` in root package.json]; candidate smoke is TypeScript compile/build after repo owner identifies package-specific command. | [MISSING: active user-facing UI entrypoint]; [MISSING: hosted Auth return/callback contract]. |
| `bazos-service` | Embedded UI in `services/aukro-service/src/ui/ui.assets.ts` has client/admin sign-in/register copy. `services/aukro-service/src/ui/ui.controller.ts` exposes `POST /ui/auth/login`, `POST /ui/auth/register`, and `GET /ui/auth/me`. API gateway also proxies `/api/auth/login` and `/api/auth/register`. Shared `JwtAuthGuard` protects Bazos publish/catalog/identity surfaces. | High. Replace embedded sign-in/register experience with hosted Auth links. Remove or deprecate `/ui/auth/login` and `/ui/auth/register` only after hosted return/session contract is known. Keep Bazos platform identity/OAuth/publishing controls separate. | High. Shared local JWT verification with `JWT_SECRET`, plus Bazos UI owns credential POST endpoints. | `npm test`; add targeted UI/controller test command if implementation touches UI auth paths. | [MISSING: hosted Auth post-login return/session contract]; [MISSING: Bazos client/admin role mapping from hosted Auth]; do not change Bazos platform verification or publishing gates. |
| `flipflop-service` | Next frontend has local `app/login/page.tsx` and `app/register/page.tsx` credential forms. `services/frontend/lib/api/auth.ts` posts to `/auth/login` and `/auth/register`, and stores token through `apiClient`. `AuthContext` owns login/register state. `GatewayUserGuard` trusts `x-user-id` when present before Bearer validation. | High. Replace storefront login/register credential forms and links with hosted Auth. Preserve checkout/customer profile flows and post-login return target. | Medium to high. Frontend owns token lifecycle; order service guard accepts forwarded `x-user-id` without visible signature validation in inspected file, then falls back to auth token validation. | `npm run verify:leads-public-intake`; `npm run smoke:checkout` after auth return is mocked or non-secret test token support exists. | [MISSING: hosted Auth return URL and session propagation]; [MISSING: whether `x-user-id` is trusted only from a verified gateway]; [MISSING: frontend build/test command for auth pages]. |
| `heureka-service` | No standalone frontend login page found. API gateway proxies `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, and protects Heureka/settings/import routes with shared `JwtAuthGuard`. Shared auth service calls auth-microservice. | Medium. Migrate or deprecate gateway-owned human auth proxy paths if exposed to users. Token-consuming protected APIs likely remain. | High. Shared `JwtAuthGuard` locally verifies JWT with `JWT_SECRET` and logs decoded token structure. | `npm run ips:check` or `npm run ips:deployment-readiness` for docs/gate changes; package-specific build/test is [MISSING]. | [MISSING: active user-facing UI entrypoint]; [MISSING: central token validation contract]. |
| `orders-microservice` | Backend-only Nest auth module. `src/auth/jwt-roles.guard.ts` validates Bearer JWT with `JwtService.verify(..., secret: process.env.JWT_SECRET)` and role metadata. No local credential forms found. | Low for hosted login/register UI. Needs compatibility work only if hosted Auth changes token claims, issuer, audience, roles, or validation method. | Medium. Local JWT verification depends on shared secret and local role claim interpretation. | `npm run build`; targeted existing checks such as `npm run verify:admin-operations-console` if admin auth claims are touched. | [MISSING: hosted Auth token claims contract including `sub`, `email`, `roles`, issuer/audience]; [MISSING: JWKS/introspection vs shared-secret decision]. |
| `payments-microservice` | Backend-only Nest auth module. `src/auth/jwt-roles.guard.ts` validates Bearer JWT locally and supports `x-api-key` path. `src/security/api-key.guard.ts` protects API-key scoped service requests. No local credential forms found. | Low for hosted login/register UI. Needs token compatibility review for admin/payment operations. | Medium. Local JWT verification and environment API key allowlist; no credential form ownership found. | `npm test`; `npm run build` if implementation touches Nest auth module. | [MISSING: hosted Auth token claims and role mapping for payments]; [MISSING: service API-key vs hosted Auth boundary decision]. |
| `warehouse-microservice` | Backend-only Nest auth module. `src/auth/jwt-roles.guard.ts` validates Bearer JWT locally and maps user/service claims to authenticated actor through `src/auth/authenticated-actor.ts`. No local credential forms found. | Low for hosted login/register UI. Needs token compatibility review for mutation actor audit semantics. | Medium. Local JWT verification and actor derivation from claims could drift if hosted Auth changes claim names. | `npm test`; `npm run build`; targeted `test/authenticated-actor.spec.ts` if actor mapping changes. | [MISSING: hosted Auth service-token/user-token claim contract]; [MISSING: actor audit compatibility requirement]. |
| `catalog-microservice` | Next frontend has local `app/login/page.tsx` and `app/register/page.tsx` credential forms. Frontend `services/frontend/lib/api/auth.ts` posts to catalog `/api/auth/login` and `/api/auth/register`; backend `src/auth/auth.controller.ts` proxies these to auth-microservice. `CatalogAuthGuard` protects product/category/attribute/media/pricing/integration mutations. | High. Replace Catalog admin login/register forms with hosted Auth. Keep protected mutation guards and role requirements. Decide whether catalog auth proxy endpoints remain for API compatibility or are deprecated. | Medium. Catalog guard performs local HS256 verification against `JWT_SECRET`/`CATALOG_INTERNAL_TOKEN` style runtime config in inspected file; frontend owns token storage. | `npm run build`; `npm test`; `npm run smoke:e2e` for anonymous protected rejection. Avoid authorized smokes unless credentials are explicitly approved. | [MISSING: hosted Auth admin return URL/session contract]; [MISSING: central token validation/JWKS/introspection decision]; existing auth modernization changes in `auth-microservice` are in progress and not owned by this file. |

## Parallel Workstreams

### Workstream A: Hosted Auth Contract Owner

- Status: dependency-gated.
- Owner role: `auth-microservice` contract owner.
- Objective: publish the hosted Auth redirect, return, token/session, logout, and role-claim contract for commerce apps.
- Allowed files: `auth-microservice/docs/**`, hosted Auth controller/web files owned by the auth team after separate implementation approval.
- Forbidden files: commerce repo source files during contract definition; secrets, `.env`, Kubernetes Secret data, live DB data.
- Dependencies: current auth modernization work in `auth-microservice`; hosted Auth endpoints at `https://auth.alfares.cz/login` and `/register`.
- Expected output: contract doc naming login/register URLs, `returnTo` or equivalent parameter, allowed origins, token/session storage guidance, logout behavior, claim schema, role mapping, and migration compatibility window.
- Validation evidence: `git diff --check`, auth unit/web tests selected by auth owner, and synthetic browser validation that does not print tokens.
- Merge order: first.
- Handoff notes: all other workstreams are blocked for final code changes until this contract exists.

### Workstream B: Marketplace Gateway/Auth Proxy Review

- Status: dependency-gated.
- Owner role: marketplace API gateway owner.
- Scope repos: `allegro-service`, `aukro-service`, `bazos-service`, `heureka-service`.
- Objective: decide whether `/api/auth/login`, `/api/auth/register`, `/ui/auth/login`, and `/ui/auth/register` remain as compatibility proxies, redirect to hosted Auth, or are removed after migration.
- Allowed files: gateway controllers/services and auth docs in assigned repo; tests for those routes.
- Forbidden files: marketplace OAuth token storage, platform credentials, secret/env files, production manifests, deploy scripts unless separately approved.
- Dependencies: Workstream A contract; active UI entrypoint confirmation for Aukro and Heureka.
- Expected output: repo-local handoff or diff with route behavior, redirect status, deprecation notes, and synthetic tests.
- Validation evidence: package-specific build/test where available; `npm run ips:check` for Allegro/Heureka docs if docs are changed; no live auth credentials.
- Merge order: after Workstream A, before frontend link cleanup for repos that depend on gateway behavior.
- Handoff notes: keep Allegro marketplace OAuth and Bazos platform identity/OAuth separate from Alfares user auth.

### Workstream C: Frontend Credential Form Removal

- Status: dependency-gated.
- Owner role: frontend owner for each assigned repo.
- Scope repos: `allegro-service`, `bazos-service`, `flipflop-service`, `catalog-microservice`.
- Objective: remove user-owned password collection forms where hosted Auth can own login/register and replace with hosted Auth links/redirects.
- Allowed files: frontend login/register pages, auth context/client wrappers, navigation links, synthetic frontend tests in assigned repo.
- Forbidden files: backend guard semantics, OAuth platform integrations, payment/order/warehouse business logic, env files, Kubernetes manifests, deploy scripts.
- Dependencies: Workstream A return/session contract; Workstream B route decision for repos using local gateway auth proxy.
- Expected output: hosted Auth login/register routes wired with safe return target and no local password POST from user-facing forms.
- Validation evidence: frontend build/test command where available; synthetic route assertions; no real credentials.
- Merge order: after Workstreams A and B for gateway-backed repos; can run per repo in parallel once dependencies are satisfied.
- Handoff notes: FlipFlop and Catalog need post-login return behavior to preserve checkout/admin flows.

### Workstream D: Token Validation And Local JWT Risk Reduction

- Status: dependency-gated.
- Owner role: backend auth boundary owner.
- Scope repos: all nine inspected repos, with priority on shared marketplace guards plus `orders-microservice`, `payments-microservice`, `warehouse-microservice`, and `catalog-microservice`.
- Objective: align local JWT verification with central hosted Auth token contract, reduce shared-secret drift, and remove unsafe debug logging of decoded token structures where present.
- Allowed files: auth guards, auth modules, token validation tests, auth boundary docs in assigned repo.
- Forbidden files: user credential forms unless paired with Workstream C, secrets/env values, service API key values, production manifests, deploy scripts unless separately approved.
- Dependencies: Workstream A token contract, including claim schema, role mapping, and JWKS/introspection/shared-secret decision.
- Expected output: repo-local validation approach that preserves protected API behavior and actor audit semantics.
- Validation evidence: `npm run build` and repo tests where available; targeted guard unit tests; no token values printed.
- Merge order: after Workstream A; backend-only repos can proceed independently after contract publication.
- Handoff notes: Warehouse actor derivation and Payments API-key paths need explicit compatibility review rather than blanket replacement.

### Workstream E: Integration And Validation Owner

- Status: final integration.
- Owner role: auth modernization integration owner.
- Objective: collect repo handoffs, verify no repo still owns human credential forms unless explicitly exempted, and produce ecosystem validation summary.
- Allowed files: orchestrator docs and final validation report in `auth-microservice/docs/orchestrator`; repo-local validation reports from completed workers.
- Forbidden files: application code unless acting as explicit integration owner for that repo; secrets/env/live DB/deploy paths.
- Dependencies: Workstreams A through D.
- Expected output: final commerce auth rollout readiness report with completed repos, blocked repos, validation evidence, and remaining `[MISSING: ...]` facts.
- Validation evidence: `git diff --check` for docs, repo-specific build/test evidence from workers, and synthetic browser/API checks approved by auth owner.
- Merge order: last.
- Handoff notes: if multiple repo workers edit shared auth helper packages within one repo, appoint one repo integration owner before merge.

## Shared Contracts And Merge Order

1. Auth hosted redirect/session/token contract from Workstream A.
2. Gateway/proxy route decisions from Workstream B.
3. Frontend hosted Auth link/redirect implementation from Workstream C.
4. Backend token validation alignment from Workstream D.
5. Ecosystem validation report from Workstream E.

Shared contracts:

- Hosted Auth URLs: `https://auth.alfares.cz/login`, `https://auth.alfares.cz/register`.
- Return/callback parameter: active standard is `return_url` with absolute HTTPS callback, `client_id`, and optional `state` as defined in `docs/HOSTED_AUTH_CONSUMER_STANDARD.md`.
- Token/session storage model: active standard prefers BFF/httpOnly cookies and allows browser storage only as documented transitional debt in `docs/HOSTED_AUTH_CONSUMER_STANDARD.md`.
- Token validation model: [MISSING: JWKS/introspection/shared-secret decision].
- Role claim schema: [MISSING: hosted Auth role and service-token claim schema].
- Logout model: [MISSING: hosted Auth logout and downstream token invalidation contract].

## Inspection Evidence

Remote read-only commands inspected:

- `git status --short --branch`, current branch, and latest commit for all scoped repos plus `auth-microservice`.
- Candidate auth files using `find` with auth/login/register/jwt/guard/user filename filters excluding generated and dependency directories where practical.
- Targeted source reads for frontend login/register pages, auth API clients, auth contexts, gateway auth routes, Nest guards, and auth modules.
- Root `package.json` scripts for validation command candidates.

Not inspected by design:

- Secret values, `.env` values, Kubernetes Secret data, live DB data, production logs, deploy output, legacy `speakasap-portal`.
