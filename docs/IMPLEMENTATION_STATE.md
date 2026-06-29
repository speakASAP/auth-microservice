2026-06-29: Added source-only support for internal scoped role assignment dry-runs in `scripts/assign-role-by-email.ts`. The helper now parses `internal:<service>:<role>` and supports `--dry-run`, enabling an approved operator to verify a future Catalog-to-Warehouse role assignment such as `internal:warehouse-microservice:admin` without ad hoc SQL. No role assignment, service principal creation, token issuance, Vault/Kubernetes secret mutation, deployment, database mutation, or token value inspection was performed.

2026-06-29: Auth admin Users application-filter production remediation implemented and deployed on `alfares`. Owner screenshot showed `/admin` Users loading failure with `Error loading users: Internal server error` while filtering by application. Live backend logs showed `QueryFailedError: syntax error at or near "."` in `UsersService.findAdminListPage`. Fixed the application/admin-only subquery SQL to quote the reserved TypeORM alias as `"user"."id"` instead of `user.id`, and added focused Jest coverage for both filter clauses. Validation passed: `npm test -- --runTestsByPath src/users/users.service.spec.ts`, `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts src/users/users.service.spec.ts`, `npm run build`, `npm run lint`, `git diff --check`, deploy-script Auth contract tests (16 tests), Kubernetes rollout, live `/admin` HTTP 200, live `/health` ok, deployed images `localhost:5000/auth-microservice:9a309b0-20260629000608` and `localhost:5000/auth-microservice-web:9a309b0-20260629000608`, running pod compiled-code check for both quoted alias clauses, and post-deploy log scan with no recurrence of the previous SQL error. No database schema, JWT payload, RBAC assignment semantics, OAuth, magic-link, password reset, CORS, internal-service contract, decoded secrets, tokens, passwords, raw production user data, or consumer-service code changed.
2026-06-28: Owner-selected Auth admin Users role/application checkbox management implemented and deployed on `alfares`. Added selected-user role/application checkboxes in `/admin`, backed by existing Auth admin role APIs; application checkboxes assign the default application `user` role and remove that application's assigned roles when unchecked. The combined admin change set also includes server-side user search plus application, status, verified, and app-admin-only filters; per-user application/admin-application summaries; and `GET /auth/admin/users/application-admins` for admins grouped by registered application. Validation passed: `node --check web/public/js/admin.js`, `node --check web/server.js`, `git diff --check`, `npm run build`, `npm run lint`, and `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` (6 tests). Deployment completed with backend image `localhost:5000/auth-microservice:bf7e63c-20260628214651` after the post-deploy restart and web image `localhost:5000/auth-microservice-web:bf7e63c-20260628214214`; live `/admin` returned HTTP 200 and served the updated admin HTML/JS. No production database writes by agents, role mutations by agents, decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, raw production user-data dumps, consumer-service code, JWT payload changes, RBAC assignment semantic changes, OAuth, magic-link, CORS, internal-service contracts, or database schema changes.
2026-06-28: Owner-reported Auth admin Users layout defect fixed and deployed on `alfares`. Updated hosted admin dashboard CSS so the authenticated dashboard uses 80vw, table wrappers scroll horizontally instead of clipping columns, and the users table keeps enough minimum width for the Actions column. Bumped the admin script asset query version to force refreshed hosted assets. Deployed images `localhost:5000/auth-microservice:a39f9d2-20260628212026` and `localhost:5000/auth-microservice-web:a39f9d2-20260628212026`; live `/admin` returned HTTP 200 and served CSS contains the new 80vw rule. No Auth API, JWT, RBAC, OAuth, magic-link, reset-token, CORS, internal-service, database, secret, token, password, or production user-data behavior changed.
2026-06-27: Auth-owned Catalog service identity source established for Goal 17. Created runtime-only Vault property `CATALOG_INTERNAL_SERVICE_TOKEN` under `secret/prod/auth-microservice` without printing or recording the value. Catalog and Orders consume it via ExternalSecret as `CATALOG_INTERNAL_SERVICE_TOKEN`; request contract remains `x-internal-service-token` plus `x-service-name: catalog-microservice`, mapping to service actor `internal:catalog-microservice:service`, not an Auth user JWT. No Auth endpoint, JWT payload, RBAC, database, user data, or secret value changed in source.
# Auth Implementation State

Last updated: 2026-06-28.

## Orchestrator Command

