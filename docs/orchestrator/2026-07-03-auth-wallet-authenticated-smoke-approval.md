# Auth Wallet Authenticated Smoke Approval Packet

Date: 2026-07-03
Repo: auth-microservice
Operation class: owner-approved authenticated synthetic wallet CRUD/default/delete smoke
Status: source-prepared; live execution blocked until synthetic account/token approval

## IPS Chain

Vision: Auth is the single source of truth for registered-user profile,
delivery address book, and invoice profile data across Statex applications.
Goal Impact: the team can prove the deployed Auth wallet persists reusable
delivery and invoice data for an authenticated subject before consumer checkout
smokes depend on it.
System: Auth hosted API, deployed Auth wallet schema, one owner-approved
synthetic Auth account/session, and Auth wallet endpoints.
Feature: authenticated synthetic delivery address and invoice profile
CRUD/default/delete runtime smoke.
Task: create, update, set default, verify checkout aggregate visibility, delete,
and verify absence from lists for one synthetic delivery address and one
synthetic invoice profile.
Execution Plan: run source checks first; after owner approval and a synthetic
token, execute the guarded harness once; stop on first failure; print only
sanitized status, booleans, schema version, and short ID hashes.
Coding Prompt: execute only with the exact approval phrase and required env
gates below; never print token, cookies, raw payloads, response bodies, DB rows,
or production customer data.
Code: `scripts/check-customer-data-wallet-authenticated-smoke.js` and Auth
wallet routes under `src/auth/auth.controller.ts`.
Validation: harness result
`pass_authenticated_wallet_crud_default_delete_smoke` with cleanup and delete
visibility assertions true.

## Approval Phrase

Owner approval must explicitly include this exact phrase:

```text
I approve Auth wallet authenticated smoke on alfares for one synthetic account/token, create/update/default/delete synthetic wallet rows only, cleanup required, redacted output only.
```

## Required Owner Inputs

- Synthetic Auth account/session boundary:
  `[MISSING: owner-approved synthetic Auth account/token]`.
- Non-secret approval id for evidence:
  `[MISSING: AUTH_WALLET_SMOKE_APPROVAL_ID]`.
- Base URL, default `https://auth.alfares.cz`.
- Confirmation that the synthetic token may create and delete wallet rows for
  its own subject only.

## Command Shape

Run only after approval. Do not paste the token into chat or docs.

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && \
RUN_AUTH_WALLET_AUTHENTICATED_SMOKE=1 \
AUTH_WALLET_SMOKE_CONFIRM=CREATE_UPDATE_DEFAULT_DELETE \
AUTH_WALLET_SMOKE_APPROVAL_ID=<non-secret-approval-id> \
AUTH_WALLET_SMOKE_TOKEN_FILE=<path-to-token-file> \
npm run check:customer-data-wallet-authenticated -- --execute'
```

`AUTH_WALLET_SMOKE_BEARER_TOKEN` may be used instead of
`AUTH_WALLET_SMOKE_TOKEN_FILE` only in a shell that will not echo commands or
persist history.

## Allowed Calls

- `GET /auth/profile/checkout-data`
- `GET /auth/profile/delivery-addresses`
- `POST /auth/profile/delivery-addresses`
- `PATCH /auth/profile/delivery-addresses/:id`
- `POST /auth/profile/delivery-addresses/:id/default`
- `DELETE /auth/profile/delivery-addresses/:id`
- `GET /auth/profile/invoice-profiles`
- `POST /auth/profile/invoice-profiles`
- `PATCH /auth/profile/invoice-profiles/:id`
- `POST /auth/profile/invoice-profiles/:id/default`
- `DELETE /auth/profile/invoice-profiles/:id`

## Synthetic Data Rules

- Use labels prefixed with `codex-wallet-smoke-` and
  `codex-invoice-smoke-`.
- Use `example.invalid` email addresses.
- Use only the approved synthetic Auth subject.
- Cleanup is mandatory. A failed cleanup leaves the operation failed and must be
  escalated before retrying.

## Expected Output Contract

Allowed output:

- HTTP method/path/status metadata.
- `schemaVersion`.
- Boolean assertions for default selection, checkout aggregate visibility,
  cleanup, and delete absence.
- Short non-reversible ID hashes.

Forbidden output:

- Authorization header, bearer token, JWT, refresh token, cookie, password,
  raw request payload, raw response body, DB row data, provider credentials,
  production customer data, or decoded token claims.

## Source-Only Approval Gate Safety

Default mode must remain non-mutating and must not read token contents even when
`AUTH_WALLET_SMOKE_BEARER_TOKEN` or `AUTH_WALLET_SMOKE_TOKEN_FILE` is present.
It may report only whether required gates are missing or present. Token contents
may be read only after all live execution gates are satisfied, including
`--execute`, `RUN_AUTH_WALLET_AUTHENTICATED_SMOKE=1`,
`AUTH_WALLET_SMOKE_CONFIRM=CREATE_UPDATE_DEFAULT_DELETE`, a non-secret approval
id, and a token input.

The default source-only output must include `source_only_approval_gate_safety_verified`
evidence proving:

- no live request is sent;
- token contents are not read;
- synthetic payload policy uses `example.invalid`, `codex-auth-wallet-smoke`,
  `codex-wallet-smoke-*`, and `codex-invoice-smoke-*`;
- cleanup requires deleting both created delivery and invoice rows;
- post-cleanup list checks verify deleted rows are absent;
- output policy forbids token, cookie, request body, response body, database
  row, and production customer data printing.

## Stop Conditions

Stop and do not retry automatically if:

- required env gates are missing;
- the token is not explicitly synthetic/approved;
- any endpoint returns non-2xx during mutation or cleanup;
- cleanup fails or deleted rows remain visible;
- output includes a raw token, cookie, password, response body, request body, or
  production customer data;
- the run would require inspecting DB rows or secrets.

## Current Missing Facts

- `[MISSING: owner-approved synthetic account/token for authenticated Auth wallet CRUD/default/delete smoke]`.
- `[MISSING: non-secret approval id for the live authenticated wallet smoke]`.
