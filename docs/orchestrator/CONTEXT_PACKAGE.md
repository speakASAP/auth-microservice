# Auth Context Package

```yaml
id: AUTH-CONTEXT-PACKAGE
status: validated
owner: owner-selected-admin-users-enhancement
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

Add Auth admin Users search and filters on `/admin`, including filtering users by application, viewing all application admins grouped by application, and showing each listed user's application admin assignments.

## Upstream Traceability

- Original Auth intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md` and `STATE.json` mark the project frozen, with owner-selected operational fixes and enhancements eligible as bounded work.
- Auth contract surface: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification standard: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational environment: `docs/ENV_CORS_AND_AUTH_CHECK.md`
- Readiness checks: `docs/orchestrator/READINESS_GATES.md`
- DocsRAG: queried from the Auth pod for `Auth admin users page search filters application users admin dashboard`; returned HTTP 200 with no matching source headings.

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

- `src/auth/admin-users.controller.ts` for admin user list query parameters and the application-admins API.
- `src/users/users.service.ts` for admin list filtering, application summaries, and application-admin grouping.
- `web/public/admin.html` for admin Users filters and the Application admins section.
- `web/public/js/admin.js` for filter state, API requests, application select population, and admin-app rendering.
- `web/public/css/style.css` for filter and badge layout.

## Excluded Documents And Data

Do not read, print, or record:

- Decoded Vault or Kubernetes secret values.
- JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, internal-service tokens, API keys, passwords, or Authorization header values.
- Raw production user records or production logs containing user data.
- Consumer-service source trees.

## Auth Constraints

- Keep Auth as the identity, RBAC, user-role, and application-role authority.
- Do not change login, registration, JWT payloads, refresh tokens, OAuth, magic links, password reset, CORS, internal-service contracts, database schema, or consumer-service behavior.
- Do not deploy to production without owner approval.

## Allowed Changes

- Add server-side admin user search and filters for search text, application, status, verification, and application-admin-only.
- Add an Auth-admin-only overview of application-scoped admin assignments across registered applications.
- Add user-list columns summarizing application access and application admin roles.
- Update admin static asset version and documentation state.

## Forbidden Changes

- Production database writes or role mutations.
- Secret material, decoded runtime config, raw production user-data dumps, or token evidence.
- JWT/RBAC contract changes beyond read-only admin reporting.
- Consumer-service code or gateway ownership changes.