```text
2026-06-28: Auth admin Users layout fix deployed on `alfares`. Owner reported the live `/admin` Users page appeared to show no data and requested the page be widened to 80% of the viewport. Implemented dashboard-only 80vw container width, horizontal table overflow, users-table minimum width, and admin asset cache-busting. Validation passed: CSS/HTML source inspection, `node --check web/public/js/admin.js`, `node --check web/server.js`, `npm run build`, `git diff --check`, deploy script auth contract tests, rollout checks, live `/admin` HTTP 200, served CSS 80vw rule check, and deployed image verification. No decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, API keys, raw production user data, Auth API contracts, JWT payloads, RBAC, OAuth, magic-link, CORS, internal-service contracts, database schema, or consumer-service code changed.
2026-06-13: Goal 09 Auth contract production smoke verification completed. Auth production health and hosted entry points were verified after AUTH-ALPHA-01 and RBAC-REM-07 deployment; build/syntax checks, synthetic invalid-token validation, safe redirect validation, DocsRAG, diff-check, and documentation scans passed. No runtime, deployment, contract, secret, token, database, or production user-data changes.
AUTH ORCHESTRATOR: continue implementation
```

English continuation command:

```text
Continue implementation of this project.
```

To start a specific goal:

```text
AUTH ORCHESTRATOR: implement goal number 6
```

## Current Status

- Latest owner-selected fix: hosted password reset success UX and reset-page Back-to-login query handling implemented and deployed on `alfares` with image tag `49a2f30-20260628230756`.
- Active goal: none
- Current wave: Wave 2 - Operational backlog
- Completed goals: 01 Admin Token Copy UX And Safety, 02 Auth Intent Preservation Pack, 03 Unified Auth Contract Recovery, 04 Auth Observability And Safety Checks, 05 Goalkeeper-Style Orchestrator Workflow, IPS Documentation Compliance Update, 06 RBAC Consuming Services Audit, RBAC-REM-01 Secret-Source Alignment Review, RBAC-REM-02 Consumer JWT Validation Standardization, RBAC-REM-03 Catalog Frontend Role-Aware Admin Guard, RBAC-REM-04 SpeakASAP Scoped-Role Normalization Review, RBAC-REM-05 School Committee Local-Role Contract Note, RBAC-REM-06 Internal Service-Token/API-Key Boundary Review, RBAC-REM-07 Logging Admin Role-Enforcement Verification, AUTH-ALPHA-01 Hosted Token Handoff URL Normalization, 09 Auth Contract Production Smoke Verification
- Running goals: none
- Blocked goals: none
- Worker threads: none
- Production status: `STATE.json` reports production health `ok`; `/reset-password` route fix deployed on 2026-06-26
- Source of truth: `alfares:/home/ssf/Documents/Github/auth-microservice`
- Local snapshot rule: `/Users/Sergej.Stasok/Documents/auth` is context only; future code and documentation changes must be made and committed on `alfares`.
- Agent entrypoint: `AGENTS.md`
- Master orchestrator: `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- Status evidence log: `docs/orchestrator/STATUS.md`
- Goal roadmap: `implementation-goals/README.md` and `docs/orchestrator/GOALS.md`
- RBAC audit report: `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- DocsRAG mode: mandatory before broad ecosystem architecture or contract decisions when a service JWT is available.
- IPS gate mode: mandatory before coding through `docs/orchestrator/PROJECT_INVARIANTS.md`, `PRE_CODING_GATE.md`, `CONTEXT_PACKAGE.md`, `EXECUTION_PLAN.md`, and `READINESS_GATES.md`.

## Goal Roadmap

| Goal | File | Status | Depends On | Notes |
|---|---|---|---|---|
| 01 | `implementation-goals/GOAL-01-admin-token-copy.md` | done | none | Production-deployed admin token copy UX. |
| 02 | `implementation-goals/GOAL-02-auth-intent-preservation-pack.md` | done | 01 | Existing `docs/orchestrator/*` pack and AGENTS workflow. |
| 03 | `implementation-goals/GOAL-03-unified-auth-contract-recovery.md` | done | 02 | Restored current contract docs referenced by DocsRAG. |
| 04 | `implementation-goals/GOAL-04-auth-observability-safety.md` | done | 03 | Auth audit logging and redaction safeguards. |
| 05 | `implementation-goals/GOAL-05-goalkeeper-style-orchestration.md` | done | 02 | Adds Goalkeeper-style master orchestrator state, goal index, and templates. |
| 06 | `implementation-goals/GOAL-06-rbac-consuming-services-audit.md` | done | 03, 04, 05 | Audit completed in `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`; remediation chunks require owner selection. |
| 08 | `implementation-goals/GOAL-08-auth-alpha-hosted-token-handoff.md` | done | 03, 05 | Auth Alpha hosted token handoff URL normalization completed. |
| 09 | `implementation-goals/GOAL-09-auth-contract-production-smoke-verification.md` | done | 08 | Production contract smoke verification completed after deployment. |

