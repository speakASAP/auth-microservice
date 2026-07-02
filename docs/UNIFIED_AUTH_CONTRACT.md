# Unified Auth Contract

This document is the current Auth contract for applications and services that integrate with auth-microservice. Consumer implementation details for hosted redirects, callback fragment parsing, session storage, logout, and the draft client registry are maintained in docs/HOSTED_AUTH_CONSUMER_STANDARD.md.

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

The backend serves `/login`, `/register`, and `/reset-password` from `web/public/index.html`. The hosted login form submits `{ identifier, password }` to `/auth/login`, where `identifier` may be an email or phone number. The hosted register form still creates email/password accounts through `/auth/register`; when `client_id=marathon`, the form requires a phone number before submission so Marathon registrations always carry a phone contact. The hosted login surface also exposes password reset and an Auth-owned contact-code flow for email or phone. `POST /auth/contact-code/request` creates a verified-proof challenge and sends a 6-digit code through Notifications when a provider is configured; `POST /auth/contact-code/verify` consumes that proof and returns the same JWT contract plus `redirectUrl` fragment handoff. Phone delivery is centralized through Auth and Notifications; the current production default is `AUTH_CONTACT_CODE_PHONE_CHANNEL=whatsapp` because notifications-microservice does not dispatch direct SMS yet. Consumers must not implement local phone-code forms. The hosted Auth UI must collect and verify contact codes inline on the Auth page, using a one-time-code input and Auth-owned verify action; browser prompts and consumer-local code-entry screens are not part of the supported contract.

## Core API Endpoints

All JSON endpoints are under `/auth`.

