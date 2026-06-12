# GOAL-01: Admin Token Copy UX And Safety

```yaml
id: GOAL-01
status: done
owner: orchestrator
completed: 2026-06-12
```

## Intent

Auth admin users must be able to copy their access token for cross-service admin work without unnecessary token exposure.

## Scope

- Show Copy Token after admin login.
- Copy from authenticated session storage.
- Keep token masked unless explicitly revealed.
- Preserve URL credential stripping.

## Validation Evidence

See `docs/orchestrator/STATUS.md` under `2026-06-12`.

## Boundary Check

The change stayed within Auth admin token UX and did not move non-Auth ownership into Auth.
