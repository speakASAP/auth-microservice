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

Owner-selected remediation chunk: RBAC-REM-05 - School Committee local-role contract note.

Documentation task: add a concise School Committee contract note that separates Auth identity/JWT validation from School Committee local school authorization, local roles, and approval workflow.

## Upstream Traceability

- Original intent: docs/orchestrator/INTENT.md
- Current state: docs/IMPLEMENTATION_STATE.md
- Audit source: docs/RBAC_CONSUMING_SERVICES_AUDIT.md
- Contract source: docs/UNIFIED_AUTH_CONTRACT.md
- Verification source: docs/UNIFIED_AUTH_VERIFICATION.md
- Operational source: docs/ENV_CORS_AND_AUTH_CHECK.md
- Owner selection: user selected RBAC-REM-05 on 2026-06-13.

## Goal Impact

This remediation preserves Auth as the identity, JWT, and RBAC role-claim authority while making clear that School Committee owns its tenant/school authorization model after Auth validates identity.

School Committee local roles and profile approval state are domain authorization data, not Auth RBAC role-assignment data.

## Project Invariants

- AUTH-INV-001: applies. Auth remains identity, JWT, and RBAC role-claim authority.
- AUTH-INV-002: applies. School Committee school-domain roles, tenant/school scoping, and approval workflow stay outside Auth.
- AUTH-INV-003: applies. No Auth JWT/API contract change; this documents the existing consumer boundary.
- AUTH-INV-004: applies. No JWTs, decoded secrets, service tokens, passwords, OAuth tokens, or production user data may be recorded.
- AUTH-INV-005: applies. School Committee continues to validate Auth-issued tokens through Auth rather than minting local Auth tokens or hosting independent credentials.
- AUTH-INV-006: applies. Review and validation evidence must be recorded before closure.
- AUTH-INV-007: applies. DocsRAG must be queried before cross-service contract documentation.

## Sensitive-Data Handling

Classification: none.

Allowed evidence: file paths, endpoint names, role names, environment variable names, table names, service names, commit IDs, and validation command names.

Forbidden evidence: decoded secret values, JWTs, refresh tokens, service tokens, API keys, passwords, OAuth tokens, magic-link tokens, reset tokens, or raw production user data.

## Contract Validation Plan

Contract impact: documentation clarification only. No Auth API, JWT payload, token signing, OAuth, magic-link, redirect, CORS, internal-service, or School Committee runtime behavior changes.

Expected documented boundary:

- Auth validates identity and remains responsible for login, JWT issuance, refresh, password reset, and global/application RBAC claims.
- School Committee validates Auth-issued access tokens through POST /auth/validate.
- School Committee owns local school roles such as parent, committee, teacher, school_staff, and admin.
- School Committee owns profile approval state and school-specific access workflows.
- Local School Committee roles must not be described as Auth RBAC enforcement.

## Scope

Allowed School Committee documentation files:

- /home/ssf/Documents/Github/school-committee/README.md

Allowed Auth documentation/state files:

- docs/orchestrator/EXECUTION_PLAN.md
- docs/orchestrator/CONTEXT_PACKAGE.md
- docs/orchestrator/STATUS.md
- docs/IMPLEMENTATION_STATE.md
- docs/RBAC_CONSUMING_SERVICES_AUDIT.md
- TASKS.md
- STATE.json

## Non-Goals

- No Auth runtime code changes.
- No School Committee runtime code changes.
- No Auth JWT claim-shape changes.
- No login, OAuth, magic-link, redirect, CORS, or token-validation endpoint changes.
- No School Committee deployment.
- No production user-data reads or writes.
- No decoded secret, JWT, or token output.

## Validation Plan

- Query DocsRAG from deployment/auth-microservice for School Committee/Auth integration context.
- Inspect narrow School Committee auth/local-role files.
- Run git diff --check in changed Auth and School Committee files.
- Run documentation missing-marker scan for gate-critical Auth docs.
- Run documentation secret-pattern scan.
- Run npm run type-check in School Committee when documentation-only dependencies permit it; otherwise record the blocker.

## Completion Checklist

- [x] Owner selected RBAC-REM-05.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] DocsRAG queried successfully from the Auth pod.
- [x] School Committee contract note added.
- [x] Verification evidence recorded.
- [x] Next remediation chunk named.