## Execution Waves

| Wave | Goals | Mode | Gate Before Next Wave |
|---|---|---|---|
| 1 | 01-05 | sequential | Orchestrator state, contract docs, and security evidence recorded. |
| 2 | 06+ | owner-selected | DocsRAG context when JWT is available, execution plan, and Auth boundary review before coding or cross-service remediation work. |

## Worker Threads

None.

When worker sessions are launched, record compressed summaries here:

```text
Worker:
Goal:
Branch/worktree:
Write ownership:
Status:
Summary:
Validation:
Risks:
Changed files:
```

## State Update Rules

At the end of every implementation session, update:

- goal status: `ready`, `active`, `blocked`, `done`, or `superseded`;
- active chunk;
- running worker thread summaries;
- branch name, if a branch is used;
- validation evidence;
- blockers and owner questions;
- changed file list;
- next recommended command.

Do not paste full worker logs into this file. Compress each worker result into no more than:

- 20 lines of implementation summary;
- 10 lines of validation evidence;
- 10 lines of risks or follow-ups;
- changed file list.

## Validation Evidence Log

Append newest entries at the top.

```text
2026-06-28: Owner-selected hosted password reset success UX fix implemented and deployed on `alfares`. Updated `web/public/index.html` so successful reset confirmation clears and hides the `New password` and `Confirm new password` fields plus submit button, preserves `return_url`, `client_id`, and `state` on the reset page `Back to login` link when present, and stops rendering the immediate `Missing required query parameter: return_url` error on a plain `/login` load. Updated focused hosted web contract assertions. Validation passed: `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` (6 tests), `git diff --check`, `npm run build`, `node --check web/server.js`, and extracted inline hosted script syntax check. No password reset API, reset-token generation, reset-token validation, reset-token expiry, email sending, JWT payload, refresh token, OAuth, magic-link, RBAC, redirect allowlist, CORS, internal-service contract, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, real reset token, password, API key, or raw production user data changed or was recorded. Deployment completed with backend image `localhost:5000/auth-microservice:49a2f30-20260628230756` and web image `localhost:5000/auth-microservice-web:49a2f30-20260628230756`; live `/reset-password?token=synthetic-ui-check`, `/login`, and `/health` checks passed, and served hosted HTML contains the reset UX fix markers without the old missing-`return_url` error string.
2026-06-26: Hosted password reset route fix in progress on `alfares`. Owner reported emailed password reset links open `GET /reset-password` and receive `Cannot GET /reset-password`. Implemented hosted `/reset-password` serving and reset-password UI mode against the existing `/auth/password-reset-confirm` API. Validation passed: focused hosted-auth Jest spec, build, hosted script syntax, web server syntax, diff-check, active missing-marker scan, and documentation secret-pattern scan. Owner-approved production deployment completed with images `localhost:5000/auth-microservice:1026463-20260626175614` and `localhost:5000/auth-microservice-web:1026463-20260626175614`; final rollout checks passed and live `/reset-password` returned HTTP 200. No decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, real reset tokens, passwords, API keys, raw production user data, database changes, or consumer-service changes were recorded.
2026-06-13: AUTH-ALPHA-01 and RBAC-REM-07 production deployment completed on `alfares`. Deployed Auth backend image `localhost:5000/auth-microservice:b540e74-20260613062417`, Auth web image `localhost:5000/auth-microservice-web:b540e74-20260613062417`, and Logging image `localhost:5000/logging-microservice:4769c51`. Validation: Auth backend and web deployments rolled out, Logging deployment rolled out, Auth pod health returned `ok`, `https://auth.alfares.cz/login` returned HTTP 200, `https://auth.alfares.cz/admin` returned HTTP 200, and `https://logging.alfares.cz/health` returned `ok`. No decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, API keys, production user data, or database changes were recorded.
2026-06-13: AUTH-ALPHA-01 hosted token handoff URL normalization completed on `alfares`. Centralized backend OAuth and magic-link token handoff URL construction, updated hosted email/password UI handoff construction, and added focused tests so caller fragments are replaced by Auth's final token handoff fragment instead of creating double-fragment redirects. Validation: DocsRAG returned HTTP 200 from the Auth pod, focused Jest handoff tests passed, `npm run build` passed, frontend syntax checks passed, diff-check passed, and Auth documentation secret/missing-marker scans passed. No endpoint path, JWT payload, OAuth provider, magic-link token storage, CORS, redirect allowlist, deployment, database, production user data, decoded secret, JWT, refresh token, OAuth token, magic-link token, reset token, or password changes.
2026-06-13: RBAC-REM-07 Logging admin role-enforcement verification completed on `alfares`. Logging commit `4769c51` added backend Auth role enforcement for `GET /api/logs/query` and `GET /api/logs/services`, left `POST /api/logs` ingestion unchanged, and added frontend admin role checks. Validation: DocsRAG returned HTTP 200 from the Auth pod, Logging `npm run build` passed, frontend JS syntax checks passed, compiled guard assertions passed, Logging diff-check passed, Auth documentation diff-check and secret/missing-marker scans passed. No Auth runtime code, Auth JWT payload, Auth token validation endpoint, Logging log-ingestion endpoint, deployment, database, production user data, decoded secret, JWT, API-key, or token changes.
2026-06-13: RBAC-REM-06 internal service-token/API-key boundary review completed on `alfares`. Added `docs/INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md` documenting Auth's canonical internal-service headers, observed machine-auth paths in Catalog, Notifications, RunLayer, Payments, and Catalog-to-Warehouse availability calls, and service-local follow-ups. Updated Auth RBAC audit and continuation state. Validation: DocsRAG returned HTTP 200 from the Auth pod, git diff --check passed for changed docs/state files, and Auth missing-marker/secret-pattern scans passed. No Auth runtime code, consumer runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secret, JWT, API-key, or token changes.
2026-06-13: RBAC-REM-05 School Committee local-role contract note completed on `alfares`. Added a School Committee README contract note clarifying that Auth owns identity, login, JWT issuance, refresh, password reset, and global/application RBAC claims, while School Committee owns local school roles, tenant/school scoping, and profile approval workflow after Auth identity validation. Updated Auth RBAC audit and continuation state. Validation: DocsRAG returned HTTP 200 from the Auth pod, School Committee type-check passed, git diff --check passed for changed docs/state files, and Auth missing-marker/secret-pattern scans passed. No Auth runtime code, School Committee runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secret, JWT, or token changes.
2026-06-13: RBAC-REM-04 SpeakASAP scoped-role normalization review completed on `alfares`. Updated SpeakASAP assessment and certification role helpers so unscoped legacy local roles remain valid, `app:speakasap:<role>` maps explicitly, accepted global staff roles remain authorized, and unrelated `internal:*` or other-app scoped roles no longer collapse into SpeakASAP local manager/teacher roles. SpeakASAP commit `7135483`. Validation: DocsRAG returned HTTP 200 from the Auth pod, isolated TypeScript compile passed for both changed helpers, compiled role assertions passed for allowed and denied role shapes, SpeakASAP diff-check and pre-commit passed. Full service builds were attempted but blocked by pre-existing dependency/prisma state. No Auth runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secret, JWT, or token changes.
2026-06-13: DocsRAG JWT token pickup fixed for Auth on `alfares`. Live ExternalSecret and Kubernetes Secret metadata already contained `JWT_TOKEN`; restarted `deployment/auth-microservice` so the pod picked up the synced secret. Verified pod env reports `JWT_TOKEN_ENV_PRESENT`, DocsRAG retrieval from inside `deployment/auth-microservice` returned HTTP 200 without printing the token, and external health returned status ok. Updated `AGENTS.md` with the pod-based DocsRAG query workflow because SSH shells are not expected to export `JWT_TOKEN`. No runtime code, manifest, database, production data, or secret-value changes.
2026-06-12: RBAC-REM-02 Consumer JWT Validation Standardization completed on `alfares`. Added `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`; updated `docs/UNIFIED_AUTH_CONTRACT.md` and `docs/RBAC_CONSUMING_SERVICES_AUDIT.md` to make `POST /auth/validate` the default consumer pattern and allow shared local verification only as a constrained backend exception. Validation: missing-marker scan returned no matches, documentation secret-pattern scan returned no matches, and git diff --check passed for changed docs/state files. No Auth runtime code, consumer runtime code, deployment, decoded secrets, JWTs, tokens, or production user data changed.
2026-06-12: RBAC-REM-02 Consumer JWT Validation Standardization selected by owner on alfares. Updated execution plan and context package to standardize consumer JWT validation pattern (/auth/validate versus shared local verifier). DocsRAG unavailable because JWT_TOKEN is not set in the remote shell; planning gate passed with documented exception and existing Auth contract/RBAC audit evidence. Validation: missing-marker scan returned no matches, documentation secret-pattern scan returned no matches, and git diff --check passed for changed docs/state files. No Auth runtime code, consumer runtime code, deployment, decoded secrets, JWTs, tokens, or production user data changed.
2026-06-12: RBAC-REM-01 Secret-Source Alignment Review completed on `alfares`. Reviewed direct JWT consumer secret-source metadata without printing or decoding secret values. Updated and committed `k8s/external-secret.yaml` in catalog (`fcb1919`), warehouse (`015cf4f`), suppliers (`c1e92d2`), orders (`e05c2c3`), and payments (`66bf990`) so `JWT_SECRET` sources from `secret/prod/auth-microservice`, matching notifications. Validation: live ExternalSecret metadata checked without values, Kubernetes Secret key names checked without decoding values, server-side dry run passed for all five manifests, diff-check passed, and consumer pre-commit hooks passed. No Auth runtime code, consumer runtime code, deployment, decoded secrets, JWTs, tokens, or production user data changed.
2026-06-12: Goal 06 RBAC Consuming Services Audit completed on `alfares` in `/home/ssf/Documents/Github/auth-microservice`. Added `docs/RBAC_CONSUMING_SERVICES_AUDIT.md` naming inspected consumers, Auth/RBAC validation patterns, compatibility risks, and owner-approvable remediation chunks. DocsRAG was unavailable because `JWT_TOKEN` was not set; gate passed with documented exception and remote source evidence. Validation: documentation report exists, missing-marker scan passed, secret-pattern scan passed cleanly, and `git diff --check` passed. No runtime code, consumer code, secrets, or production user data changed.
2026-06-12: IPS Documentation Compliance Update completed and committed on `alfares` in `/home/ssf/Documents/Github/auth-microservice`. Added Auth-local IPS invariants, pre-coding gate, context package, execution-plan frame, and readiness gates under `docs/orchestrator/`. Updated `AGENTS.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/PLAN.md`, and `docs/orchestrator/PROMPTS.md` so future coding must pass traceability, invariant, sensitive-data, contract, context, validation, and readiness checks before implementation. Validation: documentation presence and secret-pattern scan passed on remote; missing-marker scan is clean for active docs and intentionally excluded reusable templates that contain `[MISSING: ...]` placeholders. No runtime code changed.
2026-06-12: Goal 05 Goalkeeper-Style Orchestrator Workflow completed and committed on `alfares` in `/home/ssf/Documents/Github/auth-microservice`. Added `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, `implementation-goals/README.md`, goal files for completed and ready work, and execution/context/prompt/validation templates. Updated `AGENTS.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/GOALS.md`, `docs/orchestrator/PROMPTS.md`, and `docs/orchestrator/STATUS.md` so future Auth sessions use the same state-driven master-agent pattern as Goalkeeper. Validation: documentation file presence and cross-reference scan passed on remote; no runtime code changed.
2026-06-12: Goal 04 Auth Observability And Safety Checks completed and deployed. See `docs/orchestrator/STATUS.md` for tests, build, deployment image, production probe, and DocsRAG ingestion evidence.
2026-06-12: Goal 03 Unified Auth Contract Recovery completed. See `docs/orchestrator/STATUS.md` for DocsRAG, route inspection, secret scan, and ingestion evidence.
2026-06-12: Goal 02 Auth Intent Preservation Pack completed. See `docs/orchestrator/STATUS.md` for orchestrator pack creation, AGENTS update, deployment, and DocsRAG ingestion evidence.
2026-06-12: Goal 01 Admin Token Copy UX And Safety completed and deployed. See `docs/orchestrator/STATUS.md` for UI, syntax, build, deployment, and remote verification evidence.
```

## Required Session Report

Every implementation, merge, or validation session must finish with:

```text
Goal:
Branch:
Changed files:
Intent Compliance Report:
Validation:
Blockers:
Next command:
```

## Open Decisions

- Goal 09 production contract smoke verification is complete. Next remediation or implementation chunk requires owner selection.
- Production deployment remains explicit-owner-approval only.

## Next Action

Active next command:

```text
AUTH ORCHESTRATOR: continue implementation
```

Source documents:

```text
TASKS.md
docs/RBAC_CONSUMING_SERVICES_AUDIT.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
docs/IMPLEMENTATION_STATE.md
docs/orchestrator/GOALS.md
implementation-goals/GOAL-08-auth-alpha-hosted-token-handoff.md
```
