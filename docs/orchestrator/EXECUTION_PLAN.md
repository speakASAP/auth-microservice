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

Owner-approved remediation chunk: RBAC-REM-06 - internal service-token/API-key bypass inventory and Auth boundary review.

Documentation task: inventory consumer machine-auth paths that use static service tokens or API keys, separate them from Auth-issued user JWT/RBAC flows, and record follow-up risks without changing runtime code.

## Upstream Traceability

- Original intent: docs/orchestrator/INTENT.md
- Current state: docs/IMPLEMENTATION_STATE.md
- Audit source: docs/RBAC_CONSUMING_SERVICES_AUDIT.md
- Contract source: docs/UNIFIED_AUTH_CONTRACT.md
- Verification source: docs/UNIFIED_AUTH_VERIFICATION.md
- Operational source: docs/ENV_CORS_AND_AUTH_CHECK.md
- Owner approval: user approved continuing with RBAC-REM-06 on 2026-06-13.

## Goal Impact

This remediation preserves Auth as the identity, JWT, and RBAC role-claim authority while clarifying that static service tokens and API keys are machine-auth credentials, not human user identity and not Auth RBAC role claims.

## Project Invariants

- AUTH-INV-001: applies. Auth remains identity, JWT, and RBAC role-claim authority.
- AUTH-INV-002: applies. Consumer machine-auth mechanisms stay in owning services and are not moved into Auth.
- AUTH-INV-003: applies. No Auth JWT/API contract change; this documents the existing internal-service and consumer-machine-auth boundary.
- AUTH-INV-004: applies. No JWTs, decoded secrets, service tokens, passwords, OAuth tokens, or production user data may be recorded.
- AUTH-INV-005: applies. User flows continue to use Auth-issued tokens; static service tokens remain non-user machine auth.
- AUTH-INV-006: applies. Review and validation evidence must be recorded before closure.
- AUTH-INV-007: applies. DocsRAG must be queried before cross-service contract documentation.

## Sensitive-Data Handling

Classification: masked.

Allowed evidence: file paths, endpoint names, header names, role shapes, environment variable names, service names, commit IDs, and validation command names.

Forbidden evidence: decoded secret values, JWTs, refresh tokens, service tokens, API keys, passwords, OAuth tokens, magic-link tokens, reset tokens, or raw production user data.

## Contract Validation Plan

Contract impact: documentation clarification only. No Auth API, JWT payload, token signing, OAuth, magic-link, redirect, CORS, internal-service, or consumer runtime behavior changes.

Expected documented boundary:

- User requests use Auth-issued access tokens validated through `POST /auth/validate` or the approved shared local verifier exception.
- Static service tokens and API keys authenticate services, scripts, provider callbacks, or smoke checks; they do not represent human users.
- Machine-auth paths may create service actors and service-local permissions but must not be documented as Auth RBAC role assignment.
- New Auth-owned internal endpoints use `x-internal-service-token` plus `x-service-name`.
- Consumer-owned machine-auth paths must document header names, trusted callers, rotation source, and redaction rules.

## Scope

Allowed new Auth documentation files:

- `docs/INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`

Allowed Auth documentation/state files:

- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- `TASKS.md`
- `STATE.json`

Allowed read-only consumer source inspection:

- `/home/ssf/Documents/Github/runlayer`
- `/home/ssf/Documents/Github/notifications-microservice`
- `/home/ssf/Documents/Github/payments-microservice`
- `/home/ssf/Documents/Github/catalog-microservice`
- `/home/ssf/Documents/Github/warehouse-microservice`, receiving-side check only for Catalog availability service-token compatibility.

## Non-Goals

- No Auth runtime code changes.
- No consumer runtime code changes.
- No Auth JWT claim-shape changes.
- No login, OAuth, magic-link, redirect, CORS, or token-validation endpoint changes.
- No deployments.
- No production user-data reads or writes.
- No decoded secret, JWT, API-key, or token output.

## Validation Plan

- Query DocsRAG from deployment/auth-microservice for internal service-auth and machine-auth context.
- Inspect narrow consumer guards, clients, env-key manifests, and docs that mention service-token/API-key machine auth.
- Run git diff --check in changed Auth documentation/state files.
- Run documentation missing-marker scan for gate-critical Auth docs.
- Run documentation secret-pattern scan.

## Completion Checklist

- [x] Owner approved RBAC-REM-06.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] DocsRAG queried successfully from the Auth pod.
- [x] Internal service-token/API-key inventory completed.
- [x] Boundary review and follow-up risks recorded.
- [x] Verification evidence recorded.
- [x] Next remediation chunk named.
