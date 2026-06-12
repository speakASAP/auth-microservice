# Unified Auth Contract

This document is the current Auth contract for applications and services that integrate with `auth-microservice`.

Historical DocsRAG snapshots may reference older Phase 0/Sync A agent prompts. Those prompts are superseded by the orchestrator pack in `docs/orchestrator/`, but this contract path remains authoritative for endpoint, JWT, redirect, CORS, OAuth, magic-link, and RBAC behavior.

## Ownership Boundary

Auth owns identity, credentials, JWT shape, refresh tokens, OAuth, magic links, RBAC role claims, registered-user communication preferences, consent flags, and service-authentication boundaries.

Auth does not own product truth, stock, orders, payments, lead records for non-registered contacts, marketing campaign execution, notification sending, logs storage, database infrastructure, or gateway routing.

## Hosted Entry Points

Production frontend base URL: `https://auth.alfares.cz`

Applications should send users to Auth-hosted UI rather than hosting their own credential forms:

- `GET /login`
- `GET /register`
- `GET /admin` for authenticated admin access

Supported auth-flow query parameters:

- `return_url`: absolute HTTPS URL to return to after OAuth or magic-link authentication.
- `client_id`: optional logical caller ID for logging/client-specific behavior.
- `state`: optional opaque caller state. Callers must validate it when returned.

The backend serves `/login` and `/register` from `web/public/index.html`.

## Core API Endpoints

All JSON endpoints are under `/auth`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an email/password user and return tokens. |
| `POST` | `/auth/login` | Authenticate email/password credentials and return tokens. |
| `POST` | `/auth/validate` | Validate an access token. |
| `POST` | `/auth/refresh` | Exchange a valid refresh token for a new token pair. |
| `GET` | `/auth/profile` | Return the authenticated JWT user. Requires bearer auth. |
| `POST` | `/auth/password-reset-request` | Create a password-reset token and request notification delivery. |
| `POST` | `/auth/password-reset-confirm` | Consume a password-reset token and set a new password. |
| `POST` | `/auth/password-change` | Change password for the authenticated user. Requires bearer auth. |
| `POST` | `/auth/password-set` | Set the first password for an authenticated passwordless user. Requires bearer auth. |
| `POST` | `/auth/register-contact` | Register or update a contact-based user profile. |
| `POST` | `/auth/login-contact` | Contact-based login. Returns a session ID, not a JWT. |
| `GET` | `/auth/validate-return-url` | Validate a candidate `return_url`. |

Email/password `register` and `login` responses include:

