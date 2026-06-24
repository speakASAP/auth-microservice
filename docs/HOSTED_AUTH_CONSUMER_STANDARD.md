# Hosted Auth Consumer Standard

Date: 2026-06-24
Owner: auth-microservice
Status: active standard for new Alfares consumer migrations

## Purpose

This standard defines how Alfares applications integrate with the central Auth-hosted login and registration surface. It is the contract implementation workers should use when replacing local credential forms in Marathon, new SpeakASAP, School Committee, StateX, commerce apps, platform/admin apps, and future ecosystem services.

Legacy `speakasap-portal` is out of scope and must not be changed under this standard.

## Consumer Entry Points

Use Auth-hosted UI for human credential collection:

```text
https://auth.alfares.cz/login?client_id=<client_id>&return_url=<https callback url>&state=<opaque state>
https://auth.alfares.cz/register?client_id=<client_id>&return_url=<https callback url>&state=<opaque state>
```

Required parameters:

- `return_url`: absolute HTTPS callback URL owned by the consumer.
- `client_id`: stable logical client ID. Use lowercase app identifiers such as `marathon`, `speakasap`, `school-committee`, or `catalog-microservice`.

Recommended parameter:

- `state`: caller-generated opaque CSRF/return state. Consumers must validate it after callback before trusting the handoff.

Auth validates `return_url` through the same logic used by `/auth/validate-return-url`. In production, `AUTH_ALLOWED_REDIRECT_ORIGINS` must contain allowed consumer origins. If the allowlist is empty, current code allows any HTTPS origin; that is compatibility behavior, not the desired production posture.

## Callback Handoff

Auth redirects to the validated `return_url` with token data in the URL fragment, not query parameters:

```text
https://consumer.example/auth/callback#access_token=<JWT>&refresh_token=<JWT>&expires_at=<ISO>&state=<state>&auth_method=<method>
```

Fragment fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `access_token` | yes | Auth-issued JWT access token. |
| `refresh_token` | optional | Auth-issued refresh token when the flow returns one. |
| `expires_at` | optional | ISO timestamp when Auth can compute it. |
| `state` | optional | Original caller state, returned unchanged. |
| `auth_method` | optional | `password`, `magic_link`, `google`, `facebook`, `email_code`, `phone_code`, or another Auth-owned method. |

Consumer callback requirements:

1. Parse tokens only from `window.location.hash` or equivalent fragment access.
2. Validate returned `state` against a value generated before redirect.
3. Store the session according to the consumer session model below.
4. Strip the fragment from browser history immediately after parsing.
5. Redirect the user to the original in-app path after state validation.
6. Never log, screenshot, persist to docs, or send raw token fragments to analytics.

## Session Model

Preferred model for new implementations:

- BFF or server route consumes the fragment through a short frontend callback and stores session in HTTP-only, Secure, SameSite cookies.
- Consumer APIs validate access tokens by calling `POST /auth/validate` server-side.
- Refresh happens through a server-owned endpoint that does not expose refresh tokens to application code.

Accepted transitional model:

- Browser stores Auth tokens in localStorage or memory only when a BFF cookie adapter is not yet available.
- The adapter must strip fragments, handle logout, and avoid duplicate local credential forms.
- This model must be documented as transitional debt in the repo-local migration plan.

Forbidden model:

- Consumer-local password forms that POST user credentials directly to `/auth/login` or proxy credentials through a local `/api/auth/login` endpoint, unless the form is a temporary compatibility layer explicitly scheduled for removal.
- Consumer-local phone-code, magic-link, or password-reset flows that duplicate Auth-hosted behavior. Contact-code entry belongs in the Auth-hosted UI itself, with an inline one-time-code input and verify action, not a browser prompt and not a consumer app form.
- Consumer-minted Auth JWTs for users.
- Treating `register-contact` or `login-contact` as authenticated login.

## Backend Token Validation

Default validation pattern:

```http
POST https://auth.alfares.cz/auth/validate
Content-Type: application/json

{"token":"<access token>"}
```

Consumers should preserve Auth role strings and Auth user identifiers. Product services may keep app-local profile, role, permission, lead, order, participant, school, or customer records, but those records must reference Auth identity instead of becoming credential authority.

Local JWT verification is allowed only as a documented exception under `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`. Services using local verification must prove they use Auth-owned verification material, enforce expiry/signature validation, preserve role claims, and do not mint user tokens.

Machine/service tokens are a separate boundary governed by `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`. Do not block hosted human login migration on service-token redesign unless the same guard path validates both user and machine tokens and cannot distinguish user actors from service actors safely.

## Registration And Existing Users

Hosted Auth owns account creation and registered credentials. Consumers may still collect product-specific profile data after Auth callback.

