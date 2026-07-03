# Goal 10 Runtime Gate Execution Packet

Date: 2026-07-03
Coordinator: Auth Goal 10 orchestrator
Status: Gates 1-6 completed for approved wallet-read and metadata-preflight scope; follow-up implementation/migration gates remain blocked

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
- Gate 4 ChytraKoupe guarded selector smoke passed with Vault-backed synthetic login, sanitized local checkout-data fixture, selector/manual-edit evidence, no checkout submit, no Auth wallet mutation, and redacted output.
- Gate 5 Cliplot synthetic browser/session wallet-read evidence passed with Vault-backed synthetic login, three Auth wallet GET endpoints returning HTTP 200, no checkout submit, no mutation, and redacted output.
- Gate 6 Rent-a-box metadata-only production preflight passed with aggregate-zero local users/customer_profiles, `migrationComplexity=empty`, and blocker label `auth_subject_id_column_missing`.
- Rent-a-box route/onboarding source-only gate passed in commit `e518725` with status `approval_required_goal12_route_onboarding_migration_gate`; route migration remains inactive.
- FlipFlop, ChytraKoupe, Cliplot, and Rent-a-box source-only readiness lanes
  have been audited. No material source-only consumer lane remains before the
  runtime inputs below.

## Execution Order

1. Auth authenticated wallet CRUD/default/delete smoke - completed 2026-07-03.
2. FlipFlop guarded gateway wallet smoke - completed 2026-07-03.
3. FlipFlop authenticated browser/session selector smoke - completed 2026-07-03.
4. ChytraKoupe guarded selector smoke harness and run - completed 2026-07-03.
5. Cliplot synthetic browser/session wallet-read evidence - completed 2026-07-03.
6. Rent-a-box metadata-only production row-count/migration-complexity preflight - completed 2026-07-03.

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

Status: completed 2026-07-03.

Resolved owner inputs:

- Owner approved continuing Gate 4 with a Vault-backed synthetic Auth
  account/token and sanitized synthetic checkout selector fixture data.
- Non-secret approval id:
  `gate4-chytrakoupe-auth-wallet-selector-smoke-20260703-vault-test-login`.
- ChytraKoupe source commit:
  `de9fd39 test: add auth wallet checkout selector smoke`.

Evidence:

- Passed status: `pass_chytrakoupe_auth_wallet_selector_smoke`.
- Covered public `/checkout` HTTP 200, wallet read status 200, schema version
  `auth.customer-data-wallet.checkout-data.v1`, guest checkout render without
  Auth, delivery selector render, invoice selector render, manual company edit
  preserved after delayed wallet response, defaults not auto-selected after
  manual edit, explicit invoice selector applied, explicit delivery selector
  applied, and checkout submit button present but not clicked.
- Confirmed `orderSubmitCalled=false`, `authWalletMutationCalled=false`,
  `authWalletMutationEndpointCalled=false`, `noCheckoutSubmitOccurred=true`,
  `noAuthWalletMutationOccurred=true`, and `noRawCustomerDataLogged=true`.
- Output remained redacted and printed no bearer, password, JWT, cookie, raw
  request body, raw response body, decoded claim, DB row, checkout order,
  payment data, or raw production customer data.
- Source validation passed with `npm run verify:auth-wallet-checkout-selectors`,
  `node --check scripts/verify-auth-wallet-checkout-selectors.mjs`,
  `node --check scripts/smoke-auth-wallet-checkout-selectors.mjs`, and
  `git diff --check`.

