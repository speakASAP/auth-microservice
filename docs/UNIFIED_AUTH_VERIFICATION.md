# Unified Auth Verification

Use this checklist when validating the current `docs/UNIFIED_AUTH_CONTRACT.md`.

## Static Checks

```bash
npm run build
node --check web/public/js/admin.js
```

## Public Reachability

```bash
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/login
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/register
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin
```

## Contract Coverage

Verify these sections against source before changing Auth behavior:

- Email/password login and registration: `POST /auth/login`, `POST /auth/register`
- Token validation and refresh: `POST /auth/validate`, `POST /auth/refresh`
- JWT payload: `sub`, `email`, `type`, `roles`, optional `auth_method`, `iat`, `exp`
- OAuth init/callback: `GET /auth/oauth/:provider`, `GET /auth/oauth/callback/:provider`
- Magic-link request/verify: `POST /auth/magic-link/request`, `GET /auth/magic-link/verify`
- Redirect allowlist: `AUTH_ALLOWED_REDIRECT_ORIGINS`
- CORS: `CORS_ORIGIN`
- RBAC enforcement: centralized roles and `roles` token claim
- First-visit application access: successful hosted flows with configured `client_id` assign `app:<client_id>:user` before token signing; unknown apps, missing default roles, domain mismatch, and expired assignments fail closed
- Internal routes each enforce a per-pair Auth-issued RS256 credential carrying a
  least-privilege role, per
  [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](SERVICE_IDENTITY_CONSUMER_STANDARD.md).
  Verify by effect, not by the presence of a guard class: a credential holding one
  route's role must be refused on the others with `Principal lacks the required
  role`. In particular `magic-link/token` must reject an `email-check`
  credential — it can mint a user session.
- The legacy shared-secret path (`INTERNAL_SERVICE_TOKEN` plus a self-asserted
  `x-service-name`) is still accepted while the last callers migrate, and logs a
  WARN on every acceptance. Treat that log, not `exp` and not a synced Secret, as
  the signal for whether `ALLOW_INTERNAL_STATIC_TOKEN=false` can be set. Do not
  extend that path to new routes or callers.

## First-Visit Application Access

Use synthetic tests or an owner-approved runtime packet to verify:

- `client_id` matches an active registered application name.
- The application has an active application-scoped `user` role.
- The successful token contains `app:<client_id>:user` in `roles`.
- A second login is idempotent and does not duplicate `user_roles`.
- Missing app, inactive app, missing role, domain mismatch, and expired assignment do not issue tokens.
- Output never includes JWT values, refresh tokens, raw user rows, or secrets.

## Redirect Safety

For every redirect-based flow:

- Use HTTPS `return_url`.
- Confirm allowed origins are configured in production.
- Confirm returned tokens are placed in the URL fragment, not query parameters.
- Confirm callers validate `state` when they provide it.

## Secret Safety

Verification output must not include:

- Passwords
- JWTs
- Refresh tokens
- Password reset tokens
- Magic-link tokens
- OAuth access tokens
- OAuth client secrets
- JWT or internal service secrets

## DocsRAG Reconciliation

Historical DocsRAG references to `docs/agents/*` should resolve to supersession notes. Current implementation instructions are in `docs/orchestrator/`; current integration contract is `docs/UNIFIED_AUTH_CONTRACT.md`.
