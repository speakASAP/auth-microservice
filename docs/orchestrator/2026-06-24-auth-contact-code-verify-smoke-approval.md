# Auth Contact-Code Verify Smoke Approval Packet

Date: 2026-06-24
Repo: auth-microservice
Operation class: owner-approved live token-returning verification smoke
Status: template only; blocked until request-only smoke and owner-provided code

## IPS Chain

Vision: Auth owns the complete email/phone passwordless sign-in proof and token handoff.
Goal Impact: the team can verify that a delivered contact code can be consumed centrally and that tokens are returned only by Auth.
System: auth-microservice `POST /auth/contact-code/verify`, approved test contact, owner-provided code.
Feature: central contact-code verification and token redaction.
Task: verify one owner-approved code and redact token-bearing fields before any output is shown.
Execution Plan: execute only after request-only smoke succeeds and owner supplies the received code; pipe output through a redactor that replaces `accessToken`, `refreshToken`, and `redirectUrl` values.
Coding Prompt: never print raw JWTs, refresh tokens, code values, or token fragment URLs.
Code: `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/dto/contact-code-verify.dto.ts`.
Validation: sanitized JSON confirms verification success while token fields are redacted.

## Preconditions

- Request-only live smoke completed for the same approved test contact.
- Owner received a code through the expected provider channel.
- Owner explicitly approved verification and redaction.

## Approval Phrase

Owner approval must explicitly include this exact phrase:

```text
I approve Auth contact-code verify smoke for the same test contact and code, with token response redacted before output.
```

## Required Owner Inputs

- Test contact value: `[MISSING: same approved test contact]`.
- Code value: `[MISSING: owner-provided received code]`.
- Return URL: same as request-only smoke.

## Approved Command Shape After Phrase

Replace placeholders only after approval:

```bash
ssh alfares 'curl -fsS https://auth.alfares.cz/auth/contact-code/verify \
  -H "Content-Type: application/json" \
  --data "{\"identifier\":\"<approved-test-contact>\",\"code\":\"<owner-provided-code>\",\"return_url\":\"<same-approved-return-url>\"}" \
  | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d);process.stdin.on(\"end\",()=>{const j=JSON.parse(s);for (const k of [\"accessToken\",\"refreshToken\",\"redirectUrl\"]) if (j[k]) j[k]=\"[REDACTED]\"; console.log(JSON.stringify(j,null,2));})"'
```

## Expected Access

- Calls public Auth API once.
- Consumes one short-lived contact-code proof.
- May mark the test user's last-login/auth method in Auth.
- Does not read `.env`, Kubernetes Secrets, database rows, provider credentials, or unrelated user data.

## Expected Output Contract

Allowed output:

- Sanitized JSON only.
- Any token-bearing field must be `[REDACTED]`.

Forbidden output:

- Raw contact code, raw access token, raw refresh token, raw `redirectUrl` with token fragments, cookies, provider credentials, DB URLs, or unrelated user data.

## Stop Conditions

Stop and do not retry automatically if:

- request returns non-2xx;
- redactor fails or output is not JSON;
- any token-like value appears in output;
- owner did not confirm the code belongs to the approved test contact;
- a second verification attempt would be needed.

## Current Missing Facts

- [MISSING: request-only smoke evidence].
- [MISSING: owner approval phrase].
- [MISSING: owner-provided code].
- [MISSING: approved test contact].