| Method   | Path                                                  | Purpose                                                                                                                          |
| -------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/auth/register`                                      | Create an email/password user and return tokens.                                                                                 |
| `POST`   | `/auth/login`                                         | Authenticate email or phone identifier plus password and return tokens. Legacy `email` payloads remain supported.                |
| `POST`   | `/auth/validate`                                      | Validate an access token.                                                                                                        |
| `POST`   | `/auth/refresh`                                       | Exchange a valid refresh token for a new token pair.                                                                             |
| `GET`    | `/auth/profile`                                       | Return the authenticated user's canonical sanitized Auth profile from the Auth database. Requires bearer auth.                   |
| `PATCH`  | `/auth/profile`                                       | Update Auth-owned profile/contact fields and legacy canonical profile metadata. Requires bearer auth.                            |
| `GET`    | `/auth/profile/checkout-data`                         | Return sanitized Auth profile, delivery addresses, invoice profiles, and default IDs for checkout prefill. Requires bearer auth. |
| `GET`    | `/auth/profile/delivery-addresses`                    | List the authenticated user's Auth-owned delivery address book. Requires bearer auth.                                            |
| `POST`   | `/auth/profile/delivery-addresses`                    | Create a delivery address book entry for the authenticated user. Requires bearer auth.                                           |
| `GET`    | `/auth/profile/delivery-addresses/:addressId`         | Read one owned delivery address. Requires bearer auth.                                                                           |
| `PATCH`  | `/auth/profile/delivery-addresses/:addressId`         | Update one owned delivery address. Requires bearer auth.                                                                         |
| `DELETE` | `/auth/profile/delivery-addresses/:addressId`         | Soft-delete one owned delivery address. Requires bearer auth.                                                                    |
| `POST`   | `/auth/profile/delivery-addresses/:addressId/default` | Mark one owned delivery address as default. Requires bearer auth.                                                                |
| `GET`    | `/auth/profile/invoice-profiles`                      | List the authenticated user's Auth-owned invoice/billing profiles. Requires bearer auth.                                         |
| `POST`   | `/auth/profile/invoice-profiles`                      | Create an invoice/billing profile for the authenticated user. Requires bearer auth.                                              |
| `GET`    | `/auth/profile/invoice-profiles/:profileId`           | Read one owned invoice/billing profile. Requires bearer auth.                                                                    |
| `PATCH`  | `/auth/profile/invoice-profiles/:profileId`           | Update one owned invoice/billing profile. Requires bearer auth.                                                                  |
| `DELETE` | `/auth/profile/invoice-profiles/:profileId`           | Soft-delete one owned invoice/billing profile. Requires bearer auth.                                                             |
| `POST`   | `/auth/profile/invoice-profiles/:profileId/default`   | Mark one owned invoice/billing profile as default. Requires bearer auth.                                                         |
| `POST`   | `/auth/password-reset-request`                        | Create a password-reset token and request notification delivery.                                                                 |
| `POST`   | `/auth/password-reset-confirm`                        | Consume a password-reset token and set a new password.                                                                           |
| `POST`   | `/auth/password-change`                               | Change password for the authenticated user. Requires bearer auth.                                                                |
| `POST`   | `/auth/password-set`                                  | Set the first password for an authenticated passwordless user. Requires bearer auth.                                             |
| `POST`   | `/auth/register-contact`                              | Provision or update a contact-based user profile. This is not authentication and does not return JWTs.                           |
| `POST`   | `/auth/login-contact`                                 | Deprecated contact-login compatibility endpoint. It never issues ecosystem auth without verified proof.                          |
| `GET`    | `/auth/validate-return-url`                           | Validate a candidate `return_url`.                                                                                               |

Email/password `register` and `login` responses include:

```json
{
  "user": {},
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

`POST /auth/login` accepts the new identifier shape and the legacy email shape:

```json
{ "identifier": "user@example.com or +420777123456", "password": "password" }
```

```json
{ "email": "user@example.com", "password": "password" }
```

When the identifier is an email address, Auth looks up the canonical email. When it is not an email address, Auth normalizes it as a phone number and looks in both `users.phone` and phone entries in `users.contactInfo`. Successful email and phone password login return the same `user`, `accessToken`, and `refreshToken` contract.

`GET /auth/profile` is the canonical profile read for consuming applications after hosted Auth handoff. Consumers must initialize or refresh local application profile views from this Auth-owned response, not from application-local registration forms or stale JWT claims. The response is read from the Auth `users` table for the authenticated subject and is sanitized before return; it includes Auth-owned identity/contact fields such as `email`, `firstName`, `lastName`, `phone`, `contactInfo`, and Auth-owned preference/source metadata when present, and never includes `password`.

Auth also owns reusable customer data wallet entries for authenticated users.
Consumers should call `GET /auth/profile/checkout-data` before rendering
authenticated checkout forms. The response contains:

```json
{
  "user": {},
  "deliveryAddresses": [],
  "invoiceProfiles": [],
  "defaults": {
    "deliveryAddressId": "uuid-or-null",
    "invoiceProfileId": "uuid-or-null"
  }
}
```

`invoiceProfiles[]` uses the Auth v1 invoice profile schema:

```json
{
  "id": "uuid",
  "label": "Billing label",
  "type": "person-or-company",
  "firstName": "Billing first name",
  "lastName": "Billing last name",
  "companyName": "Company name",
  "companyId": "Company registration ID / ICO",
  "taxId": "Tax identifier used by the storefront/accounting flow",
  "vatId": "VAT identifier / DIC when applicable",
  "street": "Billing street",
  "street2": "Billing street 2",
  "city": "Billing city",
  "region": "Billing region",
  "postalCode": "Billing postal code",
  "country": "Billing country",
  "phone": "Billing phone",
  "email": "Invoice recipient email",
  "isDefault": false,
  "sourceApplication": "optional source app",
  "createdAt": "iso timestamp",
  "updatedAt": "iso timestamp"
}
```

Consumer mapping rules:

- Auth field names are canonical for reusable invoice profile truth:
  `companyId`, `taxId`, `vatId`, and `email`.
- `companyId` represents the company registration identifier, including Czech
  ICO-style values.
- `vatId` represents the VAT/DIC-style identifier when the customer has one.
- `taxId` is kept as a separate tax identifier for storefront/accounting flows
  that require it; consumers must not collapse it with `vatId` unless that
  store's accounting contract explicitly says they are the same.
- Invoice recipient email is the `email` field. `invoiceEmail` and
  `electronicInvoiceEmail` are not accepted Auth v1 field aliases unless a
  future contract version explicitly adds them.

Delivery address and invoice profile CRUD endpoints are scoped to the bearer
subject. Responses are sanitized and do not expose `userId`, `deletedAt`,
passwords, tokens, provider details, payment details, or raw audit data.
Consumers may submit selected entries as immutable order snapshots, but they
must update reusable profile, delivery, and invoice data through Auth rather
than creating app-local editable address books for registered users.

The production database uses `DB_SYNC=false`. New customer data wallet tables
are represented in source by `scripts/create-customer-data-wallet-tables.sql`
and must be applied only in an owner-approved database change window before
deploying code that depends on them.

`POST /auth/register-contact` remains a provisioning endpoint for Marathon, SpeakASAP, and similar callers. It creates or updates the Auth user and returns the canonical `userId`, `authenticated: false`, `provisioning: true`, and sanitized `user`. Any legacy `sessionId` in this response is compatibility metadata only; consumers must not treat it as an Auth JWT, refresh token, cookie session, or ecosystem authentication proof. For new users, `source` records the initial provisioning source. For existing users, Auth preserves the original `source` and records additional provisioning sources under `perApplicationPreferences.authSources.<source>`, for example `perApplicationPreferences.authSources.marathon`, so one central identity can belong to several Alfares applications without losing origin history.

`POST /auth/login-contact` is deprecated for ecosystem authentication. It may confirm that contact data exists only after normal lookup, but it does not update activity or return `sessionId`, `accessToken`, or `refreshToken`. Consumers must use `/auth/login` with password or a verified Auth-owned passwordless flow such as email magic-link before treating the user as authenticated. Phone code delivery is owned by Auth through Notifications. The default live channel is `whatsapp`, and deployments may route through `AUTH_CONTACT_CODE_PHONE_CHANNEL_KEY` if the Notifications channel registry owns the policy. If the provider is not configured or delivery fails, requests are accepted and audited as `created_not_sent` rather than falling back to consumer-local login.

Contact-code delivery runtime keys:

| Key                                   | Default    | Purpose                                                                                                                                                                                               |
| ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_CONTACT_CODE_PHONE_CHANNEL`     | `whatsapp` | Direct Notifications channel for phone identifiers. Current supported practical values are `whatsapp` or `telegram`; `sms` must not be used until notifications-microservice implements SMS dispatch. |
| `AUTH_CONTACT_CODE_PHONE_CHANNEL_KEY` | empty      | Optional Notifications channel registry key for phone code policy. When set, Auth sends `channelKey` instead of a direct channel.                                                                     |
| `AUTH_CONTACT_CODE_EMAIL_CHANNEL_KEY` | empty      | Optional Notifications channel registry key for email code policy.                                                                                                                                    |

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

Consumers must not mint Auth JWTs locally, validate user tokens with service-owned signing secrets, strip Auth role scopes as a generic rule, or treat static service tokens/API keys as user identity. Machine identity handling is defined in `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`.

## OAuth Contract

OAuth providers are initiated only through Auth:

- `GET /auth/oauth/google`
- `GET /auth/oauth/facebook`
- `GET /auth/oauth/callback/google`
- `GET /auth/oauth/callback/facebook`

OAuth init accepts `return_url`, optional `client_id`, and optional caller `state`.

Provider support currently implemented in code:

| Provider | Scope                  | Required runtime keys                          |
| -------- | ---------------------- | ---------------------------------------------- |
| Google   | `openid email profile` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`     |
| Facebook | `email`                | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |

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

Public passwordless flows:

- `POST /auth/magic-link/request`
- `GET /auth/magic-link/verify`
- `POST /auth/contact-code/request`
- `POST /auth/contact-code/verify`

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

This is the preferred contract for new machine-auth paths. Existing service-local API keys, bearer service tokens, and `x-internal-token` routes are transitional service-owned exceptions and must follow `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`: they create service actors, not users, and must stay separate from Auth-issued user access tokens.

Registered-user communication preferences are Auth-owned and exposed only through internal Auth APIs:

| Method  | Path                                       | Purpose                                                 |
| ------- | ------------------------------------------ | ------------------------------------------------------- |
| `GET`   | `/auth/internal/users/:userId/preferences` | Read registered-user communication preferences.         |
| `PATCH` | `/auth/internal/users/:userId/preferences` | Update registered-user communication preferences.       |
| `POST`  | `/auth/internal/users/:userId/unsubscribe` | Mark a registered user unsubscribed/transactional-only. |
| `GET`   | `/auth/internal/check-email?email=...`     | Check whether an email exists in Auth.                  |

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
