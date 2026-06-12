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
- Internal registered-user preferences APIs protected by `InternalServiceGuard`

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
