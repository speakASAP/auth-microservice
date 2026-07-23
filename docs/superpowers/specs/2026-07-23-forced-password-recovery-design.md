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
| Lifetimes | One variable, 15 minutes, shown to the user | A single number is easy to reason about and to state honestly in every message. |

## Configuration

`AUTH_PASSWORD_RECOVERY_TTL_MINUTES`, default `15`, governs **every** lifetime in the
recovery flow:

- the recovery code delivered by email,
- the grant minted when that code is verified,
- the grant minted by the email-link path.

No other variable participates. `AUTH_MAGIC_LINK_TTL_MINUTES` continues to govern ordinary
passwordless sign-in codes and magic links, which are not part of recovery.

The variable must be declared in `.env.example` and added to the `configmap_vars` list in
`deploy.config.sh:61`. A variable missing from that list never reaches the pod, and the code
would silently fall back to the default — a failure that passes every local test.

The value is read once and surfaced to the user everywhere a lifetime is stated, rather
than being duplicated as a literal in copy:

| Message | Source |
| --- | --- |
| Recovery code email | `getPlainEmailCopy('password_recovery', …, ttlMinutes)` |
| Password-reset link email | `getAuthEmailCopy('password_reset', …, ttlMinutes)` |
| "Code sent" notice on the login page | `ttlMinutes` in the `contact-code/request` response |
| Set-password screen | `ttlMinutes` in the recovery `contact-code/verify` response |

The hosted page cannot read backend environment variables, so both endpoints return
`ttlMinutes` and the `en`/`cs`/`ru` strings interpolate it. The number is never hardcoded in
the frontend.

**Each stage gets the full window.** A user has 15 minutes to enter the code and, after
verifying, a fresh 15 minutes to choose a password — so recovery may span up to 30 minutes
end to end. The alternative, one 15-minute budget for the whole flow, would expire people
mid-typing on the password screen. Each message states the window that applies to the step
in front of the user, so no message is misleading.

**Behavior change:** the email-link reset drops from 60 minutes to 15. Grants issued before
deployment keep the `expiresAt` already stored on their row; the TTL applies at mint time
only.

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
                     ├─ 6-digit code delivered by email, valid ttlMinutes
                     └─ { success: true, delivery, ttlMinutes }

Enter code        →  POST /auth/contact-code/verify   {purpose:'recovery'}
                     ├─ does NOT call generateTokens
                     ├─ mints a password_reset_tokens row (ttlMinutes, single-use)
                     │  carrying returnUrl / clientId / state from the magic-link row
                     └─ { recovery: true, ttlMinutes,
                          redirectUrl: '<FRONTEND_URL>/set-password?token=…&lang=…' }

Set password      →  POST /auth/password-reset-confirm
                     └─ { user, accessToken, refreshToken,
                          redirectUrl: '<return_url>#access_token=…' }
```

## Backend changes

**`ContactCodeRequestDto`, `ContactCodeVerifyDto`** — add
`purpose?: 'login' | 'recovery'`, defaulting to `'login'`.

**`requestContactCode` (`src/auth/auth.service.ts:1611`)** — persist `purpose` on the
`magic_link_tokens` row. For recovery, expire the row after
`AUTH_PASSWORD_RECOVERY_TTL_MINUTES` rather than `magicLinkTtlMinutes`, and send the new
`password_recovery` email copy rather than the `magic_link` copy. The response gains
`ttlMinutes` and otherwise remains identical for existing, unknown, and inactive users —
`ttlMinutes` is a constant, so it discloses nothing about the account.

**`verifyContactCode` (`src/auth/auth.service.ts:1684`)** — the stored row's `purpose` must
equal the requested `purpose`; a mismatch is rejected exactly like an invalid code, in both
directions. On a recovery match, skip `generateTokens`, mint the grant row with
`AUTH_PASSWORD_RECOVERY_TTL_MINUTES`, and return `{ recovery: true, ttlMinutes, redirectUrl }`
with no tokens.

**`confirmPasswordReset` (`src/auth/auth.service.ts:762`)** — when the grant row carries a
`returnUrl`, mint tokens with `auth_method: 'password_recovery'` and return
`{ message, user, accessToken, refreshToken, redirectUrl }`. When it does not, return
today's message-only shape, so existing callers are unaffected.

**`requestPasswordReset` (`src/auth/auth.service.ts:657`)** — persist the validated
`return_url`, `client_id`, and `state` on the token row instead of carrying them only in
the email querystring. Server-side storage means the completion target cannot be tampered
with between email and confirm. Replace the hardcoded `resetTtlMinutes = 60`
(`src/auth/auth.service.ts:713`) and the `expiresAt.setHours(+1)` computation
(`src/auth/auth.service.ts:673`) with the shared variable, so the stored expiry and the
number printed in the email are the same value by construction and cannot drift.

**Email copy** — a `password_recovery` entry in `getPlainEmailCopy`
(`src/auth/auth.service.ts:2210`) for `en`, `cs`, and `ru`, alongside `contact_code`, so the
message states the code resets a password rather than signs the user in. It takes
`ttlMinutes` like its neighbours.

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
  screen, and the redirect confirmation. Keys that state a lifetime take a `{minutes}`
  placeholder filled from the `ttlMinutes` field in the corresponding response — `t()` gains
  an optional parameter map. No lifetime is written as a literal in the frontend, so the
  page cannot contradict the backend.
- Russian needs the correct plural form for the interpolated number (`минуту` / `минуты` /
  `минут`). Use the abbreviated `мин.`, which is invariant, matching the existing email copy.

## Consumer impact

None. `catalog-microservice` and every other consumer receive the same
`#access_token=…` handoff at the same `return_url` they already register. No consumer
reads a new claim or handles a new status code.

## Security

- Recovery codes are subject to the existing per-IP and per-identifier rate limits, with
  `purpose` included in the limiter key so recovery attempts cannot drain the login budget.
- Every recovery artefact — code and grant, from either entry point — is single-use and
  expires after `AUTH_PASSWORD_RECOVERY_TTL_MINUTES`. The email-link grant drops from 60
  minutes to 15, narrowing the window in which a leaked inbox yields account access.
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

**TTL wiring** — with `AUTH_PASSWORD_RECOVERY_TTL_MINUTES` set to a non-default value, assert
that the recovery code row, the code-derived grant, and the email-link grant all expire after
that value, and that the same number appears in the recovery email, the reset-link email, and
the `ttlMinutes` field of both responses. This is the test that would catch a lifetime being
reintroduced as a literal, so it must fail if any one of those six places is hardcoded —
verify that by temporarily pinning one back to a constant.

**`src/auth/hosted-auth-web.spec.ts`** — `/set-password` serves `index.html`.

**Manual reproduction** — from `catalog.alfares.cz`, follow "Forgot password?" through to
the catalog page and confirm the session is authenticated with the new password.

## Accepted trade-off

"Forgot password?" no longer sends email links, so the 6-digit code becomes the only
self-service recovery route. A user whose email delivery is broken has no self-service
recovery. This is not a regression — today's link travels over the same channel — but it is
now a single point of failure by design.
