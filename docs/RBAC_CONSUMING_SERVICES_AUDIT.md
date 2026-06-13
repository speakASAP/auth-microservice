# RBAC Consuming Services Audit

Date: 2026-06-12
Goal: GOAL-06 - RBAC Consuming Services Audit
Scope: documentation-only audit from remote source repositories under `/home/ssf/Documents/Github`.

## Gate Summary

- Owner selection: user said "Go ahead with the next task", selecting Goal 06 from `docs/IMPLEMENTATION_STATE.md`.
- DocsRAG: unavailable. The remote shell did not have `JWT_TOKEN` set, so `POST /retrieval/agent-context` could not be authenticated. This is recorded as a gate exception under `AUTH-INV-007`.
- Sensitive data: no decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user records were read or recorded.
- Runtime code: unchanged.
- Consumer code: unchanged.

## Auth Contract Baseline

`docs/UNIFIED_AUTH_CONTRACT.md` defines Auth as the authority for identity, token issuance and validation, refresh tokens, RBAC role claims, OAuth, magic links, registered-user preferences, and internal service authentication boundaries.

Auth JWT payloads include `sub`, `email`, `type`, `roles`, optional `auth_method`, and standard JWT fields. Consumers may enforce roles locally, but Auth remains the authority for role assignment and role claims.

Auth role string shape from `src/roles/roles.service.ts` is:

- `global:<role>`
- `app:<application-name>:<role>`
- `internal:<application-name>:<role>`

## Inspected Consumers

