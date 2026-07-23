# Forced Password Recovery After One-Time-Code Login

**Date:** 2026-07-23
**Service:** auth-microservice
**Status:** Approved, ready for implementation planning

## Problem

`auth.alfares.cz` offers two independent flows on the same login page:

| Affordance | Endpoint | Effect |
| --- | --- | --- |
| "Send sign-in code" | `POST /auth/contact-code/request` → `/verify` | 6-digit code, issues JWT, redirects to `return_url`. Password untouched. |
| "Forgot password?" | `POST /auth/password-reset-request` | Emails a link to `/reset-password?token=…`, user sets a new password. |

A user who has forgotten their password can sign in with the first flow and reach the
target application, but their password remains unknown. The code flow is a passwordless
login; it carries no notion of "you must now fix your password."

Two supporting defects make the situation worse:

1. `POST /auth/change-password` (`src/auth/auth.service.ts:800`) requires `currentPassword`,
   so a user who signed in by code cannot use it.
2. The email-link reset is a dead end. `web/public/index.html:686` displays a success
   message and stops. The flow threads `return_url` from request through to the reset page
   but never uses it and never signs the user in, so the user must return to the login page
   and authenticate again.

## Goal

A user who has forgotten their password recovers in one continuous flow: request recovery,
enter the emailed code, set a new password, and land on the page they originally wanted —
already signed in. No application token exists for that session before the new password is
set.

## Design decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Trigger | Recovery intent only | Deliberate passwordless code logins stay frictionless. Only a session that started as "I forgot my password" is forced through the password screen. |
| Enforcement point | auth-microservice, before token handoff | Consuming applications need no changes, and no application token can leak into an un-recovered session. |
| Entry point | "Forgot password?" sends a 6-digit code | Same-device recovery, no inbox round-trip. Existing `/reset-password?token=` links keep working. |

## Core concept: the recovery grant

An OTP requested with recovery intent cannot be exchanged for application tokens. It can
only be exchanged for a short-lived, single-use **grant** that authorizes exactly one
action: set a new password. Completing that action mints the application tokens and
performs the normal handoff to the original `return_url`.

`password_reset_tokens` becomes that grant, regardless of how it was obtained — email link
or recovery code. Both entry points converge on one completion path.

## Data model

```
password_reset_tokens  + returnUrl  text          null
                       + clientId   varchar(255)  null
                       + state      text          null

magic_link_tokens      + purpose    varchar(20)   not null default 'login'   -- 'login' | 'recovery'
```

`purpose` defaults to `'login'`, so rows written before this change keep their current
meaning.

## Flow

```
Forgot password?  →  POST /auth/contact-code/request  {purpose:'recovery'}
                     └─ 6-digit code delivered by email

Enter code        →  POST /auth/contact-code/verify   {purpose:'recovery'}
                     ├─ does NOT call generateTokens
                     ├─ mints a password_reset_tokens row (15 min TTL, single-use;
                     │  the email-link path keeps its existing 1-hour TTL)
                     │  carrying returnUrl / clientId / state from the magic-link row
                     └─ { recovery: true,
                          redirectUrl: '<FRONTEND_URL>/set-password?token=…&lang=…' }

Set password      →  POST /auth/password-reset-confirm
                     └─ { user, accessToken, refreshToken,
                          redirectUrl: '<return_url>#access_token=…' }
```

## Backend changes

**`ContactCodeRequestDto`, `ContactCodeVerifyDto`** — add
`purpose?: 'login' | 'recovery'`, defaulting to `'login'`.

**`requestContactCode` (`src/auth/auth.service.ts:1611`)** — persist `purpose` on the
`magic_link_tokens` row. For recovery, send the new `password_recovery` email copy rather
than the `magic_link` copy. The response is unchanged and remains identical for unknown and
inactive users.

**`verifyContactCode` (`src/auth/auth.service.ts:1684`)** — the stored row's `purpose` must
equal the requested `purpose`; a mismatch is rejected exactly like an invalid code, in both
directions. On a recovery match, skip `generateTokens`, mint the grant row, and return
`{ recovery: true, redirectUrl }` with no tokens.