```json
{
  "user": {},
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

`POST /auth/validate` accepts:

```json
{ "token": "jwt" }
```

and returns:

```json
{ "valid": true, "user": {} }
```

`POST /auth/refresh` accepts:

```json
{ "refreshToken": "jwt" }
```

and returns a new `accessToken` and `refreshToken`.

## JWT Contract

Auth signs JWTs with the runtime `JWT_SECRET`. Secrets must stay in Vault-backed runtime configuration and must not be written to docs, logs, frontend bundles, URLs, or git.

Current token payload includes:

- `sub`: Auth user ID.
- `email`: primary email address.
- `type`: user type, defaulting to `end_user`.
- `roles`: role strings from centralized RBAC.
- `auth_method`: included when known, such as `password`, `magic_link`, `google`, or `facebook`.
- Standard JWT fields from Nest JWT signing, including `iat` and `exp`.

Current defaults:

- `JWT_EXPIRES_IN` defaults to `7d`.
- `JWT_REFRESH_EXPIRES_IN` defaults to `30d`.

Consumers send access tokens with:

```http
Authorization: Bearer <accessToken>
```

Services may enforce roles locally, but Auth remains the authority for role assignment and role claims.

## Consumer Token Validation Standard

Consumers validate Auth-issued access tokens through one of two approved patterns. The default pattern is a server-side call to `POST /auth/validate`, which verifies the token with Auth and returns the current Auth user plus Auth-owned roles.

A backend service may use local JWT verification only as a high-throughput exception when it follows `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`: verification material must come from the Auth secret source, expiry and signature validation must be enforced, unsafe algorithms must be rejected, and full Auth role strings must be preserved. Local verification does not make the consumer an Auth token issuer or RBAC role authority.

Consumers must not mint Auth JWTs locally, validate user tokens with service-owned signing secrets, strip Auth role scopes as a generic rule, or treat static service tokens/API keys as user identity.

## OAuth Contract

OAuth providers are initiated only through Auth:

- `GET /auth/oauth/google`
- `GET /auth/oauth/facebook`
- `GET /auth/oauth/callback/google`
- `GET /auth/oauth/callback/facebook`

OAuth init accepts `return_url`, optional `client_id`, and optional caller `state`.

Provider support currently implemented in code:

| Provider | Scope | Required runtime keys |
| --- | --- | --- |
| Google | `openid email profile` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Facebook | `email` | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |

Callback redirect URI is computed as:

```text
https://${DOMAIN}/auth/oauth/callback/${provider}
```

OAuth success redirects to the validated return URL with fragment handoff:

```text
return_url#access_token=<JWT>&refresh_token=<JWT>&expires_at=<ISO>&state=<state>&auth_method=<provider>
```

Applications never talk to OAuth providers directly.

## Magic-Link Contract

Public passwordless flow:

- `POST /auth/magic-link/request`
- `GET /auth/magic-link/verify`

Request body:

```json
{
  "email": "user@example.com",
  "return_url": "https://app.alfares.cz/auth/callback",
  "client_id": "optional-app-id",
  "state": "optional-opaque-state",
  "app_domain": "optional-display-domain"
}
```

Verification accepts:

- `token`: required single-use token.
- `return_url`: optional override, validated before redirect.

On success, Auth redirects with the same fragment handoff format as OAuth, with `auth_method=magic_link`.

Runtime defaults:

- `AUTH_MAGIC_LINK_TTL_MINUTES`: defaults to `15`.
- `AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP`: defaults to `20`.
- `AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL`: defaults to `10`.
- `AUTH_RATE_LIMIT_WINDOW_MS`: defaults to 15 minutes.

Internal trusted-service helper:

- `POST /auth/internal/magic-link/token`

This endpoint creates a magic-link verify URL for a trusted service and is protected by the internal service headers documented below.

## Redirect Allowlist

All flows using `return_url` use the same validation:

- `return_url` must parse as an absolute URL.
- Protocol must be `https:`.
- If `AUTH_ALLOWED_REDIRECT_ORIGINS` is non-empty, the URL origin must match an allowed origin.
- Entries starting with `*.` allow subdomain suffixes.

If the allowlist is empty, current code allows any HTTPS URL. Production should keep `AUTH_ALLOWED_REDIRECT_ORIGINS` populated from Vault/K8s config.

Auth must not redirect to untrusted URLs with tokens or user data.

## CORS Contract

CORS is configured separately from redirect validation through `CORS_ORIGIN`.

- Empty `CORS_ORIGIN`: backend allows `origin: *` with `credentials: false`.
- Non-empty `CORS_ORIGIN`: comma-separated explicit origins and wildcard suffixes; credentials are enabled.
- Production must avoid wildcard `*` with credentials.

See `docs/ENV_CORS_AND_AUTH_CHECK.md` for the current environment reference.

## Internal Service Contract

Trusted internal endpoints use:

```http
x-internal-service-token: <INTERNAL_SERVICE_TOKEN>
x-service-name: <trusted-service-name>
```

`TRUSTED_INTERNAL_SERVICES` optionally restricts allowed caller names.

Registered-user communication preferences are Auth-owned and exposed only through internal Auth APIs:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/internal/users/:userId/preferences` | Read registered-user communication preferences. |
| `PATCH` | `/auth/internal/users/:userId/preferences` | Update registered-user communication preferences. |
| `POST` | `/auth/internal/users/:userId/unsubscribe` | Mark a registered user unsubscribed/transactional-only. |
| `GET` | `/auth/internal/check-email?email=...` | Check whether an email exists in Auth. |

Marketing may read/update registered-user preferences only through these APIs. Leads remain responsible for non-registered contact records. Notifications remains responsible for outbound sending.

## Client Responsibilities

Applications integrating with Auth must:

- Redirect users to Auth-hosted login/register/OAuth/magic-link flows.
- Include only caller-controlled HTTPS `return_url` values.
- Generate and validate `state` for CSRF protection when using redirects.
- Parse the URL fragment on return.
- Store tokens according to the client security model.
- Send API requests with `Authorization: Bearer <accessToken>`.
- Never log tokens, password reset tokens, magic-link tokens, OAuth tokens, client secrets, or JWT secrets.
- Never mint Auth JWTs locally.

## Historical Notes

The previous `docs/agents/*` Phase 0/Sync A prompts were removed in commit `3338638` as obsolete. Current workflow instructions live in `docs/orchestrator/`. The stable contract path is intentionally restored here because `README.md`, DocsRAG snapshots, and future agents need a discoverable source of truth.