| Consumer | Evidence inspected | Auth/RBAC pattern | Compatibility notes |
| --- | --- | --- | --- |
| `catalog-microservice` | `src/auth/catalog-auth.guard.ts`, `src/auth/catalog-auth.decorator.ts`, `services/frontend/components/AdminGuard.tsx`, `k8s/external-secret.yaml`, `k8s/configmap.yaml` | Direct HS256 JWT verification from `JWT_SECRET`; checks `payload.roles`; supports internal service token mapped to `internal:catalog-microservice:admin` and `catalog:write`. | Backend role checks match Auth role claim shape, but K8s currently sources `JWT_SECRET` from `secret/prod/catalog-microservice`, not `secret/prod/auth-microservice`; frontend AdminGuard comment says Auth does not support roles and allows any authenticated user client-side. |
| `warehouse-microservice` | `src/auth/jwt-roles.guard.ts`, `docs/orchestrator/warehouse-intent-plan.md`, `k8s/external-secret.yaml`, `k8s/configmap.yaml` | Direct Nest JWT verification from `JWT_SECRET`; default required roles are `global:superadmin` or `internal:<SERVICE_NAME>:admin`. | Role strings match Auth contract. K8s sources `JWT_SECRET` from `secret/prod/warehouse-microservice`, while docs say it must match Auth; this is a rotation/alignment risk. |
| `suppliers-microservice` | `src/auth/jwt-roles.guard.ts`, `.env.example`, `k8s/external-secret.yaml`, `k8s/configmap.yaml` | Direct Nest JWT verification from `JWT_SECRET`; default required roles are `global:superadmin` or `internal:<SERVICE_NAME>:admin`. | Role strings match Auth contract. K8s sources `JWT_SECRET` from `secret/prod/suppliers-microservice`, creating the same alignment risk. |
| `orders-microservice` | `src/auth/jwt-roles.guard.ts`, `.env.example`, `k8s/external-secret.yaml`, `k8s/configmap.yaml` | Direct Nest JWT verification from `JWT_SECRET`; default required roles are `global:superadmin` or `internal:<SERVICE_NAME>:admin`. | Role strings match Auth contract. K8s sources `JWT_SECRET` from `secret/prod/orders-microservice`, creating the same alignment risk. |
| `payments-microservice` | `src/auth/jwt-roles.guard.ts`, `.env.example`, `k8s/external-secret.yaml`, `k8s/configmap.yaml` | Direct Nest JWT verification from `JWT_SECRET`; default required roles are `global:superadmin` or `internal:<SERVICE_NAME>:admin`; also permits service-to-service `x-api-key` when configured. | Role strings match Auth contract. K8s sources `JWT_SECRET` from `secret/prod/payments-microservice`; API-key bypass is consumer-owned service auth, but should be reviewed separately from Auth RBAC. |
| `notifications-microservice` | `src/auth/jwt-roles.guard.ts`, `src/guards/jwt-auth.guard.ts`, `docs/DEPLOYMENT.md`, `k8s/external-secret.yaml`, `k8s/configmap.yaml` | Two patterns exist: direct JWT role guard using Auth JWT secret, and older round-trip `/auth/validate` guard. `JwtRolesGuard` also allows `SERVICE_TOKEN` for machine checks. | Good production alignment evidence: K8s maps `JWT_SECRET` from `secret/prod/auth-microservice`. Service-token bypass is intentional but should stay documented as non-user machine auth. |
| `shop-assistant` | `src/auth/auth.service.ts`, `src/auth/jwt-auth.guard.ts`, `src/auth/roles.guard.ts`, `src/admin/*.controller.ts`, public admin docs | Round-trip validation through `POST /auth/validate`, then local `RolesGuard` checks roles. Admin controllers require `global:superadmin` or `app:shop-assistant:admin`. | Compatible with Auth contract and avoids sharing JWT secret. Admin docs include placeholder token examples only; no real token evidence recorded. |
| `runlayer` | `src/common/auth/jwt.guard.ts`, `.env.example`, `k8s/external-secret.yaml`, `k8s/configmap.yaml`, tests/docs references | Round-trip validation through `/auth/validate`; also accepts trusted static service tokens from env without an Auth round trip. | User-token validation is compatible. Static token acceptance is a separate service-auth boundary and should not be confused with Auth RBAC roles. `.env.example` contains token-generation guidance that should be reviewed for secret-handling hygiene. |
| `speakasap/api-gateway` | `src/auth-client/auth-client.service.ts`, shared auth types | Round-trip validation through `/auth/validate`; carries returned `roles` through request context. | Compatible at identity-validation layer. |
| `speakasap/notification-service` | `src/auth/jwt-auth.guard.ts`, controllers using the guard, `src/shared/staff.util.ts` | Round-trip validation through Auth client; staff checks accept `admin` or `staff` plain roles. | Local staff-role vocabulary is app-owned. If these roles are expected from Auth, they should be modeled explicitly because Auth canonical global roles are prefixed. |
| `speakasap/assessment-service` and `speakasap/certification-service` | `assessment-service/src/auth/normalize-roles.ts`, certification controllers with `@Roles('manager')` and `@Roles('teacher_strict')` | Role normalization strips Auth scope prefixes before local checks. | Risk: stripping scope can collapse `global:<role>`, `app:<app>:<role>`, and `internal:<app>:<role>` into the same local name. This should be reviewed before relying on scoped Auth RBAC. |
| `school-committee` | `lib/auth/get-current-user.ts`, `lib/auth/require-role.ts`, auth API routes, tests | Auth tokens are validated, then app roles are loaded from the school-committee database (`parent`, `committee`, `teacher`, `school_staff`, `admin`). | This is consumer-owned authorization, not Auth-owned RBAC. It is compatible only if documented as local tenant/application authorization layered after Auth identity validation. |
| `logging-microservice` web admin | `web/js/auth.js`, `web/admin/index.html`, config JS | Browser login and `/auth/validate` through Auth; sessionStorage stores access/refresh tokens for admin UI. | Authentication is Auth-compatible. No server-side role guard was found in the inspected web admin files; admin role enforcement should be verified separately. |
| `marketing-microservice` and `leads-microservice` | docs and config references only | Use Auth for registered-user data/preferences and service URLs, not RBAC enforcement in inspected source. | No RBAC consumer finding in this audit. Ownership docs correctly keep registered-user preferences in Auth and non-registered leads in Leads. |

## Findings

### 1. Direct JWT consumers need secret-source alignment review