Recommended existing-user flow:

1. User enters phone or email on hosted Auth.
2. If an Auth account exists and a password is required, hosted Auth asks for password.
3. If the user forgot the password, hosted Auth password reset is available.
4. If passwordless is enabled for that contact, hosted Auth contact-code flow sends and verifies the code.
5. Consumer receives only the Auth token handoff and binds product profile by Auth `sub`.

Marathon-specific transitional rule:

- Marathon registrations require a phone number.
- Existing Marathon users must be backfilled or reconciled into Auth/AOS with explicit approval before removing legacy fallbacks.
- Backfill dry-runs and apply commands remain approval-gated and must not expose raw PII.

## Logout

Consumer logout must clear only consumer-local session artifacts and then route the user to a neutral logged-out page or Auth-hosted login. Until Auth publishes centralized refresh-token revocation for all flows, consumers must not claim global logout across all apps.

Minimum logout behavior:

- Remove browser/local callback state.
- Remove localStorage transitional token keys if used.
- Clear consumer HTTP-only session cookies if used.
- Redirect to a non-token URL.

## Client Registry Draft

This registry is a planning artifact. Runtime allowlist truth still lives in Auth deployment configuration (`AUTH_ALLOWED_REDIRECT_ORIGINS`) and must be verified after Vault/ExternalSecret readiness is restored.

| Client ID | Candidate origin/callback | Source/evidence | Status |
| --- | --- | --- | --- |
| `marathon` | `https://marathon.alfares.cz/auth/callback` and in-app protected return paths such as `/profile` | deployed Marathon hosted Auth adapter and journey smoke | active consumer |
| `speakasap` | `https://speakasap.alfares.cz/auth/callback` | deployed new SpeakASAP frontend adapter | active consumer |
| `school-committee` | `https://strilkove.cz/auth/callback` and `https://www.strilkove.cz/auth/callback` | live ingress, runtime redirect validation, and School Committee browser smoke | active consumer |
| `statex` | `[MISSING: production origin]/auth/callback` | static frontend inventory | planned migration |
| `shop-assistant` | `[MISSING: production origin]/auth/callback` | static hosted-auth redirect inventory | verification lane |
| `marketing-microservice` | `https://marketing.alfares.cz/auth/callback` | static route/status inventory | verification lane |
| `monitoring-web` | `[MISSING: production origin]/auth/callback` | platform/ops handoff | verification lane |
| `minio-microservice` | `[MISSING: production origin]/auth/callback` | platform/ops handoff | verification lane |
| `runlayer` | `[MISSING: production origin]/auth/callback` | platform/ops handoff | verification lane |
| `catalog-microservice` | `[MISSING: production origin]/auth/callback` | commerce handoff | planned migration |
| `allegro-service` | `[MISSING: production origin]/auth/callback` | commerce handoff | planned migration |
| `bazos-service` | `[MISSING: production origin]/auth/callback` | commerce handoff | planned migration |
| `flipflop-service` | `[MISSING: production origin]/auth/callback` | commerce handoff | planned migration |
| `prompts-microservice` | `[MISSING: production origin]/auth/callback` | platform/ops handoff | planned migration |
| `suppliers-microservice` | `[MISSING: production origin]/auth/callback` | platform/ops handoff | planned migration |
| `rent-a-box` | `[MISSING: production origin]/auth/callback` | product/education handoff | design-first migration |
| `crypto-ai-agent` | `[MISSING: production origin]/auth/callback` | product/education handoff | planned migration |

## Validation Checklist For Consumer Workers

Before code changes:

- Repo-local migration plan exists and preserves the IPS chain.
- Existing auth surfaces are listed: UI forms, API proxy routes, callback routes, token storage, backend guards, role checks.
- Runtime secrets and live DB data are not required for the planned patch.

After code changes:

- Local credential form no longer collects password/phone-code/reset credentials unless explicitly transitional.
- Login/register actions route to hosted Auth with `client_id`, `return_url`, and `state`.
- Callback parses fragment, validates state, stores session, strips fragment, and redirects to a safe app route.
- Backend protected routes continue to return 401/403 correctly.
- Build/tests/static marker checks pass.
- No raw tokens, passwords, reset links, magic-link tokens, contact codes, or user PII appear in logs/docs/test output.

## Open Gates

- `[BLOCKED: Vault sealed]` until `vault-backend` is Ready and Auth allowlist/runtime config can be verified.
- `[MISSING: approved Auth client registry source of truth]` beyond this planning draft.
- `[MISSING: centralized refresh-token revocation/global logout contract]`.
- `[MISSING: owner approval for Marathon live read-only backfill dry-run]`.
- `[UNKNOWN: Notifications WhatsApp/channel-registry provider readiness for real phone-code delivery]`.
