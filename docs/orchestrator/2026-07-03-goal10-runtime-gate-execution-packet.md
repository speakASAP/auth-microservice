# Goal 10 Runtime Gate Execution Packet

Date: 2026-07-03
Coordinator: Auth Goal 10 orchestrator
Status: Gates 1-3 completed; Gates 4-6 remain blocked until their named owner inputs exist

## Intent Preservation Chain

Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation.

## Purpose

This packet consolidates the next executable gates for the Auth customer data
wallet rollout. It does not approve execution by itself. It names the exact
inputs required to move from source-prepared/runtime-gated state to bounded
runtime evidence without re-opening source-only discovery.

## Current Proven State

- Auth wallet schema/API is deployed on `https://auth.alfares.cz`.
- Auth runtime smoke passes with `/health` HTTP 200 and
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles` returning HTTP 401 unauthenticated.
- Auth unauthenticated smoke output policy confirms no Authorization header,
  cookies, request body, response body printing, or database reads.
- Gate 1 Auth authenticated wallet smoke passed with Vault `TEST_EMAIL`/`TEST_PASSWORD` login-derived token, redacted output, synthetic rows only, and cleanup verification.
- Gate 2 FlipFlop guarded gateway wallet smoke passed with the same Vault-backed synthetic login path, redacted output, synthetic rows only, source assertions, and cleanup verification.
- Gate 3 FlipFlop browser/session selector smoke passed with delayed checkout-data, manual-edit guard evidence, explicit selector evidence, no checkout submit, redacted output, and cleanup verification.
- FlipFlop, ChytraKoupe, Cliplot, and Rent-a-box source-only readiness lanes
  have been audited. No material source-only consumer lane remains before the
  runtime inputs below.

## Execution Order

1. Auth authenticated wallet CRUD/default/delete smoke - completed 2026-07-03.
2. FlipFlop guarded gateway wallet smoke - completed 2026-07-03.
3. FlipFlop authenticated browser/session selector smoke - completed 2026-07-03.
4. ChytraKoupe guarded selector smoke harness and run.
5. Cliplot synthetic browser/session wallet-read evidence, then runtime
   implementation planning.
6. Rent-a-box metadata-only production row-count/migration-complexity preflight.

This order keeps Auth wallet persistence evidence ahead of consumer gateway or
browser-session evidence, and keeps Rent-a-box product-code migration blocked
until live data complexity is known.

## Gate 1 - Auth Authenticated Wallet Smoke

Status: completed 2026-07-03.

Resolved owner inputs:

- Owner approved Gate 1 Auth wallet authenticated smoke using a synthetic Auth account/token stored in Kubernetes/Vault.
- Non-secret approval id: `gate1-auth-wallet-smoke-20260703-vault-test-login`.
- Token source: Vault `TEST_EMAIL`/`TEST_PASSWORD` login-derived access token, stored only in a temporary token file for the smoke.
- The pre-existing Vault `JWT_TOKEN` returned initial checkout-data HTTP 401 before any mutation and was not used for the passing run.

Evidence:

- Passed status: `pass_authenticated_wallet_crud_default_delete_smoke`.
- Covered checkout-data GET 200; delivery address create/update/default/delete; invoice profile create/update/default/delete; default selection visibility in checkout data; and post-cleanup list verification.
- Output remained redacted and printed no token, password, JWT, cookie, Authorization header, raw request body, raw response body, decoded claim, DB row, secret value, or raw production customer data.

Command shape:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && \
RUN_AUTH_WALLET_AUTHENTICATED_SMOKE=1 \
AUTH_WALLET_SMOKE_CONFIRM=CREATE_UPDATE_DEFAULT_DELETE \
AUTH_WALLET_SMOKE_APPROVAL_ID=<non-secret-approval-id> \
AUTH_WALLET_SMOKE_TOKEN_FILE=<path-to-token-file> \
npm run check:customer-data-wallet-authenticated -- --execute'
```

Expected pass status:

- `pass_authenticated_wallet_crud_default_delete_smoke`

## Gate 2 - FlipFlop Guarded Gateway Wallet Smoke

Status: completed 2026-07-03.

Resolved owner inputs:

- Owner approved continuation after Gate 1, using the Vault-backed synthetic Auth account/token path.
- Non-secret approval id: `gate2-flipflop-auth-wallet-smoke-20260703-vault-test-login`.
- Token source: Vault `TEST_EMAIL`/`TEST_PASSWORD` login-derived access token, passed only as a redacted process value to the existing guarded smoke.

Evidence:

- Passed status: `pass_flipflop_auth_wallet_gateway_smoke`.
- Covered FlipFlop public pages `/checkout`, `/profile/addresses`, and `/profile/invoice-profiles`; gateway checkout-data; delivery address create/update/default/delete; invoice profile create/update/default/delete; default selection visibility in checkout data; source assertions; and post-cleanup list verification.
- Output remained redacted and printed no token, password, JWT, cookie, raw request body, raw response body, decoded claim, DB row, secret value, checkout order, payment data, or raw production customer data.