`catalog-microservice`, `warehouse-microservice`, `suppliers-microservice`, `orders-microservice`, and `payments-microservice` verify Auth JWTs locally from `JWT_SECRET`. Their role checks match the Auth role-claim contract, but their K8s ExternalSecret files source `JWT_SECRET` from each service's own Vault path. `notifications-microservice` is the observed positive pattern: it maps `JWT_SECRET` from `secret/prod/auth-microservice`.

Risk: if the per-service Vault values diverge from Auth's signing secret during rotation or manual update, valid Auth JWTs will fail in these consumers, or consumers may accept tokens signed by a non-Auth secret.

Recommended remediation chunk: audit Vault key provenance without printing values, then update consuming service ExternalSecret mappings to source JWT verification secrets from the Auth Vault path where direct JWT verification remains the chosen pattern.

### 2. Prefer `/auth/validate` or a shared verified library over duplicated local JWT verification

Some consumers use `/auth/validate` (`shop-assistant`, `runlayer`, `speakasap`, `school-committee`, logging UI), while others implement local HS256 verification. Both can be contract-compatible, but direct verification duplicates expiry/algorithm/secret assumptions in each service.

Recommended remediation chunk: choose a standard consumer pattern: either round-trip `/auth/validate` for admin panels and lower-throughput APIs, or a shared internal JWT verification module plus centrally sourced Auth verification secret for high-throughput services.

### 3. Catalog frontend AdminGuard has stale role assumption

`catalog-microservice/services/frontend/components/AdminGuard.tsx` says Auth does not support roles/admin flags and allows all authenticated users client-side. The backend mutation guard does enforce roles, so this is not an immediate backend authorization bypass, but it creates confusing UX and stale contract knowledge.

Recommended remediation chunk: update Catalog frontend guard/docs to reflect Auth role claims and optionally hide admin surfaces unless the user has `global:superadmin`, `app:catalog-microservice:admin`, or another accepted catalog role.

### 4. Scoped role strings are sometimes normalized into unscoped app roles

`speakasap/assessment-service/src/auth/normalize-roles.ts` strips everything before the first colon. That can turn multiple Auth scopes into the same local role name. Example shape: `global:manager`, `app:speakasap:manager`, and `internal:speakasap:manager` would all become `manager`.

Recommended remediation chunk: document whether SpeakASAP roles are intentionally local/unscoped. If they are Auth-owned RBAC claims, preserve the full Auth role string or map only explicitly allowed scoped roles.

### 5. School Committee uses local role ownership after Auth identity validation

`school-committee` validates Auth tokens, then reads local roles from its own database. This is acceptable as app-local tenant authorization, but it should not be described as Auth RBAC enforcement. Auth owns identity and global/application role claims; School Committee owns its domain roles and approval state.

Recommended remediation chunk: add a short contract note to School Committee docs: Auth validates identity, School Committee owns local school roles and approval workflow.

### 6. Static service-token bypasses need separate service-auth review

`runlayer`, `notifications-microservice`, `payments-microservice`, and `catalog-microservice` have non-user machine auth paths in addition to Auth JWT handling. These may be valid internal-service contracts, but they must stay separate from user RBAC and must not be used as a substitute for Auth-issued user identity.

Recommended remediation chunk: inventory service-token and API-key bypasses across consumers and align header names, trusted caller names, rotation rules, and logging redaction with Auth's internal service contract.

### 7. Logging web admin role enforcement was not proven

The inspected `logging-microservice/web/js/auth.js` authenticates and validates through Auth, but no role guard was found in the inspected web admin source. This may be handled elsewhere, but it was not proven by this audit.

Recommended remediation chunk: inspect logging admin backend/API authorization and require `global:superadmin` or `app:logging-microservice:admin` for privileged operations.

## Remediation Backlog