**`confirmPasswordReset` (`src/auth/auth.service.ts:762`)** — when the grant row carries a
`returnUrl`, mint tokens with `auth_method: 'password_recovery'` and return
`{ message, user, accessToken, refreshToken, redirectUrl }`. When it does not, return
today's message-only shape, so existing callers are unaffected.

**`requestPasswordReset` (`src/auth/auth.service.ts:657`)** — persist the validated
`return_url`, `client_id`, and `state` on the token row instead of carrying them only in
the email querystring. Server-side storage means the completion target cannot be tampered
with between email and confirm.

**Email copy** — a `password_recovery` entry in `getAuthEmailCopy`
(`src/auth/auth.service.ts:2148`) for `en`, `cs`, and `ru`, distinct from `magic_link`, so
the message states the code resets a password rather than signs the user in.

## Hosted web changes

**`web/server.js:172`** — add `/set-password` to the route list serving `index.html`.

**`web/public/index.html`**

- "Forgot password?" calls `/auth/contact-code/request` with `purpose:'recovery'` and
  reveals the existing code input, subject to the same `validatedReturnUrl` guard the code
  flow already applies.
- Code verification posts `purpose:'recovery'`; on `{ recovery: true }` the page navigates
  to `data.redirectUrl`.
- A new `set-password` mode reads `?token=`, reuses the existing password and
  password-confirm rows, posts to `/auth/password-reset-confirm`, and on success navigates
  to `data.redirectUrl`. Without a `redirectUrl` it shows the success message and a link
  back to login.
- The existing `reset-password` mode becomes an alias of `set-password`. Links already
  delivered by email keep working and now also complete into the application.
- New i18n keys across `en`, `cs`, and `ru` for the recovery-code prompt, the set-password
  screen, and the redirect confirmation.

## Consumer impact

None. `catalog-microservice` and every other consumer receive the same
`#access_token=…` handoff at the same `return_url` they already register. No consumer
reads a new claim or handles a new status code.

## Security

- Recovery codes are subject to the existing per-IP and per-identifier rate limits, with
  `purpose` included in the limiter key so recovery attempts cannot drain the login budget.
- The grant is single-use. A code-derived grant expires 15 minutes after it is minted,
  independently of the code's own TTL (`AUTH_MAGIC_LINK_TTL_MINUTES`, default 15). The
  email-link path keeps its current 1-hour grant (`src/auth/auth.service.ts:673`); adding
  columns to `password_reset_tokens` must not shorten it.
- `return_url` is validated through `validateReturnUrl()` when the grant is minted and again
  before handoff.
- The recovery request returns an identical response for existing, unknown, and inactive
  users.
- No application token is minted at any point before the new password is stored.
- A `purpose='login'` token cannot satisfy a recovery verify, and a `purpose='recovery'`
  token cannot satisfy a login verify.

## Testing

**`src/auth/auth-contact-code.spec.ts`** — a recovery request stores `purpose='recovery'`;
recovery verify returns `redirectUrl` and no `accessToken`; purpose mismatch is rejected in
both directions.

**`src/auth/password-recovery-flow.spec.ts`** (new) — request → verify → confirm yields
tokens and a `redirectUrl` pointing at the original `return_url`; an expired grant is
rejected; a replayed grant is rejected; a `return_url` outside the allowed origins is
rejected.

**`src/auth/hosted-auth-web.spec.ts`** — `/set-password` serves `index.html`.

**Manual reproduction** — from `catalog.alfares.cz`, follow "Forgot password?" through to
the catalog page and confirm the session is authenticated with the new password.

## Accepted trade-off

"Forgot password?" no longer sends email links, so the 6-digit code becomes the only
self-service recovery route. A user whose email delivery is broken has no self-service
recovery. This is not a regression — today's link travels over the same channel — but it is
now a single point of failure by design.
