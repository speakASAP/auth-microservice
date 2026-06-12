# Auth Execution Plan

YAML metadata:
- id: AUTH-EXECUTION-PLAN
- status: active
- owner: owner-selected
- created: 2026-06-12
- last_updated: 2026-06-12
- completeness_level: planning
- upstream: docs/RBAC_CONSUMING_SERVICES_AUDIT.md, docs/orchestrator/CONTEXT_PACKAGE.md, docs/orchestrator/PROJECT_INVARIANTS.md
- downstream: docs/orchestrator/STATUS.md

## Selected Goal And Chunk

Owner-selected remediation chunk: RBAC-REM-02 - standardize consumer JWT validation pattern (/auth/validate versus shared local verifier).

Decision task: choose and document the standard Auth JWT validation pattern for consuming services, including when consumers should use the round-trip POST /auth/validate contract and when high-throughput services may use a shared local verifier backed by the centrally sourced Auth verification secret.

Initial affected consumer categories:

- Round-trip validation consumers: shop-assistant, runlayer, speakasap, school-committee, and logging-microservice web admin.
- Direct local verifier consumers: catalog-microservice, warehouse-microservice, suppliers-microservice, orders-microservice, payments-microservice, and notifications-microservice.

## Upstream Traceability

- Original intent: docs/orchestrator/INTENT.md
- Current state: docs/IMPLEMENTATION_STATE.md
- Audit source: docs/RBAC_CONSUMING_SERVICES_AUDIT.md
- Contract source: docs/UNIFIED_AUTH_CONTRACT.md
- Verification source: docs/UNIFIED_AUTH_VERIFICATION.md
- Operational source: docs/ENV_CORS_AND_AUTH_CHECK.md
- Owner selection: user selected RBAC-REM-02 on 2026-06-12.

## Goal Impact

This remediation preserves Auth as the token issuer, token validation authority, and RBAC role-claim authority while reducing drift in consumer-side JWT validation. Consumers continue to own endpoint authorization policy, but validation of Auth-issued user identity must follow one approved pattern.

## Project Invariants

- AUTH-INV-001: applies. Auth remains identity, JWT, and RBAC role-claim authority.
- AUTH-INV-002: applies. Consumer endpoint authorization and service-owned policy stay in consumer services.
- AUTH-INV-003: applies. JWT payload, roles, expiry, algorithm, and validation behavior must remain compatible or include a migration plan.
- AUTH-INV-004: applies. No JWTs, decoded secrets, refresh tokens, service tokens, passwords, OAuth tokens, or production user data may be recorded.
- AUTH-INV-005: applies. Consumers must not mint Auth JWTs or duplicate credential/login flows.
- AUTH-INV-006: applies. The selected pattern and validation evidence must be recorded before closure.
- AUTH-INV-007: pass-with-exception for initial planning. The remote shell has no JWT_TOKEN, so DocsRAG retrieval cannot run yet; compensate with existing Auth contract docs and previously audited remote source evidence until a service JWT is available.

## Sensitive-Data Handling

Classification: masked.

Allowed evidence: file paths, endpoint names, role-string shapes, environment variable names, Vault path names, commit IDs, and validation command names.

Forbidden evidence: decoded secret values, JWTs, refresh tokens, service tokens, API keys, passwords, OAuth tokens, magic-link tokens, reset tokens, or raw production user data.

## Contract Validation Plan

Contract impact: planning and documentation only until the standard is selected. No Auth API, JWT payload, RBAC role string, OAuth, magic-link, redirect, CORS, or internal-service contract change is approved by this selection alone.

Expected standardization output:

- Default pattern for admin panels and lower-throughput APIs: call POST /auth/validate using the in-cluster Auth URL where server-side.
- Allowed high-throughput exception: use a shared internal local verifier package or module only when it validates Auth-issued JWTs consistently, uses centrally sourced Auth verification secret material, rejects unsafe algorithms, honors expiry, and preserves full Auth role strings.
- Prohibited pattern: each service independently hand-rolls JWT verification assumptions or sources verification material from service-owned secret paths.

## Scope

Allowed Auth documentation files for this selection/planning chunk:

- docs/orchestrator/EXECUTION_PLAN.md
- docs/orchestrator/CONTEXT_PACKAGE.md
- docs/orchestrator/STATUS.md
- docs/IMPLEMENTATION_STATE.md
- TASKS.md
- STATE.json

Potential future consumer implementation scope must be selected separately after the standard is documented and validated.

## Non-Goals

- No decoded secret comparison.
- No consumer runtime code changes in this selection chunk.
- No Auth runtime code changes in this selection chunk.
- No JWT claim-shape changes.
- No role-string normalization changes.
- No production deployment.
- No production user-table reads or writes.

## Validation Plan

- Verify required Auth orchestrator and contract docs were read.
- Record DocsRAG unavailable if JWT_TOKEN is absent.
- Run documentation missing-marker scan for gate-critical docs.
- Run documentation secret-pattern scan.
- Run git diff --check for changed documentation files.
- Before any future code change, inspect the target consumer verifier implementation and add service-specific validation commands.

## Completion Checklist

- [x] Owner selected RBAC-REM-02.
- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] Pre-coding gate documented as planning pass-with-exception because DocsRAG token is unavailable.
- [ ] Standard consumer JWT validation decision documented.
- [ ] Any approved consumer implementation chunks split and validated.
- [ ] Verification evidence recorded.
- [ ] Next remediation chunk named.
