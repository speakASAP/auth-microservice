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
- Internal registered-user preferences APIs are reachable only by an authenticated
  caller. **Known non-conformance:** they are currently protected by
  `InternalServiceGuard`, which checks a static shared `INTERNAL_SERVICE_TOKEN`
  plus a self-asserted `x-service-name` header against `TRUSTED_INTERNAL_SERVICES`.
  Both are prohibited by
  [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](SERVICE_IDENTITY_CONSUMER_STANDARD.md),
  which requires one Auth-issued RS256 credential per `(caller -> target)` pair.
  Verifying that this guard is present is **not** a pass for service identity —
  record it as outstanding drift to repair, and do not extend it to new routes or
  new callers.

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
