# Auth Context Package

```yaml
id: AUTH-CONTEXT-PACKAGE
status: validated-pending-deploy
owner: owner-reported-production-defect
created: 2026-06-26
last_updated: 2026-06-26
completeness_level: bounded
upstream:
  - user production report
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/PROJECT_INVARIANTS.md
downstream:
  - docs/orchestrator/EXECUTION_PLAN.md
  - docs/orchestrator/STATUS.md
```

## Target Task

Fix the owner-reported Auth production defect where password reset emails link to `/reset-password?token=...`, but the hosted Auth service does not serve `GET /reset-password`.

## Upstream Traceability

- Original Auth intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md` and `STATE.json` mark the project frozen, with owner-selected operational defects still eligible as bounded fixes.
- Auth contract surface: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification standard: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational environment: `docs/ENV_CORS_AND_AUTH_CHECK.md`
- Readiness checks: `docs/orchestrator/READINESS_GATES.md`

## Included Documents

Read before editing:

- `AGENTS.md`
- `TASKS.md`
- `STATE.json`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/ENV_CORS_AND_AUTH_CHECK.md`
- `docs/UNIFIED_AUTH_VERIFICATION.md`
- `docs/orchestrator/MASTER_PROMPT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/PROMPTS.md`
- `docs/orchestrator/PROJECT_INVARIANTS.md`
- `docs/orchestrator/PRE_CODING_GATE.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/READINESS_GATES.md`
- `implementation-goals/README.md`

## Included Source

- `src/auth/auth.service.ts` for reset email URL generation and confirm endpoint behavior.
- `src/auth/auth.controller.ts` for password reset endpoint ownership.
- `src/main.ts` and `web/server.js` for hosted route serving.
- `web/public/index.html` for hosted Auth UI behavior.
- `src/auth/hosted-auth-web.spec.ts` for focused regression coverage.

## Excluded Documents And Data

Do not read, print, or record:

- Real password reset tokens from emails, logs, database rows, or URLs.
- Decoded Vault or Kubernetes secret values.
- JWTs, refresh tokens, OAuth tokens, magic-link tokens, internal-service tokens, API keys, passwords, or Authorization header values.
- Raw production user records or production logs containing user data.
- Consumer-service source trees.

## Auth Constraints

- Keep Auth as the identity, credential, and password reset authority.
- Do not change token generation, hashing, expiry, storage, confirmation semantics, JWT shape, RBAC, OAuth, magic-link, CORS, redirect allowlists, or internal-service contracts.
- Do not deploy without owner approval.

## Allowed Changes

- Add hosted route serving for `/reset-password`.
- Add reset-password mode to the existing hosted Auth page.
- Add focused tests and update Auth documentation/state evidence.

## Forbidden Changes

- Production database writes outside the existing user-driven reset-confirm API.
- Secret material, decoded runtime config, production user-data reads, or real reset-token evidence.
- Consumer-service code or gateway ownership changes.
