# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: done
- owner: owner-approved
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: validated
- upstream: docs/RBAC_CONSUMING_SERVICES_AUDIT.md, docs/orchestrator/CONTEXT_PACKAGE.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-approved remediation chunk: RBAC-REM-07 - Logging admin role-enforcement verification.

Implementation task: verify Logging admin read endpoints enforce Auth roles and add a narrow guard if absent. Preserve public log ingestion compatibility while requiring an Auth-issued admin role for privileged log query/admin surfaces.

## Upstream Traceability

- Original intent: docs/orchestrator/INTENT.md
- Current state: docs/IMPLEMENTATION_STATE.md
- Audit source: docs/RBAC_CONSUMING_SERVICES_AUDIT.md
- Contract source: docs/UNIFIED_AUTH_CONTRACT.md
- Verification source: docs/UNIFIED_AUTH_VERIFICATION.md
- Operational source: docs/ENV_CORS_AND_AUTH_CHECK.md
- Owner approval: user requested continuing with RBAC-REM-07 on 2026-06-13.

## Goal Impact

This remediation preserves Auth as the identity, JWT, and RBAC role-claim authority by making Logging admin reads depend on Auth token validation plus explicit admin roles, while leaving Logging ownership of log storage and ingestion unchanged.

## Project Invariants

- AUTH-INV-001: applies. Auth remains identity, JWT, and RBAC role-claim authority.
- AUTH-INV-002: applies. Logging remains the log-storage owner; Auth does not take over logging storage or querying.
- AUTH-INV-003: applies. No Auth JWT/API contract change; Logging consumes `POST /auth/validate` and Auth role strings.
- AUTH-INV-004: applies. No JWTs, decoded secrets, service tokens, passwords, OAuth tokens, or production user data may be recorded.
- AUTH-INV-005: applies. Logging admin authentication continues to use Auth-issued tokens.
- AUTH-INV-006: applies. Review and validation evidence must be recorded before closure.
- AUTH-INV-007: applies. DocsRAG must be queried before cross-service contract implementation.

## Sensitive-Data Handling

Classification: masked.

Allowed evidence: file paths, endpoint names, header names, role shapes, environment variable names, service names, commit IDs, and validation command names.

Forbidden evidence: decoded secret values, JWTs, refresh tokens, service tokens, API keys, passwords, OAuth tokens, magic-link tokens, reset tokens, or raw production user data.

## Contract Validation Plan

Contract impact: Logging consumer behavior changes for admin read endpoints only. No Auth API, JWT payload, token signing, OAuth, magic-link, redirect, CORS, or internal-service behavior changes.

Expected enforced boundary:

- Logging admin read requests send an Auth-issued access token in `Authorization: Bearer ...`.
- Logging validates the token through `POST /auth/validate` using `AUTH_SERVICE_URL`.
- Privileged log query/service listing requires one of `global:superadmin`, `app:logging-microservice:admin`, or `internal:logging-microservice:admin`.
- Public/service log ingestion remains unchanged to avoid ecosystem-wide logging breakage.

## Scope

Allowed Auth documentation/state files:

- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- `TASKS.md`
- `STATE.json`

Allowed Logging source changes when verification proves the guard is absent:

- `/home/ssf/Documents/Github/logging-microservice/src/logs/logs.controller.ts`
- `/home/ssf/Documents/Github/logging-microservice/src/auth/*`
- `/home/ssf/Documents/Github/logging-microservice/web/js/auth.js`
- `/home/ssf/Documents/Github/logging-microservice/web/js/admin.js`

## Non-Goals

- No Auth runtime code changes.
- No Auth JWT claim-shape changes.
- No login, OAuth, magic-link, redirect, CORS, or token-validation endpoint changes.
- No deployments.
- No production user-data reads or writes.
- No decoded secret, JWT, API-key, or token output.
- No changes to public/service log ingestion unless owner-approved separately.

## Validation Plan

- Query DocsRAG from deployment/auth-microservice for Logging admin RBAC context.
- Inspect Logging admin frontend auth and backend log-query endpoints.
- If guard is absent, add a narrow backend guard and frontend role check.
- Run `npm run build` in `logging-microservice`.
- Run syntax checks for changed frontend JS.
- Run `git diff --check` in changed Auth documentation/state files.
- Run `git diff --check` in changed Logging files.
- Run documentation missing-marker scan for gate-critical Auth docs.
- Run documentation secret-pattern scan.

## Completion Checklist

- [x] Owner approved RBAC-REM-07.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] DocsRAG queried successfully from the Auth pod.
- [x] Logging admin role-enforcement verified and remediated.
- [x] Verification evidence recorded.
- [x] Next remediation chunk named.