1. `RBAC-REM-01`: Done 2026-06-12. Secret-source alignment for direct JWT consumers: catalog, warehouse, suppliers, orders, payments. Validated without printing or decoding secret values.
2. `RBAC-REM-02`: Done 2026-06-12. Standardized consumer JWT validation pattern: default to `POST /auth/validate`; allow shared local verifier only as a constrained backend exception.
3. `RBAC-REM-03`: Done 2026-06-13. Catalog frontend role-aware admin guard and stale comment cleanup committed in catalog `5f0e087`.
4. `RBAC-REM-04`: Done 2026-06-13. SpeakASAP scoped-role normalization review and remediation committed in SpeakASAP `7135483`.
5. `RBAC-REM-05`: Done 2026-06-13. School Committee local-role contract note committed in School Committee.
6. `RBAC-REM-06`: Done 2026-06-13. Internal service-token/API-key bypass inventory and Auth boundary review recorded in `docs/INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`.
7. `RBAC-REM-07`: Logging admin role-enforcement verification.



## RBAC-REM-06 Internal Service-Token/API-Key Boundary Review

Status: completed 2026-06-13.

Scope: Auth-side documentation inventory only. No consumer runtime files changed.

Decision: Static service tokens and API keys are machine-auth credentials. They may remain valid for service-to-service calls, provider callbacks, smoke checks, and tightly scoped internal APIs, but they are not Auth user identity and are not Auth RBAC role claims.

Inventory result:

- Added `docs/INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`.
- Recorded Auth's canonical internal-service header contract: `x-internal-service-token` plus `x-service-name`.
- Classified observed machine-auth paths in `catalog-microservice`, `notifications-microservice`, `runlayer`, `payments-microservice`, and the Catalog-to-Warehouse availability call.
- Identified service-local follow-ups for RunLayer service-token identity, Notifications broad bearer `SERVICE_TOKEN`, Payments `X-API-Key` production constraints, and Catalog/Warehouse availability-token contract reconciliation.

Follow-up chunk: `RBAC-REM-07` Logging admin role-enforcement verification.


## RBAC-REM-05 School Committee Local-Role Contract Note

Status: completed 2026-06-13.

Scope: `school-committee` README documentation only.

Decision: School Committee delegates authentication to Auth and validates Auth-issued access tokens through `POST /auth/validate`. After identity validation, School Committee owns school-domain authorization: local roles such as `parent`, `committee`, `teacher`, `school_staff`, and `admin`, plus profile approval state and tenant/school scoping.

Implementation result:

- Added a School Committee README contract note that separates Auth-owned identity/JWT/RBAC claims from School Committee-owned local roles and approval workflow.
- No Auth runtime code, School Committee runtime code, token validation endpoint, JWT payload, deployment, database, production user data, decoded secrets, JWTs, or tokens changed.

Follow-up chunk: `RBAC-REM-06` completed; next chunk is `RBAC-REM-07`.


## RBAC-REM-03 Catalog Frontend Role-Aware Admin Guard

Status: completed 2026-06-13.

Scope: `catalog-microservice/services/frontend/components/AdminGuard.tsx` plus Catalog continuation docs.

Decision: Catalog admin frontend surfaces should not render for every authenticated Auth user. The frontend guard now checks Auth roles before rendering admin children and removes the stale comment that said Auth does not support roles/admin flags.

Accepted frontend roles:

- `global:superadmin`
- `app:catalog-microservice:admin`
- `internal:catalog-microservice:admin`
- `catalog:write`

Implementation evidence:

- Catalog commit: `5f0e087 Make catalog admin guard role aware` on `feature/catalog-goal-04-channel-readiness-model`.
- Non-authorized authenticated users receive an access-required state and a route back to the catalog home page.
- Backend Catalog authorization remains unchanged and continues to enforce server-side roles.

Validation evidence:

- `services/frontend npm run build` passed.
- `git diff --check -- services/frontend/components/AdminGuard.tsx` passed.
- Catalog pre-commit checks passed.
- No Auth runtime code, Catalog backend authorization code, secrets, tokens, production user data, database changes, or deployment changed.

Follow-up chunk: `RBAC-REM-04` SpeakASAP scoped-role normalization review.

## RBAC-REM-04 SpeakASAP Scoped-Role Normalization Review

