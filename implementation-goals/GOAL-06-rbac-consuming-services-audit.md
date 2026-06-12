# GOAL-06: RBAC Consuming Services Audit

```yaml
id: GOAL-06
status: done
owner: owner-selected
depends_on:
  - GOAL-03
  - GOAL-04
  - GOAL-05
```

## Intent

Audit RBAC role usage across consuming services so Auth remains the role authority and consumers enforce compatible claims without duplicating Auth-owned identity logic.

## Scope

- Query DocsRAG for current RBAC and consumer-service contract context.
- Identify consuming services and admin panels that validate Auth JWTs or roles.
- Compare consumer expectations against `docs/UNIFIED_AUTH_CONTRACT.md`.
- Record incompatibilities, duplicated role ownership, stale assumptions, and missing validation.
- Propose narrow remediation tasks without implementing cross-service changes unless explicitly approved.

## Non-Goals

- Do not change consumer-service code without owner approval.
- Do not change JWT claim shape without explicit compatibility planning.
- Do not move consumer authorization policy storage into Auth unless already Auth-owned.
- Do not read or write production user tables.
- Do not expose JWTs, passwords, OAuth tokens, reset tokens, or service credentials.

## Files To Inspect First

- `TASKS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/STATUS.md`

## Required DocsRAG Query

```json
{"query":"auth-microservice RBAC roles consuming services JWT validation admin panels role claims Statex ecosystem","maxTokens":3000}
```

## Acceptance Criteria

- A written RBAC audit report names every service or panel inspected.
- Findings distinguish Auth-owned role assignment and consumer-owned enforcement.
- JWT/RBAC compatibility risks are listed with evidence.
- Secret-safety and no-production-user-write constraints are explicitly checked.
- Next remediation goals are split into small owner-approvable chunks.

## Validation Plan

- Verify report links to inspected sources or DocsRAG headings.
- Verify no secrets or tokens are recorded.
- Update `docs/IMPLEMENTATION_STATE.md` and `docs/orchestrator/STATUS.md`.
