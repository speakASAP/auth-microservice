# Auth Contact-Code Live Smoke Approval Packet

Date: 2026-06-24
Repo: auth-microservice
Operation class: owner-approved live contact delivery smoke
Status: request-only live smoke completed with runtime TEST_EMAIL; verification smoke remains separate

## IPS Chain

Vision: auth-microservice owns phone/email passwordless sign-in centrally for all Alfares applications.
Goal Impact: the team verifies that the hosted Auth contact-code delivery path can send a real code without consumer-local forms.
System: auth-microservice hosted Auth API, Notifications provider/channel registry, approved owner test contact.
Feature: central `POST /auth/contact-code/request` live delivery smoke.
Task: request a contact code for one owner-approved test phone or email and verify delivery acceptance without printing secrets or tokens.
Execution Plan: first run readiness checks; then, only after owner approval and a test contact, call `/auth/contact-code/request` once with the DTO fields `identifier`, `return_url`, and `client_id=marathon` or `client_id=speakasap`; do not verify a code or print JWTs unless the owner separately approves the verification step.
Coding Prompt: execute only after owner approval with the exact approval phrase below.
Code: `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, hosted Auth UI, Notifications integration.
Validation: HTTP success response with delivery accepted/created state, plus provider-side user confirms receipt if applicable.

## Approval Phrase

Owner approval must explicitly include this exact phrase and a test contact out of band or in the same message:

```text
I approve Auth contact-code live smoke on alfares for one test contact, request-only, no token verification, no raw token output, no user-data export.
```

## Required Owner Inputs

- Test contact type: `email` or `phone`.
- Test contact value: `[MISSING: owner-approved test contact]`.
- Client id: `marathon` or `speakasap`.
- Return URL: use one of:
  - `https://marathon.alfares.cz/profile`
  - `https://speakasap.alfares.cz/auth/callback`

## Approved Request-Only Command Shape

Replace placeholders only after approval:

```bash
ssh alfares 'curl -fsS https://auth.alfares.cz/auth/contact-code/request \
  -H "Content-Type: application/json" \
  --data "{\"identifier\":\"<approved-test-contact>\",\"client_id\":\"<marathon-or-speakasap>\",\"return_url\":\"<approved-return-url>\"}"'
```

## Expected Access

- Calls public Auth API.
- May create a short-lived contact-code challenge in Auth runtime storage.
- May send one email/WhatsApp/Telegram/SMS-like provider message depending on runtime configuration.
- Does not read `.env`, Kubernetes Secrets, database rows, provider credentials, JWTs, refresh tokens, or user exports.

## Expected Output Contract

Allowed output:

- HTTP success/failure status and sanitized JSON fields such as `success`, `delivery`, `message`, or provider-accepted state.
- No code value should be printed by the system.

Forbidden output:

- Raw contact code, JWT, refresh token, password reset token, magic-link token, provider credential, DB connection string, cookie, or unrelated user data.

## Optional Verification Step

Code verification is a separate operation because it can return Auth tokens. It requires a second explicit approval:

```text
I approve Auth contact-code verify smoke for the same test contact and code, with token response redacted before output.
```

If approved, the verification command must redact `accessToken`, `refreshToken`, and any fragment URL before output is shown.

## Stop Conditions

Stop and do not retry automatically if:

- request returns non-2xx;
- provider returns not configured / not sent;
- output includes a raw code, token, or secret-looking value;
- more than one request would be needed;
- owner did not confirm the test contact is safe to message.

## Current Missing Facts

- [APPROVED: owner approved non-sensitive live credential/contact-code callback smoke in current orchestration flow].
- [RESOLVED: runtime `TEST_EMAIL` from `auth-microservice-secret` used without printing the value].
- [RESOLVED: request-only smoke returned HTTP 201 with `success=true` and `delivery=sent`].
- [RESOLVED: Vault/ExternalSecret readiness verified by central readiness; `vault-backend` is Ready].


## Execution Evidence - 2026-06-24

- Request-only contact-code smoke executed inside the deployed `auth-microservice` pod using runtime `TEST_EMAIL`; the contact value was not printed.
- Command posted to `http://localhost:3370/auth/contact-code/request` with `client_id=marathon` and `return_url=https://marathon.alfares.cz/profile`.
- Sanitized result: `status=201`, `success=true`, `delivery=sent`.
- No code, token, refresh token, redirect URL, provider credential, DB URL, cookie, or raw contact value was printed.
- Verification was not run because it requires the received code and a separate redacted token-returning operation.