Status: completed 2026-06-13.

Scope: `speakasap/assessment-service/src/auth/normalize-roles.ts` and `speakasap/certification-service/src/auth/roles.ts`.

Decision: SpeakASAP may keep legacy unscoped local roles for its own domain authorization, but Auth scoped roles must not be generically stripped. Only explicit user-facing SpeakASAP roles and accepted global staff roles should map into local SpeakASAP role names.

Accepted mapping:

- unscoped legacy local roles remain unchanged, for example `manager`, `teacher`, `admin`, `staff`, `super_admin`, and `superadmin`;
- `app:speakasap:<role>` maps to local `<role>`;
- `global:superadmin` and `global:platform_admin` map to manager/staff access where existing SpeakASAP policy treats platform staff as authorized;
- `internal:*` roles and `app:<other-app>:<role>` do not map into SpeakASAP local user roles.

Implementation evidence:

- SpeakASAP commit: `7135483 Preserve scoped Auth roles in SpeakASAP checks`.
- Assessment no longer strips everything after the first colon; unrelated scoped Auth roles are ignored.
- Certification no longer grants manager or teacher access to any role ending in `:manager` or `:teacher`; only explicit SpeakASAP/global mappings pass.
- Auth runtime code, JWT payload shape, Auth role assignment, and Auth token validation endpoints remain unchanged.

Validation evidence:

- DocsRAG retrieval from `deployment/auth-microservice` returned `HTTP 200` and confirmed current shared RBAC context: Auth issues JWTs with roles and consuming services use centralized Auth role claims.
- Isolated TypeScript compile passed for `assessment-service/src/auth/normalize-roles.ts`.
- Isolated TypeScript compile passed for `certification-service/src/auth/roles.ts`.
- Compiled helper assertions passed:
  - legacy local roles still pass;
  - `app:speakasap:manager` and `app:speakasap:teacher` still pass;
  - `global:superadmin` still grants staff/manager access;
  - `internal:speakasap:manager`, `internal:speakasap:teacher`, and `app:other:manager` no longer grant SpeakASAP user-role access.
- Full `npm run build` was attempted but could not complete because of pre-existing dependency state: assessment could not find the `prisma` command in the package script path, and certification failed to unlink a root-owned generated Prisma client file. Narrow compile and helper assertions were used as compensating validation.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, production user data, database changes, or deployment changed.

Follow-up chunk: `RBAC-REM-06` internal service-token/API-key bypass inventory and Auth boundary review.

## RBAC-REM-02 Consumer JWT Validation Standardization

Status: completed 2026-06-12.

Decision: Auth consumers should default to `POST /auth/validate` for Auth-issued user access tokens. Direct local JWT verification remains allowed only as a high-throughput backend exception when it follows `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`.

Standardized classification:

| Pattern | Consumers | Notes |
| --- | --- | --- |
| Default `POST /auth/validate` | `shop-assistant`, `runlayer`, `speakasap/api-gateway`, `school-committee`, `logging-microservice` web admin | Compatible pattern. Consumers keep authorization policy local after Auth identity validation. |
| Shared local verifier exception | `catalog-microservice`, `warehouse-microservice`, `suppliers-microservice`, `orders-microservice`, `payments-microservice`, `notifications-microservice` | Allowed only with Auth-sourced verification secret material, expiry/signature enforcement, unsafe-algorithm rejection, and full Auth role-string preservation. |
| Separate machine-auth review | `runlayer`, `notifications-microservice`, `payments-microservice`, `catalog-microservice` | Static service-token/API-key paths are not user RBAC and remain queued for `RBAC-REM-06`. |

Implementation result:

- Added `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`.
- Updated `docs/UNIFIED_AUTH_CONTRACT.md` with the consumer token validation standard.
- No Auth runtime code, consumer runtime code, secrets, decoded tokens, production data, or deployments were changed.

Follow-up chunks: `RBAC-REM-03`, `RBAC-REM-04`, `RBAC-REM-05`, `RBAC-REM-06`, and `RBAC-REM-07`.

