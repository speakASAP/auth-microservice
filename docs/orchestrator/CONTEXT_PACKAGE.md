# Auth Context Package

```yaml
id: AUTH-CONTEXT-PACKAGE
status: validated
owner: owner-selected-reset-password-ux-fix
created: 2026-06-28
last_updated: 2026-06-28
completeness_level: bounded
upstream:
  - user production request
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/PROJECT_INVARIANTS.md
downstream:
  - docs/orchestrator/EXECUTION_PLAN.md
  - docs/orchestrator/STATUS.md
```

## Target Task

Fix hosted `/reset-password` UX after a successful password reset: hide the new-password and confirm-new-password fields after success, and prevent the reset page's `Back to login` link from producing the immediate `Missing required query parameter: return_url` error.

## Upstream Traceability

- Original Auth intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Auth contract surface: `docs/UNIFIED_AUTH_CONTRACT.md`
- Hosted reset route evidence: `docs/orchestrator/STATUS.md`
- Verification standard: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational environment: `docs/ENV_CORS_AND_AUTH_CHECK.md`
- Readiness checks: `docs/orchestrator/READINESS_GATES.md`
- DocsRAG: not required because this is a narrow hosted UI defect with no ecosystem architecture or cross-service contract decision.

## Included Documents

- `AGENTS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/PROJECT_INVARIANTS.md`
- `docs/orchestrator/PRE_CODING_GATE.md`
- `docs/orchestrator/READINESS_GATES.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`

## Included Source

- `web/public/index.html` for hosted login/register/reset UI behavior.
- `src/auth/hosted-auth-web.spec.ts` for hosted reset/login UI contract checks.

## Excluded Documents And Data

Do not read, print, or record:

- Decoded Vault or Kubernetes secret values.
- JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, internal-service tokens, API keys, passwords, or Authorization header values.
- Raw production user records or production logs containing user data.
- Consumer-service source trees.

## Auth Constraints

- Keep Auth as the identity, credential, hosted login, hosted password reset, and token handoff authority.
- Do not change password reset token generation, validation, expiration, persistence, or email sending.
- Do not change JWT payloads, refresh tokens, OAuth, magic links, RBAC, CORS, internal-service contracts, database schema, redirect allowlist, or consumer-service behavior.
- Do not deploy to production without owner approval.

## Allowed Changes

- Hide password input rows after successful hosted password reset confirmation.
- Preserve `return_url`, `client_id`, and `state` on the reset page's `Back to login` link when those parameters exist.
- Avoid displaying an immediate missing-`return_url` error on a plain `/login` page load.
- Update focused hosted web tests and orchestrator status docs.

## Forbidden Changes

- Reset-token or password-confirm API behavior changes.
- Secret material, decoded runtime config, raw production user-data dumps, or token evidence.
- JWT, RBAC, OAuth, magic-link, CORS, internal-service, database, or consumer-service contract changes.
