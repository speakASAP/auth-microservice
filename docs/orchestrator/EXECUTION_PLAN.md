# Auth Execution Plan

```yaml
id: AUTH-EXECUTION-PLAN
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: validated
upstream:
  - docs/RBAC_CONSUMING_SERVICES_AUDIT.md
  - docs/orchestrator/CONTEXT_PACKAGE.md
  - docs/orchestrator/PROJECT_INVARIANTS.md
downstream:
  - docs/orchestrator/STATUS.md
```

## Selected Goal And Chunk

Owner-selected remediation chunk: `RBAC-REM-01` - secret-source alignment review for direct JWT consumers.

Target consumers:

- `catalog-microservice`
- `warehouse-microservice`
- `suppliers-microservice`
- `orders-microservice`
- `payments-microservice`

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Audit source: `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- Contract source: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification source: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational source: `docs/ENV_CORS_AND_AUTH_CHECK.md`

## Goal Impact

This remediation keeps Auth as the JWT signing and RBAC role-claim authority while allowing direct JWT consumers to keep local verification. The consumer environment variable remains `JWT_SECRET`, but the ExternalSecret source path now points to Auth's Vault path for that verification secret.

## Project Invariants

- `AUTH-INV-001`: preserved. Auth remains token and RBAC role-claim authority.
- `AUTH-INV-002`: preserved. Consumer enforcement and service-owned secrets remain in their services.
- `AUTH-INV-003`: preserved. JWT shape and role claims are unchanged.
- `AUTH-INV-004`: preserved. No secret values, JWTs, tokens, passwords, or production user data were printed, decoded, or recorded.
- `AUTH-INV-005`: not changed. Hosted Auth flows are unaffected.
- `AUTH-INV-006`: preserved. Evidence is recorded in `docs/orchestrator/STATUS.md` and `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- `AUTH-INV-007`: pass-with-exception. DocsRAG could not be queried because `JWT_TOKEN` was absent in the remote shell; compensating evidence came from remote source manifests and value-safe Kubernetes metadata checks.

## Sensitive-Data Handling

Classification: `masked`.

Allowed evidence: key names, Vault path names, ExternalSecret source references, file paths, commit IDs, and validation command names.

Forbidden evidence: decoded secret values, JWTs, refresh tokens, service tokens, API keys, passwords, OAuth tokens, magic-link tokens, reset tokens, or raw production user data.

## Contract Validation Plan

Contract impact: no Auth API, JWT payload, RBAC role string, OAuth, magic-link, redirect, CORS, or internal-service contract change.

Consumer manifest impact: direct JWT consumers now source `JWT_SECRET` from `secret/prod/auth-microservice`, matching the positive `notifications-microservice` pattern.

## Scope

Changed consumer files:

- `catalog-microservice/k8s/external-secret.yaml`
- `warehouse-microservice/k8s/external-secret.yaml`
- `suppliers-microservice/k8s/external-secret.yaml`
- `orders-microservice/k8s/external-secret.yaml`
- `payments-microservice/k8s/external-secret.yaml`

Changed Auth documentation files:

- `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `TASKS.md`
- `STATE.json`

## Non-Goals

- No decoded secret comparison.
- No consumer runtime code changes.
- No Auth runtime code changes.
- No JWT claim-shape changes.
- No production deployment.
- No production user-table reads or writes.

## Validation Plan

- Check live ExternalSecret `JWT_SECRET` source metadata without printing values.
- Check live Kubernetes Secret key names without decoding values.
- Run `kubectl apply --dry-run=server -f k8s/external-secret.yaml` for each target manifest.
- Run `git diff --check -- k8s/external-secret.yaml` for each target manifest.
- Verify staged diffs include only the intended `JWT_SECRET` source-path hunk.
- Run Auth documentation missing-marker, secret-pattern, and diff checks.

## Completion Checklist

- [x] Selected goal and chunk named.
- [x] Intent and boundary impact stated.
- [x] Context package reviewed.
- [x] Invariants evaluated.
- [x] Sensitive-data classification stated.
- [x] Contract impact stated.
- [x] Validation plan stated.
- [x] Pre-coding gate passed with DocsRAG exception recorded.
- [x] Consumer manifests remediated and committed.
- [x] Verification evidence recorded.
- [x] Next remediation chunk named.