Command shape:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/chytrakoupe && RUN_LIVE_CHYTRAKOUPE_AUTH_WALLET_SMOKE=1 CHYTRAKOUPE_AUTH_WALLET_SMOKE_CONFIRM=CHECKOUT_SELECTOR_READ_ONLY CHYTRAKOUPE_AUTH_WALLET_SMOKE_APPROVAL_ID=<non-secret-approval-id> CHYTRAKOUPE_AUTH_WALLET_SMOKE_BEARER_TOKEN=<synthetic-token> npm run smoke:auth-wallet-checkout-selectors'
```

Forbidden in this gate:

- Checkout submit, order/payment/Warehouse mutation, DB reads/writes, raw
  request/response body output, token/cookie printing, production customer
  data inspection, Auth wallet mutation, deploy, Kubernetes mutation, or Vault
  mutation.

## Gate 5 - Cliplot Browser/Session Wallet-Read Evidence

Status: completed 2026-07-03 for synthetic wallet-read evidence.

Resolved owner inputs:

- Owner approved running Gate 5 with the Vault-backed synthetic Auth test
  account/token path.
- Non-secret approval id: `CLIPLOT-AUTH-WALLET-SMOKE-20260703-GATE5`.
- Cliplot source commits: `a9a38a9 feat: add auth wallet browser session smoke harness`
  and `d08b4b0 docs: record auth wallet browser session smoke`.

Evidence:

- Passed status: `sanitized_auth_wallet_browser_session_smoke_recorded`.
- Auth base URL: `https://auth.alfares.cz`.
- Endpoint count: 3.
- `/auth/profile/checkout-data` returned HTTP 200 and schema version
  `auth.customer-data-wallet.checkout-data.v1`.
- `/auth/profile/delivery-addresses` returned HTTP 200.
- `/auth/profile/invoice-profiles` returned HTTP 200.
- Confirmed `checkoutSubmit=false`, `authWalletMutation=false`,
  `paymentCreation=false`, `warehouseReservation=false`,
  `notificationSend=false`, `databaseMutation=false`,
  `kubernetesMutation=false`, `bodyPrinted=false`, `tokenPrinted=false`, and
  `customerDataPrinted=false`.
- Validation passed with `npm run readiness:auth-wallet-checkout`,
  default `npm run readiness:auth-wallet-browser-session-smoke`, live
  `npm run smoke:auth-wallet-browser-session -- https://auth.alfares.cz`,
  `npm run check`, and `git diff --check`.

Remaining Cliplot follow-up gates:

- Runtime selector behavior implementation evidence.
- Runtime no-PII logging/frontend exposure implementation evidence.
- Runtime Auth wallet row to checkout/order snapshot field mapping implementation evidence.
- Runtime guest fallback implementation evidence when Auth wallet reads are
  unavailable.

## Gate 6 - Rent-a-box Metadata-Only Production Preflight

Status: completed 2026-07-03 for metadata-only row-count/migration-complexity
preflight and source-only route/onboarding gate. Product-code migration remains blocked.

Resolved owner inputs:

- Owner approved the metadata-only production row-count/migration-complexity
  preflight.
- Non-secret approval id:
  `gate6-rent-a-box-auth-wallet-metadata-preflight-20260703`.
- Rent-a-box source commit:
  `80d9ef1 docs: record auth wallet metadata preflight`.

Evidence:

- Passed status: `pass_goal12_rent_auth_metadata_preflight`.
- Route/onboarding gate status: `approval_required_goal12_route_onboarding_migration_gate` from Rent-a-box commit `e518725`.
- Tables exist: `users=true`, `customer_profiles=true`, `alembic_version=true`.
- Live schema metadata: `customer_profiles.auth_subject_id=false` and
  `ix_customer_profiles_auth_subject_id=false`.
- Aggregate counts: `users_total=0`, `users_active=0`,
  `users_admin_role=0`, `users_customer_role=0`,
  `customer_profiles_total=0`, `customer_profiles_deleted=0`,
  `duplicate_user_email_groups=0`, `customer_profiles_without_user=0`, and
  `users_without_customer_profile=0`.
- Blocker label: `auth_subject_id_column_missing`.
- Migration complexity: `empty`.
- Output was aggregate metadata only; no raw rows, customer data, password
  hashes, tokens, cookies, contract contents, connection strings, or DB writes
  were printed or performed.

Remaining Rent-a-box follow-up gates:

- Owner-approved nullable production schema apply or verification for
  `customer_profiles.auth_subject_id`.
- Owner-approved live DB migration/backfill scope before any product-code
  migration, even though current aggregate local user/profile counts are zero.



## Follow-up A - Cliplot Guarded Runtime Checkout Evidence

Status: completed 2026-07-03 for no-live-call runtime evidence.

Evidence:

- Cliplot commits `48b9111` and `df4c5b4` recorded the runtime checkout evidence packet and sanitized guard fix.
- Passed status: `auth_wallet_runtime_checkout_evidence_recorded_no_live_calls`.
- Selector helpers, customer-safe labels, excluded wallet fields, no-PII evidence, and six guest fallback cases passed.
- Confirmed `mutation=false`, `persistence=false`, `providerCall=false`, `authWalletFetch=false`, `authWalletMutation=false`, and `checkoutSubmit=false`.

Remaining Cliplot follow-up gates:

- Owner-approved live runtime wallet selector UI rollout.
- Owner-approved authenticated browser-session integration in the Cliplot frontend.
- Owner-approved live checkout submit using immutable Auth wallet snapshots.

## Follow-up B - Rent-a-box Nullable Production Schema Apply

Status: completed 2026-07-03 for nullable schema-only apply. Product-code migration remains blocked.

Evidence:

- Rent-a-box live schema apply verified `customer_profiles.auth_subject_id=true` and `ix_customer_profiles_auth_subject_id=true`.
- Post-apply metadata preflight passed with empty blocker labels, aggregate-zero users/customer_profiles, `customer_profiles_auth_subject_non_null=0`, `duplicate_auth_subject_groups=0`, and `migrationComplexity=empty`.
- Rent-a-box commits `34277a3` and `69c2f6c` record the evidence and validation report refresh.
- Confirmed no backfill rows, unique constraint, product-code auth migration, raw row inspection, customer-data output, connection string output, deploy, or Auth source change.

Remaining Rent-a-box follow-up gates:

- Scoped runtime adapter/local profile binding.
- Owner-approved backfill/product-code migration before replacing local auth.

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

- Gate 1 through Gate 6 approved evidence plus Rent-a-box route/onboarding source-only gate evidence remains redacted and follow-up implementation/migration gates are explicitly blocked.
- Auth coordinator docs link to it.
- `npm run check:customer-data-wallet-runtime-gate-packet` passes.
- `git diff --check` passes.
- Added-line sensitive literal scan returns no matches.
- Auth deployed wallet smoke still passes with unauthenticated 401 responses.

## Follow-up Gate - FlipFlop Order Snapshot Runtime Evidence

Status: source/preflight packet complete in FlipFlop commit `37d695d`; live
create/read proof still owner-gated.

The no-mutation packet proves source forwarding of UUID-shaped
`customer.authSubject`, separate bounded shipping/billing snapshots, and Auth
invoice fields `companyName`, `companyId`, `taxId`, `vatId`, and `email` into
the central Orders payload builder. It also runs the deployed fail-closed
`smoke-orders-auth-subject.js` preflight with `mutation=false`,
`providerCall=false`, deployment `1/1`, and service URL/token presence booleans
only.

Remaining owner inputs for persisted runtime proof:

- `[MISSING: approved RUN_LIVE_AUTH_SUBJECT_ORDERS_SMOKE=1 runtime execution]`
- `[MISSING: non-secret AUTH_SUBJECT_SMOKE_APPROVAL_ID]`
- `[MISSING: AUTH_SUBJECT_SMOKE_CONFIRM=CREATE_READ_OPTIONAL_CANCEL]`
- `[MISSING: approved AUTH_SUBJECT_SMOKE_CATALOG_PRODUCT_ID fixture]`
- `[MISSING: approved AUTH_SUBJECT_SMOKE_WAREHOUSE_ID fixture]`

Forbidden output remains unchanged: no token values, request/response bodies,
customer/order rows, DB row data, customer PII, payment/provider credentials,
Warehouse response bodies, or secrets.
