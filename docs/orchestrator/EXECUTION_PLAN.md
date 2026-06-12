# Auth Execution Plan

```yaml
id: AUTH-EXECUTION-PLAN
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: validated
upstream:
  - docs/orchestrator/GOALS.md
  - docs/orchestrator/CONTEXT_PACKAGE.md
  - docs/orchestrator/PROJECT_INVARIANTS.md
downstream:
  - docs/orchestrator/STATUS.md
```

## Selected Goal And Chunk

Goal 06 - RBAC Consuming Services Audit.

Completed chunks:

- 6.1 Query DocsRAG for RBAC and consuming-service contract context: attempted; blocked because `JWT_TOKEN` was not set on the remote shell.
- 6.2 Identify consumers that validate Auth JWTs or roles: completed through remote source scans.
- 6.3 Compare consumer expectations with `docs/UNIFIED_AUTH_CONTRACT.md`: completed in `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- 6.4 Record findings and split remediation into owner-approvable chunks: completed in the remediation backlog.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Backlog and goal source: `TASKS.md`, `docs/orchestrator/GOALS.md`, `implementation-goals/README.md`, `implementation-goals/GOAL-06-rbac-consuming-services-audit.md`
- Contract source: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification source: `docs/UNIFIED_AUTH_VERIFICATION.md`

## Goal Impact

This audit preserves Auth as the role-claim authority by checking whether consumers enforce Auth JWT roles compatibly, duplicate Auth-owned identity behavior, or rely on stale role assumptions.

## Project Invariants

- `AUTH-INV-001`: preserved. Auth remains identity, token, and RBAC role-claim authority.
- `AUTH-INV-002`: preserved. Consumer domain authorization remains in consuming services.
- `AUTH-INV-003`: reviewed. JWT/RBAC contract compatibility is the core audit subject.
- `AUTH-INV-004`: preserved. No secrets, JWTs, service tokens, passwords, or raw production user data were recorded.
- `AUTH-INV-005`: reviewed. Hosted Auth and `/auth/validate` usage were checked where visible.
- `AUTH-INV-006`: preserved. Evidence is recorded in `docs/orchestrator/STATUS.md` and `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- `AUTH-INV-007`: pass-with-exception. DocsRAG could not be queried because no JWT token was available; remote source evidence was used instead.

## Sensitive-Data Handling

Classification: `masked`.

The audit references environment key names, Vault paths, role strings, file paths, and placeholder examples only. It does not include decoded secret values, real JWTs, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or raw production user records.

## Contract Validation Plan

Contract impact: no Auth contract change.

Validated subjects:

- JWT payload role claim shape from `docs/UNIFIED_AUTH_CONTRACT.md` and `src/roles/roles.service.ts`.
- Consumer role checks against `global:*`, `app:*:*`, `internal:*:*`, and app-local roles.
- Direct JWT verification versus `/auth/validate` usage.
- Internal service-token/API-key bypasses as separate consumer-owned service-auth paths.

## Scope

Included files:

- `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `implementation-goals/README.md`
- `implementation-goals/GOAL-06-rbac-consuming-services-audit.md`
- `TASKS.md`
- `STATE.json`

Inspected remote consumer repositories without modification:

- `catalog-microservice`
- `warehouse-microservice`
- `suppliers-microservice`
- `orders-microservice`
- `payments-microservice`
- `notifications-microservice`
- `shop-assistant`
- `runlayer`
- `speakasap`
- `school-committee`
- `logging-microservice`
- `marketing-microservice`
- `leads-microservice`

## Non-Goals

- No consumer-service code changes.
- No Auth runtime code changes.
- No JWT claim-shape changes.
- No production deployment.
- No secret decoding or production user-table reads/writes.

## Validation Plan

- Documentation presence check for the audit report.
- Missing-marker scan over gate-critical docs.
- Secret-pattern scan over docs and task files.
- Review `git diff --check`.

## Completion Checklist

- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] Pre-coding gate passed with DocsRAG exception recorded.
- [x] Audit report complete.
- [x] Verification evidence recorded.
- [x] Next owner-selectable remediation chunks named.
