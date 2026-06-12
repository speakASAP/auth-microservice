# Auth Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

## Goal 1 - Admin Token Copy UX And Safety

Status: done

Intent: Auth admin users must be able to copy their access token for cross-service admin work without unnecessary token exposure.

Chunks:

- [x] 1.1 Add always-available Copy Token button in the admin access-token section.
- [x] 1.2 Copy from authenticated session storage instead of requiring the token to be revealed.
- [x] 1.3 Verify deployed admin UI can copy the token and still strips token-like URL parameters.

Acceptance criteria:

- `/admin` shows a Copy Token button after login.
- Copy writes the current access token to the clipboard.
- Token remains masked unless the user clicks Show Token.
- URL credential stripping remains in place for `token`, `accessToken`, and `refreshToken`.

## Goal 2 - Auth Intent Preservation Pack

Status: done

Intent: Auth must have a durable local workflow for future development that preserves ecosystem ownership boundaries.

Chunks:

- [x] 2.1 Add orchestrator pack files under `docs/orchestrator/`.
- [x] 2.2 Update `AGENTS.md` so future agents follow the pack.
- [x] 2.3 Deploy or ingest docs into docs-rag-microservice after repository changes are accepted.

Acceptance criteria:

- `MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, and `PROMPTS.md` exist.
- The pack names Auth ownership and non-ownership boundaries.
- The workflow includes planning stages, goal selection, coordinator status, verification, and next-task reporting.
- DocsRAG usage is documented as mandatory before broad architecture work.

## Goal 3 - Unified Auth Contract Recovery

Status: done

Intent: Auth contract docs indexed in DocsRAG must be restored or reconciled with the live repo.

Chunks:

- [x] Locate historical `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, and `docs/agents/*` from DocsRAG snapshot or git history.
- [x] Restore current contract docs if they are still authoritative, or document what replaced them.
- [x] Verify login, refresh, validate, OAuth, magic-link, redirect, CORS, and RBAC contract sections.

Acceptance criteria:

- Future agents can find current auth contracts in the repo.
- Stale DocsRAG references are either restored or superseded explicitly.
- No secrets are introduced.

## Goal 4 - Auth Observability And Safety Checks

Status: pending

Intent: Auth-sensitive flows must be observable without leaking credentials.

Chunks:

- Review logs for login, refresh, password reset, magic link, OAuth, admin user management, and role changes.
- Add missing structured metadata where safe.
- Add regression checks that logs do not include passwords, JWTs, reset tokens, magic-link tokens, OAuth tokens, or secrets.

Acceptance criteria:

- Auth events include service, operation, identifier, outcome, and duration where appropriate.
- Sensitive values are redacted or absent.
- Verification evidence is recorded.
