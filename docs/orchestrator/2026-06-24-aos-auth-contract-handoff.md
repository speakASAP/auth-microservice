# AOS Auth Contract Handoff

Date: 2026-06-24
Owner role: WS-A Auth Contract Owner
Repo: auth-microservice

## IPS Chain

Vision: auth-microservice is the single Alfares ecosystem identity provider.
Goal Impact: Marathon, SpeakASAP, School Committee, and future applications can authenticate with email or phone through one token contract.
System: Auth owns user identity, credentials, contact lookup, JWT issuance, refresh, validate, magic-link, and service-authentication boundaries.
Feature: backwards-compatible identifier login and contact provisioning semantics.
Task: make `/auth/login` accept email or phone identifiers, keep `/auth/register-contact` provisioning-only, and stop bare `/auth/login-contact` from implying ecosystem authentication.
Execution Plan: narrow changes in `src/auth/**`, `src/users/**`, and Auth contract docs; no consumer repo changes; no live DB queries or writes.
Coding Prompt: preserve existing JWT/refresh shape, normalize email/phone contacts, avoid secrets and raw production data, validate locally.
Code: changed paths listed below.
Validation: commands listed below passed in `/home/ssf/Documents/Github/auth-microservice`.

## Endpoint Contract

### POST /auth/login

Supported request bodies:

```json
{ "identifier": "user@example.com", "password": "password" }
```

```json
{ "identifier": "+420777123456", "password": "password" }
```

```json
{ "email": "user@example.com", "password": "password" }
```

Behavior:

- `identifier` is preferred when present; legacy `email` remains accepted.
- Email identifiers are trimmed and lowercased before lookup.
- Phone identifiers are stripped to digits plus `+` before lookup.
- Phone lookup searches `users.phone` and phone contacts in `users.contactInfo`.
- Successful email and phone password login return the same existing response shape:

```json
{
  "user": {},
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

### POST /auth/register-contact

Purpose: provisioning only.

Behavior:

- Normalizes contact email and phone values before lookup/create/update.
- Accepts `isPrimary` as boolean or legacy string-like values such as `"true"` and `"1"`.
- Returns canonical `userId`, sanitized `user`, and compatibility `sessionId`.
- Also returns `authenticated: false` and `provisioning: true`.
- Does not return `accessToken` or `refreshToken`.
- Consumers must not treat `sessionId` as Auth authentication.

### POST /auth/login-contact

Status: deprecated for ecosystem authentication.

Behavior:

- Normalizes and looks up the supplied contact.
- If the contact exists and the user is active, returns `401 Unauthorized` requiring verified authentication.
- Does not update `lastActivity`.
- Does not return `sessionId`, `accessToken`, or `refreshToken`.
- Consumers must use `/auth/login` with a password or a verified Auth-owned passwordless flow.

### POST /auth/validate and POST /auth/refresh

Compatibility: unchanged.

## Changed Paths

- `docs/UNIFIED_AUTH_CONTRACT.md`
- `src/auth/auth.service.ts`
- `src/auth/auth-contract.spec.ts`
- `src/auth/dto/contact-register.dto.ts`
- `src/auth/dto/login.dto.ts`
- `src/users/users.service.ts`

## Validation Evidence

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/auth/auth-token-handoff.spec.ts` passed.
- `npm run build` passed.
- `git diff --check` passed.
- `npm test` passed.

## Blockers And Open Facts

- [UNKNOWN: SMS/WhatsApp/Telegram provider for phone passwordless login].
- No live DB queries, writes, migrations, backfills, secrets, or consumer repo changes were performed.
- Hosted central login/callback UI contract remains the next dependency for full Marathon and SpeakASAP redirect adoption.

## Handoff For Marathon And SpeakASAP

- Replace local credential ownership with central Auth login where possible.
- For password login, call `POST /auth/login` with `{ identifier, password }`; identifiers may be email or phone.
- For provisioning-only flows, call `POST /auth/register-contact`; store or map the returned canonical Auth `userId`, but do not treat `sessionId` as authenticated state.
- Do not call `POST /auth/login-contact` as an authentication path.
- Continue token validation through `POST /auth/validate` and refresh through `POST /auth/refresh`.
