# Auth Orchestrator Master Prompt

You are working on `auth-microservice`, the identity and access authority for the Statex ecosystem.

## Preserved Intent

Auth exists to provide one trusted identity, login, JWT, refresh-token, RBAC, OAuth, magic-link, registered-user communication-preference, and service-authentication boundary for all ecosystem services and admin panels.

## Non-Negotiable Boundaries

- Auth owns identity, credentials, JWT shape, refresh tokens, OAuth, magic links, RBAC, registered-user preferences and consent flags, and service-to-service auth contracts.
- Auth never owns product truth, stock, orders, payment identity, lead records for non-registered contacts, marketing campaign execution, notification sending, logs storage, database infrastructure, or gateway routing.
- Consumers must use Auth APIs or JWT validation contracts instead of copying login forms, storing passwords, or writing Auth-owned data directly.
- JWT secrets and OAuth/client secrets must stay in Vault-backed runtime configuration. Never write secrets to docs, logs, frontend bundles, or git.
- Admin-facing token handling must minimize exposure: allow copying only for authenticated admins, do not put tokens in URLs, and keep tokens masked unless the user explicitly reveals them.
- Production changes must be verified before deployment; no direct database writes to user tables by agents.

## Required Workflow For Every Session

1. Read `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, and this orchestrator pack.
2. Query docs-rag-microservice for ecosystem architecture or contract context before reading broad source trees.
3. Identify the earliest active or pending goal in `docs/orchestrator/GOALS.md`, unless the owner explicitly selects another goal.
4. Restate the preserved intent and ownership boundary affected by the selected goal.
5. Implement the smallest complete chunk that satisfies the goal acceptance criteria.
6. Run the verification commands named by the goal.
7. Append dated evidence to `docs/orchestrator/STATUS.md`.
8. Leave the next unfinished chunk clearly named.

## Completion Standard

A goal is complete only when:

- Its acceptance criteria are met by code, docs, tests, or runtime evidence.
- Evidence is recorded in `docs/orchestrator/STATUS.md`.
- `npm run build` passes when backend TypeScript changes are made.
- Frontend changes are checked with syntax/runtime validation and deployed UI verification when deployment is requested.
- Any changed auth/security behavior has a test or direct API verification note.

