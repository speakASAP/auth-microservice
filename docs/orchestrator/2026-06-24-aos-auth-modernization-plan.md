# Auth Microservice GDD Plan: Unified AOS Login Contract

Date: 2026-06-24
Repo: auth-microservice
Owner role: central identity provider owner

## IPS Chain

Vision: auth-microservice is the only Alfares identity provider and hosted login surface.
Goal Impact: all apps can authenticate users by phone or email through one maintained service and receive the same JWT/refresh token contract.
System: NestJS auth-microservice, user repository, JWT issuance, validation, refresh, password reset, magic link, contact registration.
Feature: first-class identifier login, contact provisioning, passwordless phone/email challenge, hosted auth entrypoint and redirect callback contract.
Task: replace contact `sessionId` login semantics with token-compatible flows while preserving existing email/password clients.
Execution Plan: implement contract in phases; publish DTOs and tests before consumers switch.
Coding Prompt: modify only auth-microservice; preserve backwards compatibility; do not print secrets or user PII; do not run live DB writes without approval.
Code: src/auth/**, src/users/**, tests, docs.
Validation: npm build/test plus contract tests for old and new shapes.

## Current Findings

- `/auth/login` accepts email+password only and returns JWT access/refresh tokens.
- `/auth/register-contact` can create/update users with `source`, but `isPrimary` DTO currently expects string while logic treats it as boolean-like.
- `/auth/login-contact` returns opaque `sessionId`, not JWT, so it is not ecosystem-compatible.
- Phone lookup uses `findByPhone` for phone contacts; users whose phone lives only in `contactInfo` may not be found.
- `/auth/validate` and `/auth/refresh` are the compatibility anchors for current apps.

## Goals

G1: Normalize contacts.
- Accept boolean or string `isPrimary` safely.
- Normalize email lowercase and phone to a canonical comparable form.
- Search phone in both `users.phone` and JSON contactInfo.

G2: Identifier login.
- Change login DTO from email-only to `identifier` while accepting legacy `email`.
- If identifier looks like email, search email; otherwise search phone/contact.
- Return unchanged accessToken/refreshToken shape.

G3: Passwordless contract.
- Implement Auth-owned `POST /auth/contact-code/request` and `POST /auth/contact-code/verify` endpoints for email or phone identifiers.
- Reuse existing Auth proof storage where possible to avoid unapproved DB migrations.
- Emit phone codes through Notifications `channel=sms`; keep provider readiness as `[UNKNOWN]` until deployment/config verification.
- Never return JWT from unverified bare contact proof; `/auth/login-contact` remains deprecated and non-authenticating.

G4: Hosted login contract.
- Add or document central hosted login URL with `client_id`, `redirect_uri`, `state`, `next`.
- Validate redirect URLs against registered application allowlists.
- Return callback using authorization code or safe token handoff depending on phase.

G5: Consumer compatibility.
- Keep `/auth/login`, `/auth/validate`, `/auth/refresh`, `/auth/password-reset-request` backwards compatible.
- Add tests covering school-committee current login route.
- Add tests covering Marathon contact registration and existing-user conflict.

## Deliverables

- `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md` with this plan.
- Contract docs for the endpoint request/response shapes.
- Test coverage for legacy email/password, new phone/password, contact registration, validate/refresh.
- Handoff notes for Marathon and SpeakASAP workers.

## Validation Gates

- `npm run build`
- existing unit tests if available
- targeted auth contract tests
- no live DB query or migration unless separately approved

## Parallel Ownership

This repo owns WS-A. It must publish a stable contract before Marathon and SpeakASAP make irreversible UI changes.


## 2026-06-24 Contact-Code Implementation Update

- `POST /auth/contact-code/request` and `POST /auth/contact-code/verify` are implemented in source.
- Hosted `/login` uses the contact-code flow for email or phone passwordless sign-in.
- Validation passed: targeted contact-code/hosted-contract tests, `npm run build`, full `npm test`, `git diff --check`, and hosted inline JavaScript syntax check.
- Remaining gate: deploy/runtime SMS provider verification.
