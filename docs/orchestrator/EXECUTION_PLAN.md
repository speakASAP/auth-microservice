# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: done
- owner: owner-selected
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: validated
- upstream: docs/RBAC_CONSUMING_SERVICES_AUDIT.md, docs/orchestrator/CONTEXT_PACKAGE.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-selected remediation chunk: RBAC-REM-04 - SpeakASAP scoped-role normalization review.

Decision and implementation task: review SpeakASAP role normalization in `assessment-service` and `certification-service`, then remove generic scope stripping where it can collapse Auth role scopes into unscoped application roles. Preserve legacy SpeakASAP local role names, but map Auth-owned scoped roles only when the scope is explicitly allowed for user-facing SpeakASAP authorization.

## Upstream Traceability

- Original intent: docs/orchestrator/INTENT.md
- Current state: docs/IMPLEMENTATION_STATE.md
- Audit source: docs/RBAC_CONSUMING_SERVICES_AUDIT.md
- Contract source: docs/UNIFIED_AUTH_CONTRACT.md
- Verification source: docs/UNIFIED_AUTH_VERIFICATION.md
- Operational source: docs/ENV_CORS_AND_AUTH_CHECK.md
- Owner selection: user selected RBAC-REM-04 on 2026-06-13.

## Goal Impact

This remediation preserves Auth as the identity and RBAC role-claim authority while keeping SpeakASAP authorization policy local to SpeakASAP services. The goal is to avoid treating unrelated scoped Auth roles, especially `internal:*` service roles or another app's roles, as SpeakASAP manager/teacher/admin roles.

## Project Invariants

- AUTH-INV-001: applies. Auth remains identity, JWT, and RBAC role-claim authority.
- AUTH-INV-002: applies. SpeakASAP endpoint authorization and education-domain policy stay in SpeakASAP.
- AUTH-INV-003: applies. Auth JWT role strings must remain compatible; consumers must not generically strip scopes.
- AUTH-INV-004: applies. No JWTs, decoded secrets, service tokens, passwords, OAuth tokens, or production user data may be recorded.
- AUTH-INV-005: applies. SpeakASAP continues to validate Auth-issued tokens rather than minting tokens or hosting login.
- AUTH-INV-006: applies. Review, changes, and validation evidence must be recorded before closure.
- AUTH-INV-007: applies. DocsRAG is available through the Auth pod and must be queried before broad cross-service review.

## Sensitive-Data Handling

Classification: masked.

Allowed evidence: file paths, endpoint names, role-string shapes, environment variable names, service names, commit IDs, and validation command names.

Forbidden evidence: decoded secret values, JWTs, refresh tokens, service tokens, API keys, passwords, OAuth tokens, magic-link tokens, reset tokens, or raw production user data.

## Contract Validation Plan

Contract impact: consumer-side authorization behavior change in SpeakASAP only. No Auth API, JWT payload, token signing, OAuth, magic-link, redirect, CORS, or internal-service behavior changes.

Expected role mapping:

- Preserve unscoped legacy SpeakASAP local roles such as `manager`, `teacher`, `admin`, `staff`, `super_admin`, and `superadmin`.
- Map `app:speakasap:<role>` to the local SpeakASAP role name.
- Map global staff roles such as `global:superadmin` and `global:platform_admin` to manager/staff access where existing policy treats platform staff as authorized.
- Do not map `internal:*` roles or other `app:<other-app>:<role>` roles into SpeakASAP local roles.

## Scope

Allowed SpeakASAP files:

- `/home/ssf/Documents/Github/speakasap/assessment-service/src/auth/normalize-roles.ts`
- `/home/ssf/Documents/Github/speakasap/certification-service/src/auth/roles.ts`

Allowed Auth documentation/state files:

- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- `TASKS.md`
- `STATE.json`

## Non-Goals

- No Auth runtime code changes.
- No Auth JWT claim-shape changes.
- No login, OAuth, magic-link, redirect, CORS, or token-validation endpoint changes.
- No SpeakASAP deployment.
- No production user-data reads or writes.
- No decoded secret, JWT, or token output.
- No change to unrelated active SpeakASAP Goal 5.5 files.

## Validation Plan

- Query DocsRAG from `deployment/auth-microservice` for SpeakASAP RBAC/scoped-role context.
- Inspect narrow SpeakASAP auth/role files.
- Run `npm run build` in `assessment-service`.
- Run `npm run build` in `certification-service`.
- Run compiled helper assertions to prove unrelated scoped roles do not grant local access while `app:speakasap:*` and accepted global staff roles still work.
- Run `git diff --check` in changed Auth and SpeakASAP files.
- Run documentation missing-marker scan for gate-critical Auth docs.
- Run documentation secret-pattern scan.

## Completion Checklist

- [x] Owner selected RBAC-REM-04.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] DocsRAG queried successfully from the Auth pod.
- [x] SpeakASAP role normalization review completed.
- [x] Scoped-role remediation implemented if needed.
- [x] Verification evidence recorded.
- [x] Next remediation chunk named.