Command shape:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/flipflop && RUN_LIVE_FLIPFLOP_AUTH_WALLET_SMOKE=1 FLIPFLOP_AUTH_WALLET_SMOKE_CONFIRM=CHECKOUT_PROFILE_WALLET FLIPFLOP_AUTH_WALLET_SMOKE_APPROVAL_ID=<non-secret-approval-id> FLIPFLOP_AUTH_WALLET_SMOKE_BEARER_TOKEN=<synthetic-token> npm run smoke:auth-wallet-checkout-profile -- --execute'
```

Forbidden in this gate:

- Checkout submit, order/payment/Warehouse mutation, DB reads/writes, raw
  request/response body output, token/cookie printing, production customer
  data inspection.

## Gate 3 - FlipFlop Authenticated Browser/Session Selector Smoke

Status: completed 2026-07-03.

Resolved owner inputs:

- Owner approved continuation using the Vault-backed synthetic Auth account/token path.
- Non-secret approval id: `gate3-flipflop-auth-wallet-browser-smoke-20260703-vault-test-login`.
- FlipFlop source commit: `75f03eb test: add auth wallet browser session smoke`.

Evidence:

- Passed status: `pass_flipflop_auth_wallet_browser_session_smoke`.
- Covered headless browser `/checkout?step=details`, delayed `/api/auth/profile/checkout-data`, manual edit before wallet response, explicit invoice selector, explicit delivery selector, checkout submit not clicked, and cleanup verification.
- Output remained redacted and printed no bearer, password, JWT, cookie, raw request body, raw response body, decoded claim, DB row, checkout order, payment data, or raw production customer data.

Required future evidence:

- Complete for FlipFlop browser/session selector behavior.

## Gate 4 - ChytraKoupe Guarded Selector Smoke

Source status: approval packet exists; executable smoke harness is not yet
implemented and must not be added before owner inputs exist.

Required owner inputs:

- `[MISSING: owner-approved synthetic Auth account/token for ChytraKoupe wallet selector smoke]`
- `[MISSING: owner-approved synthetic checkout test data for ChytraKoupe wallet selector smoke]`
- `[MISSING: non-secret owner approval id for ChytraKoupe wallet selector smoke]`

After inputs exist, next coding task:

- Add a guarded ChytraKoupe smoke harness that reads Auth wallet data for the
  synthetic subject and proves selector rendering/manual override behavior
  without checkout submit, Auth wallet mutation, DB read/write, payment,
  Warehouse, notification, Kubernetes, Vault, or Auth source changes.

Baseline source validation before harness work:

```bash
npm run verify:auth-wallet-checkout-selectors
node --check scripts/verify-auth-wallet-checkout-selectors.mjs
git diff --check
```

## Gate 5 - Cliplot Browser/Session Wallet-Read Evidence

Source status: contract, plan, package script, report, and verifier are ready;
runtime checkout files must stay untouched until approved synthetic evidence
exists.

Required owner inputs:

- `[MISSING: approved synthetic Auth browser/session wallet-read evidence]`
- Non-secret Cliplot approval id.

Baseline validation:

```bash
npm run readiness:auth-wallet-checkout
node --check scripts/auth-wallet-checkout-readiness.js
git diff --check
```

Required future evidence:

- Runtime selector behavior implementation evidence.
- Runtime no-PII logging/frontend exposure evidence.
- Runtime Auth wallet row to checkout/order snapshot field mapping evidence.
- Runtime guest fallback implementation evidence when wallet reads are
  unavailable.

## Gate 6 - Rent-a-box Metadata-Only Production Preflight

Source status: hosted Auth scaffold, adapter mapping, nullable
`customer_profiles.auth_subject_id` schema prep, and current Auth live evidence
are source-prepared. Product-code migration is blocked.

Required owner inputs:

- `[MISSING: owner-approved metadata-only production row-count/migration-complexity preflight]`
- `[MISSING: owner-approved live DB migration/backfill scope for local users and customer_profiles]`

Allowed future preflight shape:

- Count local users and customer profiles.
- Count nullable/non-null `customer_profiles.auth_subject_id` after approved
  schema state.
- Count candidate duplicates/conflicts only as aggregate numbers.
- Report only metadata counts and blocker labels.

Forbidden in this gate:

- Raw customer rows, emails, phones, addresses, password hashes, tokens,
  cookies, contract storage, production data dumps, product-code auth switch,
  uniqueness enforcement, backfill writes, deploys, or Auth source changes.

## Shared Output Contract

Allowed output across all gates:

- Repository head and clean/dirty status.
- Exact command shape with non-secret approval id.
- HTTP method/path/status metadata.
- `schemaVersion`.
- Booleans for selector behavior, default selection, cleanup, fallback, and
  no-mutation assertions.
- Short non-reversible ids or hashes.
- Aggregate metadata counts for an approved Rent-a-box preflight.

Forbidden output across all gates:

- Authorization headers, bearer tokens, JWTs, refresh tokens, cookies,
  passwords, OAuth tokens, magic-link tokens, reset tokens, raw request payloads,
  raw response bodies, decoded token claims, DB row data, production customer
  data, payment provider credentials, service credentials, or secrets.

## Stop Conditions

Stop immediately and do not retry automatically if:

- Required owner inputs or approval ids are missing.
- Any command would print or persist a token/cookie/secret/customer data value.
- Cleanup fails after a wallet mutation smoke.
- A smoke would need checkout submit, order/payment/Warehouse mutation,
  notification send, DB row inspection, Kubernetes mutation, Vault mutation, or
  deploy outside the approved scope.
- Runtime evidence contradicts the Auth single-source-of-truth boundary.

## Validation For This Packet

This packet is valid when:

- Gate 1, Gate 2, and Gate 3 completion evidence remains redacted and Gates 4-6 still show missing owner inputs.
- Auth coordinator docs link to it.
- `npm run check:customer-data-wallet-runtime-gate-packet` passes.
- `git diff --check` passes.
- Added-line sensitive literal scan returns no matches.
- Auth deployed wallet smoke still passes with unauthenticated 401 responses.