## RBAC-REM-01 Secret-Source Alignment Review

Status: completed 2026-06-12.

Scope: direct JWT consumers that verify Auth-issued JWTs from the local `JWT_SECRET` environment key: `catalog-microservice`, `warehouse-microservice`, `suppliers-microservice`, `orders-microservice`, and `payments-microservice`.

Review evidence:

| Consumer | Before source path | Remediated source path | Commit | Validation |
| --- | --- | --- | --- | --- |
| `catalog-microservice` | `secret/prod/catalog-microservice` | `secret/prod/auth-microservice` | `fcb1919` | server-side dry run passed |
| `warehouse-microservice` | `secret/prod/warehouse-microservice` | `secret/prod/auth-microservice` | `015cf4f` | server-side dry run passed |
| `suppliers-microservice` | `secret/prod/suppliers-microservice` | `secret/prod/auth-microservice` | `c1e92d2` | server-side dry run passed |
| `orders-microservice` | `secret/prod/orders-microservice` | `secret/prod/auth-microservice` | `e05c2c3` | server-side dry run passed |
| `payments-microservice` | `secret/prod/payments-microservice` | `secret/prod/auth-microservice` | `66bf990` | server-side dry run passed |

Changes made:

- Updated only `k8s/external-secret.yaml` in each target consumer repository.
- Kept the consumer runtime environment key as `JWT_SECRET`.
- Changed only the ExternalSecret `remoteRef.key` for `JWT_SECRET` to `secret/prod/auth-microservice`.
- Left other service-owned secret keys on their service-specific Vault paths.
- Did not deploy or apply live changes.

Validation evidence:

- Live ExternalSecret metadata was checked with `kubectl get externalsecret` jsonpath output for `secretKey`, `remoteRef.key`, and `remoteRef.property`; no secret values were printed.
- Live Kubernetes Secret key names were checked with `kubectl get secret -o json | jq '.data | keys'`; no values were decoded or printed.
- `kubectl apply --dry-run=server -f k8s/external-secret.yaml` passed for all five target manifests.
- `git diff --check -- k8s/external-secret.yaml` passed for all five target manifests.
- Consumer repository pre-commit hooks passed for all five commits.

Residual notes:

- Source manifests are committed but not deployed by this session. Final live metadata showed catalog already aligned, while warehouse, suppliers, orders, and payments still used their previous source paths; those remaining live changes require consumer deployment or GitOps sync.
- `orders-microservice` had pre-existing uncommitted changes in `k8s/external-secret.yaml` for `JWT_TOKEN`; only the RBAC-REM-01 `JWT_SECRET` source-path hunk was staged and committed.
- `suppliers-microservice`, `orders-microservice`, and `payments-microservice` still have unrelated dirty worktree files from other sessions; those were not staged or committed here.

## Intent Compliance

- Auth ownership preserved: yes. The audit keeps Auth as identity, token, and RBAC role-claim authority.
- Consumer enforcement preserved: yes. Consumer-owned authorization policy remains in consumers.
- Non-Auth ownership excluded: yes. No catalog, warehouse, orders, payment, leads, marketing, notification sending, logging storage, database infrastructure, or gateway ownership is moved into Auth.
- Sensitive-data rule preserved: yes. No secrets or tokens were printed or persisted.
- JWT/RBAC compatibility checked: yes. Findings are based on role claim shape, direct JWT verification, Auth validation calls, and observed required role strings.
- Runtime changes: none.

## Validation Evidence

Commands were run from `alfares` against `/home/ssf/Documents/Github/*` and `/home/ssf/Documents/Github/auth-microservice`.

- Required Auth/orchestrator docs read.
- `rg` scans found Auth/RBAC consumers across remote repositories.
- Narrow source reads inspected guards, decorators, auth clients, role checks, and K8s ExternalSecret/ConfigMap references.
- DocsRAG query attempted and skipped because `JWT_TOKEN` was not set.
- Final documentation scans are recorded in `docs/orchestrator/STATUS.md`.
