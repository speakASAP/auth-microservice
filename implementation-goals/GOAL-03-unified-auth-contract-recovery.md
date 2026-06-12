# GOAL-03: Unified Auth Contract Recovery

```yaml
id: GOAL-03
status: done
owner: orchestrator
completed: 2026-06-12
```

## Intent

Auth contract docs indexed in DocsRAG must be restored or reconciled with the live repo.

## Scope

- Restore or supersede historical contract docs.
- Verify login, refresh, validate, OAuth, magic-link, redirect, CORS, and RBAC contract sections.
- Avoid introducing secrets.

## Validation Evidence

See `docs/orchestrator/STATUS.md` under `2026-06-12 - Goal 3 Contract Recovery`.

## Boundary Check

The restored docs describe Auth APIs and consumer responsibilities without moving consumer-service ownership into Auth.
