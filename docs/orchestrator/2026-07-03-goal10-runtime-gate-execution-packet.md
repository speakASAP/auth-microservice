# Goal 10 Runtime Gate Execution Packet

Date: 2026-07-03
Coordinator: Auth Goal 10 orchestrator
Status: source-prepared; execution blocked until named owner inputs exist

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
- Auth smoke output policy confirms no Authorization header, cookies, request
  body, response body printing, or database reads.
- FlipFlop, ChytraKoupe, Cliplot, and Rent-a-box source-only readiness lanes
  have been audited. No material source-only consumer lane remains before the
  runtime inputs below.

## Execution Order

1. Auth authenticated wallet CRUD/default/delete smoke.
2. FlipFlop guarded gateway wallet smoke.
3. FlipFlop authenticated browser/session selector smoke.
4. ChytraKoupe guarded selector smoke harness and run.
5. Cliplot synthetic browser/session wallet-read evidence, then runtime
   implementation planning.
6. Rent-a-box metadata-only production row-count/migration-complexity preflight.

This order keeps Auth wallet persistence evidence ahead of consumer gateway or
browser-session evidence, and keeps Rent-a-box product-code migration blocked
until live data complexity is known.

## Gate 1 - Auth Authenticated Wallet Smoke

Source status: harness and approval packet are ready.

Required owner inputs:

- `[MISSING: owner-approved synthetic Auth account/token]`
- `[MISSING: AUTH_WALLET_SMOKE_APPROVAL_ID]`
- Confirmation that the token may create and delete wallet rows only for its
  own synthetic subject.

Approval phrase:

```text
I approve Auth wallet authenticated smoke on alfares for one synthetic account/token, create/update/default/delete synthetic wallet rows only, cleanup required, redacted output only.
```

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

Source status: harness and approval packet are ready.

Required owner inputs:

- `[MISSING: owner-approved synthetic Auth token]`
- `[MISSING: FLIPFLOP_AUTH_WALLET_SMOKE_APPROVAL_ID]`
- Confirmation that the token may create/delete wallet rows only for its own
  synthetic Auth subject.

Approval phrase:

```text
I approve FlipFlop Auth wallet smoke on alfares for one synthetic Auth account/token, gateway wallet create/update/default/delete only, no checkout submit, cleanup required, redacted output only.
```

Command shape:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/flipflop && \
RUN_LIVE_FLIPFLOP_AUTH_WALLET_SMOKE=1 \
FLIPFLOP_AUTH_WALLET_SMOKE_CONFIRM=CHECKOUT_PROFILE_WALLET \
FLIPFLOP_AUTH_WALLET_SMOKE_APPROVAL_ID=<non-secret-approval-id> \
FLIPFLOP_AUTH_WALLET_SMOKE_BEARER_TOKEN=<synthetic-token> \
npm run smoke:auth-wallet-checkout-profile -- --execute'
```

Forbidden in this gate:

- Checkout submit, order/payment/Warehouse mutation, DB reads/writes, raw
  request/response body output, token/cookie printing, production customer
  data inspection.

## Gate 3 - FlipFlop Authenticated Browser/Session Selector Smoke

Source status: source verifiers cover manual-edit guard and explicit selector
override, but authenticated browser/session smoke is still gated.

Required owner inputs:

- `[MISSING: owner-approved authenticated browser/session smoke for delayed wallet response and selector interaction]`
- Synthetic Auth account/session for browser use.
- Non-secret approval id.

Required future evidence:

- Delayed wallet response does not overwrite manually edited fields.
- Explicit selector choice can prefill delivery and invoice profile fields.
- Guest checkout still works.
- No checkout submit or order/payment/Warehouse mutation occurs.

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

- Auth coordinator docs link to it.
- `npm run check:customer-data-wallet-runtime-gate-packet` passes.
- `git diff --check` passes.
- Added-line sensitive literal scan returns no matches.
- Auth deployed wallet smoke still passes with unauthenticated 401 responses.
