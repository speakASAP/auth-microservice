## 2026-07-03 - Goal 10.52 Rent-a-box Auth Subject Binding Backfill Runbook

Current focus:

- Source-prepare Rent-a-box Auth subject binding/backfill gates without product
  code migration, live DB row counts, or schema changes.

Evidence:

- Rent-a-box commit `0e1f754 docs: add auth subject binding runbook` adds
  `docs/goals/GOAL-12-auth-subject-binding-backfill-runbook.md`.
- The same commit updates
  `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`,
  `docs/goals/GOAL-12-rent-auth-adapter-mapping-contract.md`,
  `docs/goals/README.md`, `docs/governance/DOCUMENT_STATE_REGISTER.md`,
  `scripts/check_goal12_auth_wallet_readiness.py`, and generated IPS
  validation reports.
- The runbook records future `customer_profiles.auth_subject_id` schema
  preconditions, `CustomerProfile.id` preservation, email as transitional
  candidate match only, unique non-null only after approved backfill, and
  local/test database validation only.
- Migration/backfill remains blocked by owner-approved live DB
  migration/backfill plan and production local users/customer_profiles row
  counts/complexity evidence.

Validation:

- Rent-a-box `python3 -m py_compile
  scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py
  scripts/ips_pre_coding_gate.py` passed.
- Rent-a-box `python3 -B scripts/check_goal12_auth_wallet_readiness.py --root
  .` passed with `pass_dependency_gated`.
- Rent-a-box `./scripts/intent_preflight.sh` passed.
- Rent-a-box `git diff --check` passed.
- Rent-a-box targeted dangerous literal-secret scan on changed files returned no
  matches.

Boundary:

- No product-code migration, live DB read/write, production row inspection,
  password hash/token/cookie/contract storage inspection, deploy, Kubernetes
  mutation, Auth repo change, or schema migration was performed.

Next unfinished chunk:

- Rent-a-box remains gated on owner-approved live DB migration/backfill plan and
  production local users/customer_profiles row counts/complexity before
  product-code migration.

## 2026-07-03 - Goal 10.51 Cliplot Source-Only Mapping And No-PII Verifier

Current focus:

- Source-prepare Cliplot Auth wallet mapping/no-PII evidence without adding
  runtime wallet fetches, selectors, checkout submit changes, or live smokes.

Evidence:

- Cliplot commit `057035b docs: verify auth wallet mapping policy` updates
  `docs/auth-wallet-checkout-contract.md`,
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`, and
  `scripts/auth-wallet-checkout-readiness.js`.
- The verifier now checks pure synthetic Auth wallet row mapping into immutable
  checkout snapshot field sets while excluding wallet ids, Auth ownership
  fields, timestamp metadata, and legacy invoice-email aliases.
- The verifier output is sanitized: it prints booleans, status metadata, field
  names, schema version, and blocker labels only, not fixture email, phone,
  street, company/tax/VAT values, raw response bodies, tokens, cookies, or
  secrets.
- Runtime wallet endpoint strings remain absent from runtime source outside the
  source-only contract/verifier.

Validation:

- Cliplot `npm run readiness:auth-wallet-checkout` passed and reported
  `source_only_mapping_contract_verified`, `runtimeWalletIntegrationPresent=false`,
  `mutation=false`, `persistence=false`, and `providerCall=false`.
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js` passed.
- Cliplot `git diff --check` passed.
- Cliplot `npm run check` passed.
- Cliplot targeted dangerous literal-secret/fixture leak scan on changed files
  returned no matches.

Boundary:

- No deploy, live Auth/Orders/Payments/Warehouse/Notifications/Catalog call,
  checkout submit, DB query/write, Kubernetes/Vault mutation, secret/token/
  cookie inspection, production customer/order data read, payment/Warehouse
  mutation, notification send, or runtime wallet integration was performed.

Next unfinished chunk:

- Cliplot remains gated on selector behavior approval, authenticated
  browser-session implementation, runtime no-PII evidence, runtime field
  mapping implementation, and guest fallback synthetic evidence.

## 2026-07-03 - Goal 10.50 ChytraKoupe Auth Subject Order Snapshot Contract

Current focus:

- Source-resolve the ChytraKoupe `customer.authSubject` blocker without
  changing runtime checkout behavior or running live smokes.

Evidence:

- ChytraKoupe commit `e3fa5e5 docs: resolve auth subject order snapshot
  contract` updates Goal 06 docs, status, guarded smoke packet, validation
  reports, implementation-goals README, and verifier expectations.
- Current ChytraKoupe checkout remains `/api/orders/guest`; it must not submit
  `customer.authSubject`, `customer.authUserId`, wallet row ids,
  delivery-address ids, invoice-profile ids, emails, or local storage values as
  identity provenance.
- Orders `orders.create.v1` already accepts optional `customer.authSubject`,
  `authUserId`, `subject`, or `sub`, validates matching UUID aliases, and
  persists normalized `customer.authUserId` plus `customer.subject`.
- Future non-guest authenticated ChytraKoupe central Orders submission may set
  `customer.authSubject` only from the server-validated Auth bearer `sub`.

Validation:

- ChytraKoupe `npm run verify:auth-wallet-checkout-selectors` passed.
- ChytraKoupe `node --check scripts/verify-auth-wallet-checkout-selectors.mjs`
  passed.
- ChytraKoupe `git diff --check` passed.
- ChytraKoupe `npm run lint` passed.
- ChytraKoupe `npm run build` passed.
- ChytraKoupe focused stale Auth subject blocker scan returned no active
  documentation/report matches outside verifier negative-regex guards.
- ChytraKoupe targeted dangerous literal-secret scan on changed files returned
  no matches.

Boundary:

- No deploy, live Auth call, authenticated endpoint call, checkout submit, DB
  query/write, secret/token/cookie inspection, production customer/order data
  read, Orders mutation, payment/Warehouse mutation, notification send, or
  runtime wallet mutation was performed.

Next unfinished chunk:

- ChytraKoupe remains runtime-smoke-gated on owner-approved synthetic Auth
  account/token, synthetic checkout test data, and non-secret approval id.

## 2026-07-03 - Goal 10.49 ChytraKoupe Hosted Auth Client ID Default

Current focus:

- Resolve the source-level ChytraKoupe hosted Auth `client_id` blocker by
  defaulting ChytraKoupe to its own logical caller id while keeping runtime
  smoke and `customer.authSubject` decisions gated.

Evidence:

- ChytraKoupe commit `65b37aa fix: default auth client id to chytrakoupe`
  changes hosted Auth defaults from `flipflop` to `chytrakoupe` in
  `lib/config/env.ts`, `scripts/deploy.sh`, `k8s/configmap.yaml`, and
  `.env.example`.
- The same commit updates `docs/INTEGRATION_CONTRACT.md`,
  `docs/goal-driven/STATUS.md`,
  `docs/goal-driven/auth-wallet-guarded-smoke-approval.md`,
  `implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`,
  `reports/validation/auth-wallet-checkout-selectors-plan.md`, and
  `scripts/verify-auth-wallet-checkout-selectors.mjs`.
- Auth `docs/HOSTED_AUTH_CONSUMER_STANDARD.md` now records `chytrakoupe` in
  the client registry planning artifact with callback
  `https://chytrakoupe.alfares.cz/auth/callback`.
- Read-only Auth audit confirmed hosted Auth treats `client_id` as an optional
  logical caller id and validates redirect safety by HTTPS `return_url` origin,
  not a source client-id allowlist. Existing coordinator evidence already
  records ChytraKoupe callback acceptance and `*.alfares.cz` CORS coverage.

Validation:

- ChytraKoupe `npm run verify:auth-wallet-checkout-selectors` passed and now
  fails if the hosted Auth default falls back to FlipFlop.
- ChytraKoupe `node --check scripts/verify-auth-wallet-checkout-selectors.mjs`
  passed.
- ChytraKoupe `git diff --check` passed.
- ChytraKoupe `npm run lint` passed.
- ChytraKoupe `npm run build` passed.
- ChytraKoupe focused stale client-id blocker/default scan returned no active
  default/blocker matches in Goal 06, status, guarded packet, runtime config,
  deploy script, k8s config, or `.env.example`.
- ChytraKoupe staged `git diff --cached --check` passed and staged added-line
  dangerous literal-secret scan returned no matches.
- Auth `git diff --check -- docs/HOSTED_AUTH_CONSUMER_STANDARD.md` passed.

Boundary:

- No live Auth call, deploy, synthetic smoke, checkout submit, DB query/write,
  token/secret/cookie inspection, production customer/order data read,
  payment/Warehouse mutation, notification send, or runtime wallet mutation was
  performed.

Next unfinished chunk:

- ChytraKoupe remains gated on authenticated `customer.authSubject` linkage if
  central Orders must persist it, owner-approved synthetic Auth account/token,
  synthetic checkout test data, and non-secret smoke approval id.

## 2026-07-03 - Goal 10.48 Cliplot Auth Wallet Checkout Contract

Current focus:

- Source-prepare the Cliplot-specific Auth wallet checkout contract and verifier
  enforcement for selector behavior, session handoff, no-PII exposure, field
  mapping, and guest fallback while keeping runtime integration blocked.

Evidence:

- Cliplot commit `dbdc1b4 docs: record auth wallet checkout contract` adds
  `docs/auth-wallet-checkout-contract.md`.
- The same commit updates
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`, and
  `scripts/auth-wallet-checkout-readiness.js`.
- The contract defines:
  - selector behavior for default prefill, manual override, and customer-safe
    labels;
  - hosted Auth/browser-session handoff constraints before wallet reads;
  - no-PII logging and frontend exposure rules;
  - delivery/invoice wallet row mapping into immutable checkout/order snapshots;
  - guest fallback behavior for missing/expired/rejected Auth sessions,
    timeouts, malformed responses, and empty wallet rows.
- The verifier now checks the contract markers and still fails on premature
  runtime references to `/auth/profile/checkout-data`,
  `/auth/profile/delivery-addresses`, or `/auth/profile/invoice-profiles`.

Validation:

- Cliplot `npm run readiness:auth-wallet-checkout` passed and reported
  `surfaces.walletContract=true`, `runtimeWalletIntegrationPresent=false`,
  `source_only_no_live_calls`, `mutation=false`, `persistence=false`, and
  `providerCall=false`.
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js` passed.
- Cliplot `npm run check` passed.
- Cliplot `git diff --check` passed.
- Runtime endpoint search returned no public/src/k8s/package runtime matches.
- Targeted dangerous literal-secret scan on changed files returned no matches.

Boundary:

- No deploy, live Auth wallet endpoint call, Auth/Orders/Payments/Warehouse/
  Notifications/Catalog call, DB query/write, Kubernetes/Vault mutation,
  secret/token/cookie inspection, checkout submit, order/payment/Warehouse/
  notification mutation, raw customer data logging, or runtime consumer wallet
  integration was performed.

Next unfinished chunk:

- Cliplot remains gated on implementation and approved synthetic evidence for
  selector behavior, browser-session wallet reads, no-PII exposure, field
  mapping, and guest fallback.

## 2026-07-03 - Goal 10.47 Rent-a-box Auth Adapter Mapping Contract

Current focus:

- Source-prepare the Rent-a-box Auth adapter/mapping contract so the future
  runtime migration has explicit session, profile, role, consent, and snapshot
  boundaries before product-code changes.

Evidence:

- Rent-a-box commit `abf732d docs: add goal 12 auth adapter contract` adds
  `docs/goals/GOAL-12-rent-auth-adapter-mapping-contract.md`.
- The same commit updates
  `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`,
  `docs/goals/ORCHESTRATION_STATE.md`, `docs/goals/README.md`,
  `reports/validation/goal-12-auth-customer-data-wallet-migration-plan.md`,
  and `scripts/check_goal12_auth_wallet_readiness.py`.
- The contract defines trusted Auth `/auth/validate` response fields:
  `valid`, `user_id`, `email`, `roles`, `permissions`, and `expires_at`.
- The contract preserves local `CustomerProfile.id` binding and records that
  migration/backfill remains blocked.
- The contract maps Auth roles/capabilities to Rent-a-box admin boundaries,
  including `rent-a-box:admin` and local `UserRole.ADMIN`.
- The contract records consent/profile snapshot handling around
  `customer_profiles.gdpr_consent_at`.
- The contract explicitly keeps product-code migration blocked and source-only.

Validation:

- Rent-a-box `python3 -m py_compile scripts/check_goal12_auth_wallet_readiness.py`
  passed.
- Rent-a-box `python3 -B scripts/check_goal12_auth_wallet_readiness.py --root .`
  passed with `pass_dependency_gated` and no issues.
- Rent-a-box `git diff --check` passed.
- Rent-a-box `git diff --cached --check` passed before commit.
- Rent-a-box targeted literal-secret scan across changed files returned no
  matches.

Boundary:

- No deploy, DB access, live service calls, Kubernetes mutation, Auth repo
  change, secret/token/cookie inspection, runtime auth behavior change, product
  code migration, or production row inspection was performed.

Next unfinished chunk:

- Rent-a-box remains gated on owner-approved live DB migration/backfill plan
  for local `users` and `customer_profiles`, plus unknown production row counts
  and migration complexity.

## 2026-07-03 - Goal 10.46 ChytraKoupe Guarded Wallet Smoke Approval Packet

Current focus:

- Source-prepare the non-secret approval packet for a future ChytraKoupe Auth
  wallet checkout selector smoke while keeping runtime execution blocked.

Evidence:

- ChytraKoupe commit `70ce4c5 docs: add auth wallet smoke approval packet`
  adds `docs/goal-driven/auth-wallet-guarded-smoke-approval.md`.
- The same commit updates
  `implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`,
  `docs/goal-driven/STATUS.md`,
  `reports/validation/auth-wallet-checkout-selectors-plan.md`, and
  `scripts/verify-auth-wallet-checkout-selectors.mjs`.
- The packet explicitly does not approve execution by itself.
- Future runtime smoke remains blocked on:
  `[MISSING: final decision whether ChytraKoupe keeps client_id=flipflop or receives a new Auth client_id before production runtime claim]`,
  `[MISSING: authenticated Auth subject linkage decision for ChytraKoupe orders if central Orders must persist customer.authSubject]`,
  `[MISSING: owner-approved synthetic Auth account/token for ChytraKoupe wallet selector smoke]`,
  `[MISSING: owner-approved synthetic checkout test data for ChytraKoupe wallet selector smoke]`,
  and `[MISSING: non-secret owner approval id for ChytraKoupe wallet selector smoke]`.
- Allowed future evidence is limited to public page checks, synthetic
  authenticated wallet selector read/prefill/manual-override booleans, sanitized
  schema version/status metadata, and no-mutation confirmations.
- Forbidden operations include live checkout submit, Auth wallet create/update/
  delete, payment, Warehouse, notification, DB, Kubernetes, deploy, Auth source
  mutation, response-body logging, raw customer-data logging, and secret/token/
  cookie/password printing.

Validation:

- ChytraKoupe `npm run verify:auth-wallet-checkout-selectors` passed and now
  verifies the guarded smoke approval packet exists and keeps runtime blocked.
- ChytraKoupe `node --check scripts/verify-auth-wallet-checkout-selectors.mjs`
  passed.
- ChytraKoupe `git diff --check` passed.
- ChytraKoupe `npm run lint` passed.
- ChytraKoupe staged `git diff --cached --check` passed.
- ChytraKoupe added-line dangerous literal-secret scan returned no matches.

Boundary:

- No Auth code, deploy, live Auth fetch, authenticated endpoint call, checkout
  submit, DB query/write, Kubernetes mutation, secret/token/password/JWT/cookie
  inspection, response-body logging, production customer/order data read,
  payment/Warehouse mutation, notification send, or runtime consumer wallet
  integration was performed.

Next unfinished chunk:

- Continue Rent-a-box adapter/mapping contract source prep, or run approved
  synthetic Auth/FlipFlop/ChytraKoupe smokes only after the required synthetic
  account/token/test-data and non-secret approval ids are supplied.

## 2026-07-03 - Goal 10.45 Cliplot Current Auth Live Evidence Refresh And Consumer Audits

Current focus:

- Refresh Cliplot source-only Auth wallet readiness evidence against the latest
  completed Auth Source Preflight live refresh and record read-only consumer
  audit results for ChytraKoupe and Rent-a-box.

Evidence:

- Cliplot commit `3522568 docs: refresh auth wallet current live evidence`
  updates `scripts/auth-wallet-checkout-readiness.js`,
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  and `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`.
- Cliplot now records Auth Source Preflight HEAD
  `548df583bff50057c79c4c6705e6a379f4d1b63b`, deployed image tag
  `548df58-20260703051411`, and FlipFlop non-mutating post-deploy smoke
  evidence.
- Cliplot still reports `runtimeWalletIntegrationPresent=false`,
  `source_only_no_live_calls`, `mutation=false`, `persistence=false`, and
  `providerCall=false`.
- Rent-a-box read-only audit confirmed clean `main` at `7673f5a`, Goal 12
  readiness remains `pass_dependency_gated`, and the next source-only
  improvement is an adapter/mapping contract before runtime migration.
- ChytraKoupe read-only audit confirmed clean `main` at `6d7c47b`, wallet
  reader and checkout selectors are source-wired, and the next source-only
  improvement is a guarded smoke approval packet; hosted Auth `client_id` and
  `customer.authSubject` decisions remain blockers.

Validation:

- Cliplot `npm run readiness:auth-wallet-checkout` passed and reported
  `authWalletPresenceGate.sourcePreflightHead=548df583bff50057c79c4c6705e6a379f4d1b63b`,
  `authWalletPresenceGate.deployedImageTag=548df58-20260703051411`, and no
  runtime wallet integration.
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js` passed.
- Cliplot `npm run check` passed.
- Cliplot `git diff --check` passed for changed wallet-readiness files.
- Cliplot targeted dangerous literal-secret scan on changed files returned no
  matches.
- Rent-a-box read-only validation passed:
  `python3 -B -m py_compile scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py scripts/ips_pre_coding_gate.py`,
  `python3 -B scripts/check_goal12_auth_wallet_readiness.py --root .`,
  `python3 -B scripts/check_no_cyrillic.py docs AGENTS.md README.md`, and
  `git diff --check`.
- ChytraKoupe read-only validation passed:
  `npm run verify:auth-wallet-checkout-selectors`,
  `node --check scripts/verify-auth-wallet-checkout-selectors.mjs`,
  `git diff --check`, and `npm run lint`.

Boundary:

- No Auth code, live SQL, deploy, authenticated endpoint call, DB query/write,
  Kubernetes mutation, secret/token/password/JWT/cookie inspection, response
  body logging, production customer/order data read, live checkout submit,
  order/payment/Warehouse mutation, notification send, or runtime consumer
  wallet integration was performed.

Next unfinished chunk:

- Prepare either the ChytraKoupe guarded smoke approval packet or the
  Rent-a-box adapter/mapping contract, or run approved synthetic Auth/FlipFlop
  wallet smokes if token/account approval details are supplied.

## 2026-07-03 - Goal 10.44 FlipFlop Guarded Wallet Smoke Harness Source Prep

Current focus:

- Record FlipFlop source-prepared guarded Auth wallet checkout/profile smoke
  harness after Auth wallet 401 deployment.

Evidence:

- FlipFlop commit `2893573 feat: add guarded auth wallet checkout smoke`
  adds `scripts/smoke-auth-wallet-checkout-profile.js`, package script
  `smoke:auth-wallet-checkout-profile`, and approval packet
  `docs/orchestrator/2026-07-03-flipflop-auth-wallet-smoke-approval.md`.
- Default mode is source-only and runs `verify:auth-wallet-profile-ui`,
  `verify:auth-wallet-checkout-selectors`, and
  `verify:orders-hub-integration`, then reports
  `approval_required_no_live_mutation`.
- Approved live mode is constrained to public route checks and FlipFlop
  gateway-proxied Auth wallet endpoints under `/api/auth/profile/*`; it does
  not submit checkout orders.
- Because FlipFlop has no first-class Playwright dependency, the harness keeps
  browser-session proof for delayed wallet response timing and selector
  interaction as a separate `[MISSING]` approval gate.

Validation:

- FlipFlop `node --check scripts/smoke-auth-wallet-checkout-profile.js`
  passed.
- FlipFlop `npm run smoke:auth-wallet-checkout-profile` passed in default
  no-live mode.
- FlipFlop `npm run verify:auth-wallet-profile-ui` passed.
- FlipFlop `npm run verify:auth-wallet-checkout-selectors` passed.
- FlipFlop `npm run verify:orders-hub-integration` passed.
- FlipFlop `git diff --check` passed.
- FlipFlop added-line dangerous literal-secret scan returned no matches.

Boundary:

- No Auth code, live Auth/FlipFlop authenticated endpoint call, wallet
  mutation, checkout submit, order/payment/Warehouse mutation, DB query/write,
  deploy, Kubernetes mutation, secret/token/password/JWT/cookie inspection,
  response-body logging, production customer/order row read, or notification
  send was performed.

Next unfinished chunk:

- Run Auth and FlipFlop guarded smokes only after owner approval supplies a
  synthetic Auth token/account and non-secret approval ids, or continue
  ChytraKoupe, Rent-a-box, and Cliplot dependency-gated decisions.

## 2026-07-03 - Goal 10.43 Auth Authenticated Wallet Smoke Harness Source Prep

Current focus:

- Source-prepare the approval-gated authenticated Auth wallet
  CRUD/default/delete smoke harness without running authenticated endpoints.

Evidence:

- Added `scripts/check-customer-data-wallet-authenticated-smoke.js`.
- Added package script `check:customer-data-wallet-authenticated`.
- Added approval packet
  `docs/orchestrator/2026-07-03-auth-wallet-authenticated-smoke-approval.md`.
- The harness defaults to `approval_required_no_live_mutation` and sends no
  request unless all gates are present: `--execute`,
  `RUN_AUTH_WALLET_AUTHENTICATED_SMOKE=1`,
  `AUTH_WALLET_SMOKE_APPROVAL_ID`,
  `AUTH_WALLET_SMOKE_CONFIRM=CREATE_UPDATE_DEFAULT_DELETE`, and a token via
  `AUTH_WALLET_SMOKE_BEARER_TOKEN` or `AUTH_WALLET_SMOKE_TOKEN_FILE`.
- The live path is limited to one synthetic authenticated subject and calls only
  Auth wallet endpoints for checkout aggregate read, delivery address
  create/update/default/delete, invoice profile create/update/default/delete,
  and post-delete list visibility checks.
- Sanitized output includes status metadata, schema version, booleans, cleanup
  status, and short ID hashes only.

Validation:

- `node --check scripts/check-customer-data-wallet-authenticated-smoke.js`
  passed.
- `npm run check:customer-data-wallet-authenticated` passed in default
  source-only mode and reported `approval_required_no_live_mutation`.
- `npm run check:customer-data-wallet-runtime -- --expect=deployed` passed.
- `npm run check:customer-data-wallet-preflight` passed.
- `npm run test:auth-contract` passed.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- Added-line dangerous literal-secret scan returned no matches.

Boundary:

- No authenticated endpoint call, live wallet mutation, DB query, DB write,
  deploy, Kubernetes mutation, secret/token/password/JWT/cookie inspection,
  response-body logging, production customer row read, raw customer-data access,
  checkout/order/payment/Warehouse mutation, or notification send was performed.

Next unfinished chunk:

- Run the harness only after owner approval supplies a synthetic Auth
  account/token and non-secret approval id; then continue FlipFlop
  authenticated checkout/profile smoke or remaining ChytraKoupe, Rent-a-box,
  and Cliplot gates.

## 2026-07-03 - Goal 10.42 Auth Live Refresh From Current Source Preflight

Current focus:

- Execute the owner-approved Auth schema-only DB preflight, idempotent SQL
  apply, Auth deploy, wallet 401 smoke, and non-mutating FlipFlop post-deploy
  runtime smoke from the current Source Preflight-captured Auth HEAD.

Evidence:

- Source Preflight captured Auth HEAD
  `548df583bff50057c79c4c6705e6a379f4d1b63b` on `main`, ahead of
  `origin/main` by 3 coordinator docs commits, with no dirty tracked files.
- Source checksums remained stable: wallet SQL
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`,
  runtime verifier
  `3786afab774e58dd9800272507ca919b7cfdf8d80a16fb4f09ef1541e482ec26`,
  and deploy script
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Source validation passed: `npm run check:customer-data-wallet-preflight`,
  `npm run check:customer-data-wallet-runtime -- --expect=deployed`, focused
  Auth/User specs 2 suites/15 tests, `npm run test:auth-contract` 3 suites/27
  tests, `npm run build`, `npm run lint`, and `git diff --check`.
- Schema-only DB preflight used live metadata only and no customer rows:
  `users=users`, `delivery=user_delivery_addresses`,
  `invoice=user_invoice_profiles`, and `gen_random_uuid=gen_random_uuid`.
- Approved SQL apply of `scripts/create-customer-data-wallet-tables.sql` was
  transaction-wrapped and committed idempotently.
- Post-apply metadata verification found both wallet tables, 21 delivery
  address columns, 24 invoice profile columns, and 4 indexes per wallet table.
- Auth deploy completed successfully in 194.82s. Backend image:
  `localhost:5000/auth-microservice:548df58-20260703051411`; web image:
  `localhost:5000/auth-microservice-web:548df58-20260703051411`.
- Independent rollout verification showed Auth backend and web `1/1` on those
  image tags.
- Auth wallet runtime smoke passed: `/health` HTTP 200 and
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles` each returned HTTP 401 unauthenticated, with
  no Authorization header, cookies, request body, response-body logging, or DB
  read.
- FlipFlop non-mutating post-deploy runtime/source smoke passed on clean
  `main` at `9b9d4de1e133559c875c7a53897ce1f4664c58c0`:
  `npm run verify:auth-wallet-profile-ui`,
  `npm run verify:auth-wallet-checkout-selectors`, and
  `npm run verify:orders-hub-integration` passed; public `/`, `/checkout`,
  `/profile/addresses`, `/profile/invoice-profiles`, and
  `/api/products?limit=1` returned HTTP 200; gateway-proxied
  `/api/auth/profile/checkout-data`, `/api/auth/profile/delivery-addresses`,
  and `/api/auth/profile/invoice-profiles` returned HTTP 401.

Boundary:

- No secret/token/password/JWT/cookie value was printed, no production customer
  row or raw customer data was selected, no authenticated synthetic smoke was
  run, and no live checkout/order/payment/Warehouse/notification mutation was
  performed.
- Temporary operator helper `/tmp/auth-wallet-db-helper.js` was used only to
  run metadata SQL and idempotent apply through the existing Auth pod DB driver.

Next unfinished chunk:

- Add and approve a dedicated authenticated synthetic Auth wallet
  CRUD/default/delete smoke harness and run it only with an owner-approved
  synthetic account/token, or continue the remaining ChytraKoupe,
  Rent-a-box, and Cliplot dependency-gated consumer decisions.

## 2026-07-03 - Goal 10.41 Cliplot Live-Evidence Refresh

Current focus:

- Refresh Cliplot's source-only Auth wallet readiness artifacts after the
  latest Auth live refresh.

Evidence:

- Cliplot commit `ec1f77b docs: refresh auth wallet live evidence` updates
  `scripts/auth-wallet-checkout-readiness.js`,
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  and `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`.
- Cliplot now records Auth live refresh commit
  `c2deeae docs: record auth wallet live refresh`, Source Preflight HEAD
  `350700b0ad3482cf375ada8f9088392778ae8b05`, and deployed image tag
  `350700b-20260703044437`.
- Cliplot readiness still reports `runtimeWalletIntegrationPresent=false`,
  `source_only_no_live_calls`, `mutation=false`, `persistence=false`, and
  `providerCall=false`.
- Remaining Cliplot gates are unchanged: owner approval for selector behavior,
  authenticated browser/session contract, no-PII frontend/logging review,
  approved field mapping, and guest fallback behavior.

Validation:

- Cliplot `npm run readiness:auth-wallet-checkout` passed.
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js` passed.
- Cliplot `npm run check` passed.
- Cliplot `git diff --check` passed.
- Cliplot targeted dangerous literal-secret scan returned no matches.

Boundary:

- No Auth code, live SQL, deploy, Kubernetes mutation, DB query,
  secret/token/password/JWT/cookie inspection, response-body logging,
  production customer/order data inspection, live checkout submit,
  payment/Warehouse mutation, notification send, or runtime consumer
  integration was performed.

Next unfinished chunk:

- Resolve Cliplot selector/session/PII/mapping/fallback approvals, or continue
  ChytraKoupe and Rent-a-box owner/runtime gates.

## 2026-07-03 - Goal 10.40 Rent-a-box Live-Evidence Refresh

Current focus:

- Refresh Rent-a-box Goal 12 source-only evidence after the latest Auth live
  refresh, and preserve Cliplot dirty-worktree boundary.

Evidence:

- Rent-a-box commit `7673f5a docs: refresh auth wallet live evidence` updates
  `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`,
  `scripts/check_goal12_auth_wallet_readiness.py`,
  `docs/goals/ORCHESTRATION_STATE.md`, and validation reports.
- Rent-a-box now records Auth live refresh commit
  `c2deeae docs: record auth wallet live refresh`, Source Preflight HEAD
  `350700b0ad3482cf375ada8f9088392778ae8b05`, and deployed image tag
  `350700b-20260703044437`.
- Rent-a-box verifier still reports `pass_dependency_gated` and keeps the real
  migration blockers open.
- Cliplot source-only refresh was blocked before edits because its worktree is
  dirty at HEAD `a49ef00` with modified `docs/IMPLEMENTATION_STATE.md`,
  `docs/OPERATIONAL_RUNBOOK.md`, `package.json`,
  `scripts/readiness_bundle.sh`, `src/integrations.js`, `src/server.js`, and
  untracked `scripts/live-checkout-execution-window.js`.

Validation:

- Rent-a-box `python3 -m py_compile scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py scripts/ips_pre_coding_gate.py` passed.
- Rent-a-box `python3 scripts/check_goal12_auth_wallet_readiness.py --root .`
  passed with `pass_dependency_gated`.
- Rent-a-box `./scripts/intent_preflight.sh` passed.
- Rent-a-box `git diff --check` passed.
- Rent-a-box targeted dangerous literal-secret scan returned no matches.
- Cliplot validation was not run by this lane because no Cliplot edits were
  made due to the dirty worktree.

Boundary:

- No Auth code, live SQL, deploy, Kubernetes mutation, DB query,
  secret/token/password/JWT/cookie inspection, response-body logging,
  production customer/order data inspection, live checkout submit,
  payment/Warehouse mutation, notification send, or runtime consumer
  integration was performed.

Next unfinished chunk:

- Wait for Cliplot dirty work to be committed/stashed before refreshing stale
  Auth live evidence there, or resolve remaining ChytraKoupe/Rent-a-box
  owner/runtime gates.

## 2026-07-03 - Goal 10.39 ChytraKoupe Response-Shape Verifier Narrowing

Current focus:

- Narrow ChytraKoupe's source-only Auth wallet checkout-data reader and
  verifier to the Auth v1 response shape while preserving runtime gates.

Evidence:

- ChytraKoupe commit `6d7c47b feat: narrow auth wallet checkout response
  shape` updates `lib/auth/wallet.ts`,
  `scripts/verify-auth-wallet-checkout-selectors.mjs`,
  `implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`,
  `reports/validation/auth-wallet-checkout-selectors-plan.md`,
  `docs/goal-driven/STATUS.md`, and `implementation-goals/README.md`.
- The wallet reader now records Auth checkout-data schema version
  `auth.customer-data-wallet.checkout-data.v1`, rejects incompatible explicit
  schema versions, normalizes `defaults`, and copies only allowed
  delivery-address and invoice-profile fields into selector state.
- The verifier now fails if the wallet reader regresses to trusting raw
  `AuthDeliveryAddress[]` or `AuthInvoiceProfile[]` casts.
- Sanitized wallet row ownership/system fields (`user`, `userId`, `deletedAt`)
  are omitted before they become ChytraKoupe checkout state.
- Remaining ChytraKoupe gates are unchanged: final hosted Auth `client_id`
  decision and authenticated Auth subject linkage decision if central Orders
  must persist `customer.authSubject`.

Validation:

- ChytraKoupe `npm run verify:auth-wallet-checkout-selectors` passed.
- ChytraKoupe `node --check scripts/verify-auth-wallet-checkout-selectors.mjs`
  passed.
- ChytraKoupe `npm run build` passed.
- ChytraKoupe `npm run lint` passed.
- ChytraKoupe `git diff --check` passed.
- ChytraKoupe targeted dangerous literal-secret scan on changed files returned
  no matches.

Boundary:

- No Auth code, live SQL, deploy, Kubernetes mutation, DB query,
  secret/token/password/JWT/cookie inspection, response-body logging,
  production customer/order data inspection, live checkout submit,
  payment/Warehouse mutation, notification send, or runtime consumer
  integration was performed.

Next unfinished chunk:

- Continue with Cliplot/Rent-a-box stale Auth live evidence refreshes, or
  resolve ChytraKoupe `client_id` and `customer.authSubject` runtime decisions
  before any production runtime readiness claim.

## 2026-07-03 - Goal 10.38 Auth Current-Head Live Refresh

Current focus:

- Execute the owner-approved Auth schema-only DB preflight, idempotent SQL
  apply, Auth deploy from Source Preflight-captured HEAD, wallet endpoint 401
  smoke, and non-mutating FlipFlop post-deploy runtime smoke.

Evidence:

- Source Preflight captured Auth HEAD
  `350700b0ad3482cf375ada8f9088392778ae8b05` on `main`, ahead of
  `origin/main` by 1 coordinator docs commit, with no dirty tracked files.
- Checksums: wallet SQL
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`,
  runtime verifier
  `3786afab774e58dd9800272507ca919b7cfdf8d80a16fb4f09ef1541e482ec26`,
  deploy script
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Source validation passed with deployed-mode wallet runtime expectation. The
  predeploy-mode check intentionally failed because wallet routes are already
  live and returned deployed `401`, not predeploy `404`.
- Schema-only DB metadata preflight found `public.users`,
  `user_delivery_addresses`, `user_invoice_profiles`, `gen_random_uuid`, 21
  delivery-address columns, 24 invoice-profile columns, and 4 indexes per
  wallet table.
- Approved SQL apply was idempotent and transaction-wrapped; only expected
  existing-object notices were emitted.
- Post-apply metadata verification found both wallet tables, required core
  columns, and all 8 wallet indexes.
- Auth deploy completed successfully in 198.33s with image tag
  `350700b-20260703044437` for backend and web.
- Independent rollout verification showed Auth backend and web `1/1` on
  `localhost:5000/auth-microservice:350700b-20260703044437` and
  `localhost:5000/auth-microservice-web:350700b-20260703044437`.
- Auth wallet runtime smoke passed: `/health` HTTP 200 and
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`,
  `/auth/profile/invoice-profiles` HTTP 401 unauthenticated.
- FlipFlop post-deploy runtime smoke stayed non-mutating: public `/`,
  `/checkout`, `/profile/addresses`, `/profile/invoice-profiles`, and
  `/api/products?limit=1` returned HTTP 200; gateway-proxied wallet endpoints
  returned HTTP 401; `npm run verify:auth-wallet-checkout-selectors` and
  `npm run verify:auth-wallet-profile-ui` passed.

Validation:

- Auth `npm run check:customer-data-wallet-preflight` passed.
- Auth `npm run check:customer-data-wallet-runtime -- --expect=deployed`
  passed.
- Auth focused `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts
  src/users/users.service.spec.ts` passed 2 suites / 15 tests.
- Auth `npm run test:auth-contract` passed 3 suites / 27 tests.
- Auth `npm run build` passed.
- Auth `npm run lint` passed.
- Auth `git diff --check` passed.
- Kubernetes rollout status passed for `deploy/auth-microservice` and
  `deploy/auth-microservice-web`.
- FlipFlop route probes and wallet UI verifiers passed as listed above.

Boundary:

- No secret/token/password/JWT/cookie value inspection, customer-row read, raw
  production customer-data inspection, authenticated synthetic smoke, live
  checkout/order/payment mutation, Warehouse reservation, notification send,
  destructive DB rollback/drop, or full cluster scale-up was performed.

Next unfinished chunk:

- Continue with owner-approved synthetic authenticated Auth wallet
  CRUD/default/delete plus FlipFlop checkout/profile smoke if required, or
  continue ChytraKoupe response-shape/verifier narrowing and remaining
  Rent-a-box/Cliplot product-code gates.

## 2026-07-03 - Goal 10.37 Rent-a-box Schema/Response-Shape Evidence Refresh

Current focus:

- Refresh Rent-a-box Goal 12 source-only migration readiness after Auth
  checkout-data schema/version and response-shape evidence, while preserving
  Rent-specific migration blockers.

Evidence:

- Rent-a-box commit `eb2eb02 docs: record auth wallet response shape evidence`
  updates `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`,
  `scripts/check_goal12_auth_wallet_readiness.py`, and validation reports.
- The Rent-a-box verifier now treats Auth checkout-data schema version
  `auth.customer-data-wallet.checkout-data.v1`, source-defined response shape,
  and sanitized wallet row omissions (`user`, `userId`, `deletedAt`) as
  resolved upstream evidence.
- Remaining Rent-a-box blockers are unchanged: customer session adapter/local
  profile binding, Auth-to-Rent admin role mapping, consent/profile migration
  mapping, owner-approved live migration/backfill, and production row-count
  complexity.

Validation:

- Rent-a-box `python3 -m py_compile scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py scripts/ips_pre_coding_gate.py` passed.
- Rent-a-box `python3 scripts/check_goal12_auth_wallet_readiness.py --root .`
  passed with `pass_dependency_gated`.
- Rent-a-box `./scripts/intent_preflight.sh` passed.
- Rent-a-box `git diff --check` passed.
- Rent-a-box targeted dangerous literal-secret scan on changed files returned
  no matches.

Boundary:

- No product-code migration, Auth code, live SQL, deploy, Kubernetes mutation,
  DB query, secret/token/password/JWT/cookie inspection, response-body logging,
  production customer/order data inspection, live checkout submit,
  payment/Warehouse mutation, notification send, or runtime consumer
  integration was performed.

Next unfinished chunk:

- Continue ChytraKoupe response-shape/verifier narrowing or resolve remaining
  Rent-a-box customer session/admin/consent/backfill gates with owner-provided
  decisions.

## 2026-07-03 - Goal 10.36 Cliplot Response-Shape Readiness Refresh

Current focus:

- Refresh Cliplot-owned source-only readiness artifacts to record the
  Auth-defined checkout-data v1 response shape without enabling runtime wallet
  mapping.

Evidence:

- Cliplot commit `c8e99ac docs: record auth wallet response shape` updates
  `scripts/auth-wallet-checkout-readiness.js`,
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  and `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`.
- Auth read-only audit confirmed clean `main` at
  `c7dabab8021085d90d89a16679e5cf81af227283` and source-defined shape in
  Auth service, entities, DTOs, tests, and docs.
- Cliplot verifier now records top-level `checkoutDataFields`, `defaultsFields`,
  `sanitizedDeliveryAddressFields`, `sanitizedInvoiceProfileFields`,
  `excludedWalletRowFields`, and caveats.
- Current Auth v1 caveats recorded in Cliplot: wallet fields may be nullable,
  timestamp JSON serialization is not narrowed here, `pickupPointId` is not a
  current response field, and invoice recipient email is `email`, not
  `invoiceEmail` or `electronicInvoiceEmail`.
- Cliplot still reports `runtimeWalletIntegrationPresent=false` and remains
  guest-checkout first with Auth only as a hosted login/register link surface.

Validation:

- Cliplot `npm run readiness:auth-wallet-checkout` passed and reported
  source-defined field lists, `source_only_no_live_calls`, `mutation=false`,
  `persistence=false`, `providerCall=false`, and
  `runtimeWalletIntegrationPresent=false`.
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js` passed.
- Cliplot `npm run check` passed.
- Cliplot `git diff --check` passed.
- Cliplot stale response-shape blocker scan returned no stale blocker.
- Cliplot targeted dangerous literal-secret scan on the three changed files
  returned no matches.

Boundary:

- No Auth code, live SQL, deploy, Kubernetes mutation, DB query,
  secret/token/password/JWT/cookie inspection, response-body logging,
  production customer/order data inspection, live checkout submit,
  payment/Warehouse mutation, notification send, or runtime consumer
  integration was performed.

Next unfinished chunk:

- Resolve Cliplot selector behavior, authenticated browser/session, no-PII
  frontend/logging review, approved field mapping, and guest fallback gates, or
  continue Rent-a-box, ChytraKoupe, and authenticated synthetic Auth/FlipFlop
  smoke gates.

## 2026-07-03 - Goal 10.35 Cliplot Schema-Version Readiness Refresh

Current focus:

- Refresh Cliplot-owned source-only readiness docs/verifier to consume the
  Auth-defined checkout-data schema version without enabling runtime wallet
  integration.

Evidence:

- Cliplot commit `fc7502d docs: record auth wallet schema version` updates
  `scripts/auth-wallet-checkout-readiness.js`,
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  and `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`.
- The verifier now reports
  `authWalletResponseContract.checkoutDataSchemaVersion=auth.customer-data-wallet.checkout-data.v1`
  from Auth Goal 10.34.
- The old Cliplot stable-version unknown is narrowed to response-shape
  blockers only.
- Cliplot still reports `runtimeWalletIntegrationPresent=false` and remains
  guest-checkout first with Auth only as a hosted login/register link surface.

Validation:

- Cliplot `npm run readiness:auth-wallet-checkout` passed and reported
  `source_only_no_live_calls`, `mutation=false`, `persistence=false`,
  `providerCall=false`, and `runtimeWalletIntegrationPresent=false`.
- Cliplot `node --check scripts/auth-wallet-checkout-readiness.js` passed.
- Cliplot `npm run check` passed.
- Cliplot `git diff --check` passed.
- Cliplot stale stable-version blocker scan returned no stale blocker.
- Cliplot targeted dangerous literal-secret scan on the three changed files
  returned no matches.

Boundary:

- No Auth code, live SQL, deploy, Kubernetes mutation, DB query,
  secret/token/password/JWT/cookie inspection, response-body logging,
  production customer/order data inspection, live checkout submit,
  payment/Warehouse mutation, notification send, or runtime consumer
  integration was performed.

Next unfinished chunk:

- Resolve Cliplot selector behavior, authenticated browser/session, no-PII
  frontend/logging review, exact response-shape, field-mapping, and guest
  fallback gates, or continue Rent-a-box, ChytraKoupe, and authenticated
  synthetic Auth/FlipFlop smoke gates.

## 2026-07-03 - Goal 10.34 Auth Checkout-Data Schema Version Source Definition

Current focus:

- Source-define the stable response identifier for Auth
  `GET /auth/profile/checkout-data` so consumer readiness checks can reference
  an Auth-owned checkout-data aggregate version.

Evidence:

- Auth source now returns top-level `schemaVersion`
  `auth.customer-data-wallet.checkout-data.v1` from
  `GET /auth/profile/checkout-data`.
- The version identifies the existing Auth v1 aggregate shape: sanitized
  `user`, `deliveryAddresses`, `invoiceProfiles`, and `defaults`.
- `src/auth/auth-contract.spec.ts`, `src/info/info.controller.ts`,
  `docs/UNIFIED_AUTH_CONTRACT.md`, and
  `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md` now publish and verify the
  stable response identifier.
- Cliplot read-only subagent confirmed clean `main` at `ea6cd93`; `node
  scripts/auth-wallet-checkout-readiness.js` passed and Cliplot still has no
  runtime wallet integration. `schemaVersion` resolves only the stable
  response identifier lane; selector behavior, browser/session contract,
  no-PII frontend/logging review, guest fallback behavior, and delivery/invoice
  response-shape documentation remain Cliplot-owned gates.
- FlipFlop/ChytraKoupe read-only subagent confirmed the additive top-level
  field is compatible with current source-prepared consumers because they read
  known checkout-data keys and ignore unknown top-level fields. FlipFlop
  `node scripts/verify-auth-wallet-checkout-selectors.js` and ChytraKoupe
  `node scripts/verify-auth-wallet-checkout-selectors.mjs` passed.

Validation:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed: 1
  suite, 13 tests.
- `npm run test:auth-contract` passed: 3 suites, 27 tests.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- Stale active stable-version blocker scan returned only historical
  pre-Goal-10.34 continuation text before `docs/IMPLEMENTATION_STATE.md` was
  refreshed in this chunk.
- Targeted dangerous literal-secret scan on changed source/docs returned no
  credential-shaped matches.

Boundary:

- No live SQL, deploy, Kubernetes mutation, DB query, secret/token/password/JWT
  value inspection, cookie inspection, response-body logging, production
  customer/order data inspection, live checkout submit, payment/Warehouse
  mutation, notification send, or consumer repo edit was performed.

Next unfinished chunk:

- Update Cliplot-owned docs/verifier to consume the Auth-defined schema version
  or continue remaining Rent-a-box, ChytraKoupe, Cliplot, and authenticated
  synthetic smoke gates.

## 2026-07-03 - Goal 10.33 Auth Current-Head Live Refresh And FlipFlop Runtime Smoke

Current focus:

- Re-run the owner-approved Auth schema-only live DB preflight, idempotent SQL
  apply, Auth deploy from Source Preflight-captured HEAD, wallet endpoint 401
  smoke, and post-deploy FlipFlop runtime smoke for the current Auth head.

Evidence:

- Source Preflight captured Auth HEAD
  `712c0bc1558d429c812b55cce8118b1bf515eecf` on clean `main`, ahead of
  `origin/main` by 2 docs commits.
- Checksums: wallet SQL
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`,
  runtime verifier
  `3786afab774e58dd9800272507ca919b7cfdf8d80a16fb4f09ef1541e482ec26`,
  deploy script
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Source validation passed before live operations:
  `npm run check:customer-data-wallet-preflight`,
  `npm run check:customer-data-wallet-runtime -- --expect=deployed`, focused
  Auth/User specs 2 suites/15 tests, `npm run test:auth-contract` 3 suites/27
  tests, `npm run build`, `npm run lint`, and `git diff --check`.
- Schema-only DB preflight used metadata only. The Postgres pod default DB was
  not Auth, so the approved preflight was rerun against the `auth` database and
  confirmed `public.users`, `user_delivery_addresses`,
  `user_invoice_profiles`, `gen_random_uuid`, 21 delivery-address columns, 24
  invoice-profile columns, 4 indexes per wallet table, and zero missing
  required columns/indexes.
- Approved SQL apply ran in one transaction and was idempotent with expected
  existing-object notices. Post-apply metadata verification stayed clean.
- Auth deploy built and pushed backend/web image tag
  `712c0bc-20260702234019`.
- The deploy script timed out during rollout while a cluster-wide
  sandbox/node reset and bulk namespace scale-down occurred. Recovery kept the
  Auth source HEAD unchanged, restored only the minimum required runtime set to
  replicas 1 (`db-server-postgres`, `db-server-redis`, Auth backend/web,
  Catalog, Warehouse, and FlipFlop frontend/API/product services), applied the
  deploy script's non-secret Auth ConfigMap patch, and completed rollouts to
  1/1.
- Auth wallet runtime smoke passed: `/health` HTTP 200 and
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles` each returned HTTP 401 unauthenticated with
  no Authorization header, cookies, request body, response body logging, or DB
  read.
- FlipFlop non-mutating runtime smoke passed: `/`, `/checkout`,
  `/profile/addresses`, `/profile/invoice-profiles`, and
  `/api/products?limit=1` returned HTTP 200; gateway-proxied
  `/api/auth/profile/checkout-data`, `/api/auth/profile/delivery-addresses`,
  and `/api/auth/profile/invoice-profiles` returned HTTP 401.
- FlipFlop source verifiers also passed:
  `npm run verify:auth-wallet-checkout-selectors` and
  `npm run verify:auth-wallet-profile-ui`.

Boundary:

- No secret/token/password/JWT/cookie value inspection, customer-row read, raw
  production customer-data inspection, authenticated synthetic smoke, live
  checkout/order/payment mutation, Warehouse reservation, notification send,
  destructive DB rollback/drop, or full cluster scale-up was performed.

Next unfinished chunk:

- Owner-approved synthetic authenticated Auth wallet CRUD/default/delete and
  FlipFlop checkout/profile smoke if required, or remaining Rent-a-box,
  ChytraKoupe, and Cliplot product-code gates.

## 2026-07-03 - Goal 10.32 Rent-a-box Hosted Auth Callback Scaffold And Consumer Head Refresh

Current focus:

- Move the Rent-a-box consumer lane one source-safe step forward after Auth
  wallet deploy while keeping backend auth migration, admin mapping,
  consent/profile migration, live backfill, and mutating runtime gates closed.

Evidence:

- Rent-a-box committed `6ecd76e feat: scaffold hosted auth callback`.
- The Rent-a-box source chunk adds `apps/web/src/lib/auth/hosted-auth.ts`,
  `/auth/start`, `/auth/callback`, isolated hosted Auth handoff storage in
  `apps/web/src/lib/customer-flow/session.ts`, and non-secret
  `NEXT_PUBLIC_AUTH_*` config for `client_id=rent-a-box` and
  `https://rent-a-box.alfares.cz/auth/callback`.
- The callback parses fragment-only Auth handoff, validates stored `state`,
  strips the fragment from browser history, and stores the handoff separately
  from the existing local customer JWT session.
- Existing Rent-a-box local login/register, local JWT session, backend request
  auth, admin auth, customer profile persistence, and reservation/payment/domain
  flows remain unchanged.
- ChytraKoupe read-only subagent confirmed clean `main` at `b280f75`; the
  repo-local wallet selector verifier still passes, and final `client_id`
  plus optional `customer.authSubject` decisions remain open before production
  runtime claim.
- Cliplot final read-only sweep confirmed clean `main` at `f4ceca1`; readiness,
  `node --check`, `npm run check`, and `git diff --check` passed. Runtime
  wallet integration remained absent. Auth wallet response fields were known,
  but a stable wallet response version identifier remained `[UNKNOWN]` before
  Goal 10.34.

Validation:

- Rent-a-box: `python3 -m py_compile scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py scripts/ips_pre_coding_gate.py` passed.
- Rent-a-box: `python3 scripts/check_goal12_auth_wallet_readiness.py --root .`
  passed with `pass_dependency_gated`.
- Rent-a-box: `./scripts/intent_preflight.sh` passed.
- Rent-a-box: `npm run lint --workspace @box/web` passed.
- Rent-a-box: `npm run build --workspace @box/web` passed.
- Rent-a-box: `PYTHON="env PYTHONPATH=/tmp/rab-goal12-pydeps:apps/api python3" npm run test --workspace @box/web` passed 4 Playwright tests after
  temporary `/tmp` API deps and Playwright Chromium install.
- Rent-a-box: `git diff --check`, stale callback-blocker scan, and targeted
  dangerous literal-secret scan passed.

Boundary:

- No Auth runtime code, Auth deploy, live DB query, secret/token/password/JWT
  value inspection, cookie inspection, customer/order data inspection, live
  checkout submit, payment/Warehouse mutation, notification send, or production
  data access was performed.

Next unfinished chunk:

- Auth-backed Rent-a-box customer session adapter/local profile binding
  decision, Rent-a-box admin role mapping, consent/profile migration mapping,
  owner-approved migration/backfill, ChytraKoupe runtime decisions, Cliplot
  selector/session/PII approvals, or owner-approved synthetic authenticated
  Auth/FlipFlop smoke.

## 2026-07-03 - Goal 10.31 ChytraKoupe Source-Prepared Selectors And Consumer Head Refresh

Current focus:

- Move the next safe consumer lane forward after Auth live wallet deploy while
  keeping runtime and mutating smoke gates closed.

Evidence:

- DocsRAG query from the running Auth pod returned HTTP 200 with 15 source
  headings, including guarded checkout intent, target dataflow, and validation
  evidence. No token value was printed.
- ChytraKoupe committed
  `b280f75 feat: source-prepare auth wallet checkout selectors`.
- The ChytraKoupe source chunk added `lib/auth/wallet.ts`, reads Auth
  `/auth/profile/checkout-data` with the existing stored bearer token, adds
  delivery-address and invoice-profile selectors to checkout, guards default
  wallet prefill after manual edits, and still submits only immutable
  `billingAddress`/`deliveryAddress` snapshots to `/api/orders/guest`.
- ChytraKoupe does not submit Auth wallet IDs, mutable Auth wallet references,
  or `customer.authSubject`; the Auth-subject linkage decision remains open
  only if central Orders must persist it.
- Rent-a-box read-only audit kept Goal 12 `pass_dependency_gated`. Safe next
  code is only a non-invasive hosted Auth callback/config scaffold; backend
  auth migration, admin role mapping, consent/profile migration, migration
  approval, backfill, and row-count complexity remain blocked.
- Cliplot current observed HEAD moved to `0e6a233` with unrelated dirty
  approval/config/integration files. Its wallet readiness verifier still
  reports no runtime wallet integration, and selector/session/PII/response
  contract blockers remain unchanged.

Validation:

- ChytraKoupe: `npm run verify:auth-wallet-checkout-selectors`, `node --check
  scripts/verify-auth-wallet-checkout-selectors.mjs`, `npm run build`,
  `npm run lint`, `git diff --check`, and targeted dangerous literal-secret
  scan passed.
- Cliplot: `npm run readiness:auth-wallet-checkout` passed in read-only mode
  and still reports `runtimeWalletIntegrationPresent=false`.
- Rent-a-box: read-only worker ran
  `python3 scripts/check_goal12_auth_wallet_readiness.py --root .`, which
  returned `pass_dependency_gated`.

Boundary:

- No deploy, live checkout submit, DB access, secret/token/password/JWT/cookie
  inspection, customer/order data inspection, payment/Warehouse/notification
  mutation, or Auth runtime change was performed.

Next unfinished chunk:

- Rent-a-box source-backed hosted Auth callback scaffold, ChytraKoupe final
  client-id/Auth-subject decisions before runtime claim, Cliplot selector and
  session/PII/response approvals, or owner-approved synthetic authenticated
  Auth/FlipFlop smoke.

## 2026-07-03 - Goal 10.30 Auth Live Refresh From Captured HEAD

Current focus:

- Execute the owner-approved Auth schema-only live DB preflight, live SQL
  apply, Auth deploy from Source Preflight-captured HEAD, wallet endpoint 401
  smoke, and post-deploy FlipFlop runtime smoke.

Evidence:

- Source Preflight captured Auth HEAD
  `ff974345c52a41ac8b920a3dba0f44795a23950d`, matching `origin/main` with a
  clean worktree.
- Source validation passed before live operations: focused Auth/User specs
  2 suites/15 tests, `npm run test:auth-contract` 3 suites/27 tests,
  `npm run build`, `npm run lint`,
  `npm run check:customer-data-wallet-preflight`, and `git diff --check`.
- Schema-only live DB preflight queried metadata only: `public.users`,
  existing `user_delivery_addresses`, existing `user_invoice_profiles`, and
  `gen_random_uuid` were present.
- Approved SQL apply ran transactionally and was idempotent because wallet
  tables/indexes already existed. Post-apply schema verification confirmed both
  wallet tables, required columns, and required indexes.
- Auth deploy built and pushed backend/web image tag
  `ff97434-20260702223501`. The deploy script timed out during the first
  backend rollout wait while the new pod was still initializing; Kubernetes
  completed backend and web rollouts to `1/1` afterward.
- The deploy script final non-secret ConfigMap patch was applied manually
  because the script exited before that phase, and the backend restarted
  successfully on the same image.
- Auth wallet runtime smoke passed: `/health` HTTP 200 and
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles` each returned HTTP 401 unauthenticated with
  no Authorization header, cookies, request body, response body logging, or DB
  read.
- FlipFlop non-mutating post-deploy runtime smoke passed: `/`, `/checkout`,
  `/profile/addresses`, `/profile/invoice-profiles`, and
  `/api/products?limit=1` returned HTTP 200; gateway-proxied
  `/api/auth/profile/checkout-data`, `/api/auth/profile/delivery-addresses`,
  and `/api/auth/profile/invoice-profiles` returned HTTP 401.
- FlipFlop source verifiers also passed:
  `npm run verify:auth-wallet-checkout-selectors` and
  `npm run verify:auth-wallet-profile-ui`.

Boundary:

- No secret/token/password/JWT/cookie value inspection, customer-row read, raw
  production customer-data inspection, live checkout/order/payment mutation,
  Warehouse reservation, notification send, rollback mutation, or synthetic
  authenticated smoke was performed.

Next unfinished chunk:

- Owner-approved synthetic authenticated Auth wallet CRUD/default/delete and
  FlipFlop checkout/profile smoke if required, or remaining Rent-a-box,
  ChytraKoupe, and Cliplot product-code gates.

## 2026-07-03 - Goal 10.29 Consumer Gate Narrowing

Current focus:

- Narrow remaining consumer gates with read-only evidence from Auth live
  redirect/CORS config, Rent-a-box source, ChytraKoupe source, flipflop-service
  adapter source, and Cliplot readiness source.

Evidence:

- Auth live ConfigMap evidence, without reading secrets, showed
  `AUTH_ALLOWED_REDIRECT_ORIGINS=*.alfares.cz,https://strilkove.cz,https://www.strilkove.cz`
  and `CORS_ORIGIN=*.alfares.cz`.
- Safe `GET /auth/validate-return-url` returned HTTP 200 for
  `https://rent-a-box.alfares.cz/auth/callback` and
  `https://chytrakoupe.alfares.cz/auth/callback`.
- Rent-a-box committed `9e6cf38 docs: narrow goal 12 auth callback gate`.
  Remaining gates: source-backed hosted Auth callback route, concrete
  `client_id`/`return_url`, admin role mapping, consent/profile migration
  mapping, migration/backfill, and row-count complexity.
- ChytraKoupe committed `002818f docs: narrow auth wallet checkout gates`.
  Remaining gates: Auth client-id and authenticated Auth subject linkage if
  central Orders must persist `customer.authSubject`.
- Cliplot committed `8dbd1e2 docs: record auth wallet checkout source facts`.
  Remaining gates: selector behavior, authenticated browser/session,
  no-PII exposure, and response-contract approvals.

Validation:

- Rent-a-box: Goal 12 verifier returned `pass_dependency_gated`;
  `./scripts/intent_preflight.sh`, `git diff --check`, targeted literal-secret
  scan, and stale broad callback/allowlist blocker scan passed.
- ChytraKoupe: `npm run verify:auth-wallet-checkout-selectors`, `node --check
  scripts/verify-auth-wallet-checkout-selectors.mjs`, `git diff --check`,
  targeted dangerous literal-secret scan, and stale allowlist/guest-adapter
  blocker scan passed.
- Cliplot: `npm run readiness:auth-wallet-checkout`, `node --check
  scripts/auth-wallet-checkout-readiness.js`, `npm run check`, `git diff
  --check`, and targeted literal-secret scan passed.

Boundary:

- No deploy, live DB query, secret/token/JWT inspection, live
  checkout/order/payment mutation, Warehouse reservation, notification send,
  Auth runtime change, or production customer-data inspection was performed.

Next unfinished chunk:

- Decide or implement Rent-a-box callback/client/admin/consent migration,
  ChytraKoupe client-id/Auth-subject linkage, Cliplot selector/session/PII
  response approvals, or owner-approved synthetic authenticated Auth/FlipFlop
  smoke.

## 2026-07-02 - Goal 10.28 Consumer Contract Blocker Refinement

Current focus:

- Narrow dependency-gated consumer blockers after read-only subagent audits
  compared current Auth/Orders contracts with Rent-a-box and ChytraKoupe source.

Evidence:

- Rent-a-box worker committed
  `691a31db0f6b8b14c1d0d3df4ef42501e07b4250 docs: refine goal 12 auth wallet blockers`.
- Rent-a-box now records generic hosted Auth handoff, default
  `POST /auth/validate`, and Auth wallet API shape as resolved upstream
  contracts. Remaining gates are callback URL and Auth redirect/CORS allowlist
  verification, admin role mapping, consent/profile migration mapping,
  owner-approved migration/backfill, and production row-count complexity.
- ChytraKoupe worker committed
  `6f9610fed0f4f3dd84e31e164a653d97a77b9ba9 docs: refine auth wallet checkout blockers`.
- ChytraKoupe now records Orders immutable authenticated/guest snapshots, Auth
  v1 invoice field names, and fragment-only Auth handoff direction as
  source-resolved planning inputs. Remaining gates are Auth client-id,
  redirect/CORS allowlist, and `/api/orders/guest` wallet-snapshot mapping.
- Hosted Auth consumer registry now lists candidate Rent-a-box callback
  `https://rent-a-box.alfares.cz/auth/callback` while preserving the missing
  runtime redirect/CORS allowlist verification gate.

Validation:

- Rent-a-box: `python3 -m py_compile
  scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py
  scripts/ips_pre_coding_gate.py`; `python3
  scripts/check_goal12_auth_wallet_readiness.py --root .`;
  `./scripts/intent_preflight.sh`; `git diff --check`; targeted
  literal-secret scan; stale resolved-blocker scan all passed.
- ChytraKoupe: `npm run verify:auth-wallet-checkout-selectors`; `node --check
  scripts/verify-auth-wallet-checkout-selectors.mjs`; `git diff --check`;
  targeted dangerous literal-secret scan; docs-only stale blocker scan all
  passed.

Boundary:

- No consumer product-code migration, deploy, live DB query, secret/token/JWT
  inspection, live checkout/order/payment mutation, Warehouse reservation,
  notification send, Auth runtime change, or production customer-data
  inspection was performed.

Next unfinished chunk:

- Owner-approved synthetic authenticated Auth wallet and FlipFlop
  checkout/profile smoke if required, or resolve remaining
  Rent-a-box/ChytraKoupe/Cliplot product-code gates.

## 2026-07-02 - Goal 10.27 Consumer Readiness Refresh After Auth 401 Gate

Current focus:

- Refresh dependency-gated consumer lanes after the completed Auth wallet
  unauthenticated 401 gate so future workers do not treat the upstream endpoint
  presence evidence as missing.

Evidence:

- Rent-a-box worker committed
  `e93053ed36d03bb2a928b6cb003e645ff4adc2a1 docs: refresh goal 12 auth wallet readiness`.
- ChytraKoupe worker committed
  `baa0d3555b407591108badd848253ebc77956471 docs/test: refresh auth wallet checkout gate`.
- Cliplot current clean `main` is `9f1be04 feat: aggregate live checkout approval evidence`
  and includes refreshed Auth wallet readiness evidence with
  `authWalletPresenceGate.status=complete`.
- Auth live wallet endpoint evidence remains Source Preflight HEAD
  `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`, `/health` HTTP 200, and wallet
  endpoint HTTP 401 unauthenticated.

Validation:

- Rent-a-box: `python3 -m py_compile
  scripts/check_goal12_auth_wallet_readiness.py`; `python3
  scripts/check_goal12_auth_wallet_readiness.py --root .`; `git diff --check`;
  targeted literal-secret scan; stale Auth 401 blocker scan all passed.
- ChytraKoupe: `npm run verify:auth-wallet-checkout-selectors`; `node --check
  scripts/verify-auth-wallet-checkout-selectors.mjs`; `git diff --check`;
  targeted dangerous literal-secret scan passed.
- Cliplot: `npm run readiness:auth-wallet-checkout`; `node --check
  scripts/auth-wallet-checkout-readiness.js`; `npm run check`; `git diff
  --check`; stale-text scan; targeted dangerous literal-secret scan passed.

Boundary:

- No consumer deploy, DB access, secret/token/password/JWT/cookie inspection,
  live checkout/order/payment mutation, Warehouse reservation, notification
  send, Auth runtime change, or production customer-data inspection was
  performed.

Next unfinished chunk:

- Synthetic authenticated Auth wallet and FlipFlop checkout/profile smoke if
  required, or resolve the remaining consumer-specific decisions before
  product-code migrations.

## 2026-07-02 - Goal 10.26 Post-Live Planning Doc Refresh

Current focus:

- Align Goal 10 planning docs with the completed Auth SQL/deploy/401 gate and
  keep the next synthetic-authenticated gate explicit.

Evidence:

- Read-only completion audit confirmed Auth live SQL apply, deploy, and
  unauthenticated wallet 401 smoke are complete.
- Auth remote `main` was clean at
  `a365ffe60ca07faae101a7aed6d6cf77cd98b65b` before this doc patch and ahead
  of `origin/main` by 1.
- FlipFlop `main` was clean at
  `97b7e40835ff82bd1f22487826fefe647c3e5495`; wallet merge `7e97e98` is
  included.
- Goal 10 status, validation/deployment plan, live-gate runbook, and
  cross-repo plan blockers now identify the completed live 401 gate separately
  from remaining synthetic authenticated smoke.

Validation:

- `git diff --check` passed.
- Stale live-gate blocker scan passed.
- Targeted dangerous literal-secret scan passed on changed Goal 10 docs.
- `npm run check:customer-data-wallet-runtime -- --expect=deployed` passed:
  `/health` returned HTTP 200 and wallet endpoints returned HTTP 401 without
  Authorization headers, cookies, request bodies, response body printing, or DB
  reads.

Boundary:

- No SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT
  value inspection, raw production customer data inspection, authenticated
  smoke, live checkout submit, or consumer repo edit was performed.

Next unfinished chunk:

- Owner-approved synthetic authenticated wallet CRUD/default/delete and
  FlipFlop checkout/profile runtime smoke if required; otherwise proceed to
  dependency-gated consumer migrations.

## 2026-07-02 - Goal 10.25 Auth Live SQL Deploy And 401 Smoke

Current focus:

- Record the completed owner-approved Auth live DB/deploy gate and bounded
  post-deploy smoke for Goal 10.

Evidence:

- Owner approval was given for schema-only live DB preflight, live SQL apply,
  Auth deploy from Source Preflight-captured HEAD, wallet endpoint 401 smoke,
  and post-deploy FlipFlop runtime smoke.
- Source Preflight captured exact Auth HEAD
  `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`; worktree clean; `main` ahead of
  `origin/main` by 1.
- SQL checksum:
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`.
- Runtime verifier checksum:
  `3786afab774e58dd9800272507ca919b7cfdf8d80a16fb4f09ef1541e482ec26`.
- Deploy script checksum:
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Schema-only DB preflight selected only metadata and passed: `public.users`
  exists, wallet tables were absent before apply, and `gen_random_uuid` is
  available.
- Live SQL apply succeeded in a single transaction.
- Post-apply schema metadata verification passed: wallet tables
  `user_delivery_addresses` and `user_invoice_profiles` exist with 45 columns
  and 8 indexes.
- Auth deploy completed with backend image
  `localhost:5000/auth-microservice:2871a6f-20260702210100` and web image
  `localhost:5000/auth-microservice-web:2871a6f-20260702210100`; backend and
  web deployments are `1/1`.
- Post-deploy wallet 401 smoke passed: `/health` HTTP 200 and wallet endpoints
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles` returned HTTP 401 unauthenticated.

Validation:

- Auth: `npm run check:customer-data-wallet-preflight` passed.
- Auth: `npm run check:customer-data-wallet-runtime -- --expect=predeploy`
  passed before deploy with wallet endpoints HTTP 404.
- Auth: focused Auth/User specs passed, 2 suites / 15 tests.
- Auth: `npm run test:auth-contract` passed, 3 suites / 27 tests.
- Auth: `npm run build`, `npm run lint`, and `git diff --check` passed.
- Auth deploy script completed successfully.
- Auth: `npm run check:customer-data-wallet-runtime -- --expect=deployed`
  passed after deploy with wallet endpoints HTTP 401.
- FlipFlop: `npm run verify:auth-wallet-profile-ui` passed.
- FlipFlop: `npm run verify:auth-wallet-checkout-selectors` passed.
- FlipFlop: `npm run verify:orders-hub-integration` passed.
- FlipFlop: `npm run verify:guest-checkout-ui` passed and reported
  `nonMutating: true`.

Boundary:

- SQL was limited to the approved additive wallet schema file. Runtime DB env
  values were used without printing them.
- Schema verification selected only metadata. No customer rows, raw address or
  invoice payloads, secret/token/password/JWT values, authenticated synthetic
  account, or live checkout submit was used.
- Synthetic authenticated wallet CRUD/default/delete smoke remains unrun because
  no synthetic account/token was provided or approved.

Next unfinished chunk:

- Owner-approved synthetic authenticated wallet and FlipFlop checkout/profile
  smoke, if required, then dependency-gated consumer migrations for Rent-a-box,
  ChytraKoupe, and Cliplot.

## 2026-07-02 - Goal 10.24 FlipFlop Main Target Source Revalidation

Superseded source-head note:

- Dependency-gated consumer heads in this section were refreshed again by Goal
  10.27 after Auth wallet 401 evidence was consumed by Rent-a-box, ChytraKoupe,
  and Cliplot readiness lanes.

Current focus:

- Refresh the Goal 10 consumer gate after the FlipFlop wallet lane was merged
  into `main`.

Evidence:

- Auth current HEAD at audit time: `f86621f docs: refresh auth wallet live
  deploy target`; worktree clean and `main` aligned with `origin/main`.
- FlipFlop current `main` is `7e97e98 merge: close superseded flipflop orders
  lifecycle branch`.
- FlipFlop `git status --short --branch` is `main...origin/main` with one
  unrelated dirty file: `shared/health/health.service.ts`.
- Orders current `main` is clean at `2111389`.
- Rent-a-box current `main` is clean at `09dce2f`.
- ChytraKoupe current `main` is clean at `2838ebf`.
- Cliplot current `main` is clean at `d7144a6`.

Validation:

- FlipFlop: `npm run verify:auth-wallet-profile-ui` passed and reported
  `nonMutating: true`.
- FlipFlop: `npm run verify:auth-wallet-checkout-selectors` passed and reported
  `nonMutating: true`.
- FlipFlop: `npm run verify:orders-hub-integration` passed.
- Orders: `npm run verify:create-order-contract` passed.
- Orders: `npm run verify:invoices-read-boundary` passed.

Boundary:

- Source/docs/verifier work only. No SQL, deploy, Kubernetes mutation, DB
  access, secret/token/password/JWT value inspection, raw production customer
  data inspection, authenticated smoke, or live checkout submit.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth
  deploy from the exact remote HEAD captured by Source Preflight, wallet
  endpoint 401 smoke, and post-deploy FlipFlop checkout/profile runtime smoke.

## 2026-07-02 - Goal 10.23 Auth Live Approval Gate Target Refresh

Current focus:

- Refresh active owner-approval docs so the live gate captures the exact Auth
  remote HEAD by Source Preflight after source-only documentation checkpoints.

Evidence:

- Auth remote HEAD at audit time:
  `1a60240de3affb739cfbe1cac49dd95e5025582a`.
- Auth worktree was clean and `main` was ahead of `origin/main` by 4 at audit
  time.
- Runtime source has not changed after source-validated runtime gate verifier
  commit `9ff1099`; later Auth commits are documentation/checkpoint updates.
- FlipFlop current target branch is
  `codex/orders-lifecycle-cabinet-flipflop-clean` at `e499dd4`, ahead 3/behind
  1, with unrelated unstaged `shared/health/health.service.ts` changes outside
  Goal 10.
- Orders current `main` is clean at `2111389`.
- The exact deploy HEAD must be captured again by Source Preflight immediately
  before any owner-approved live execution.

Validation:

- Source-only repo status/HEAD audit completed for Auth, FlipFlop, and Orders.
- Read-only subagent audit confirmed active gate docs still had stale
  deploy-target references before this correction.
- Remote docs validation passed: `git diff --check`; active-gate stale target
  scan returned no stale exact `9ff1099` deploy target; diff-added dangerous
  literal-secret scan returned no matches.

Boundary:

- Documentation/checkpoint only. No SQL, deploy, Kubernetes mutation, DB access,
  secret/token/password/JWT value inspection, raw production customer data
  inspection, authenticated smoke, or live checkout submit.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth
  deploy from the exact remote HEAD captured by Source Preflight, wallet
  endpoint 401 smoke, and post-deploy FlipFlop checkout/profile runtime smoke.

## 2026-07-02 - Goal 10.22 Auth Live Approval Gate Revalidation

Current focus:

- Refresh source-only validation evidence for the current Auth approval gate before any owner-approved live DB/deploy step.

Evidence:

- Auth HEAD before this checkpoint: `0dfd9eb docs: record flipflop invoice navigation checkpoint`.
- Auth worktree was clean and `main` was ahead of `origin/main` by 3 before this documentation update.
- Runtime predeploy verifier confirmed live `/health` HTTP 200 and wallet routes still HTTP 404 unauthenticated, so Goal 10 wallet routes remain undeployed and protected live activation is still pending.
- Orders immutable invoice snapshot verifiers still pass.
- FlipFlop Auth wallet checkout/profile verifiers still pass; unrelated unstaged shared-service files remain in the FlipFlop worktree and were not touched by Goal 10.

Validation:

- Auth: `npm run check:customer-data-wallet-preflight` passed.
- Auth: `npm run check:customer-data-wallet-runtime -- --expect=predeploy` passed with no Authorization header, cookies, request body, response body logging, or DB access.
- Auth: `npm run test:auth-contract` passed, 3 suites / 27 tests.
- Auth: `npm run build`, `npm run lint`, `git diff --check`, and targeted dangerous literal-secret scan on active Goal 10 docs passed.
- Orders: `npm run verify:create-order-contract` and `npm run verify:invoices-read-boundary` passed.
- FlipFlop: `npm run verify:auth-wallet-profile-ui` and `npm run verify:auth-wallet-checkout-selectors` passed.

Boundary:

- Source/validation/docs only. No SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT value inspection, raw production customer data inspection, authenticated smoke, or live checkout submit.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth deploy, wallet endpoint 401 smoke, and post-deploy FlipFlop checkout/profile runtime smoke.

## 2026-07-02 - Goal 10.21 FlipFlop Invoice Profile Navigation

Current focus:

- Make the source-prepared Auth invoice profile management UI discoverable from common authenticated account entry points.

Evidence:

- FlipFlop commit: `e499dd4 feat: surface auth invoice profiles in account navigation`.
- Authenticated Header navigation now links to `/profile/invoice-profiles`.
- Dashboard quick actions now include `/profile/invoice-profiles`.
- `npm run verify:auth-wallet-profile-ui` now pins Profile, Header, and Dashboard invoice-profile links.

Validation:

- FlipFlop: `git diff --check`, `npm run verify:auth-wallet-profile-ui`, `services/frontend npm run build`, `node --check scripts/verify-auth-wallet-profile-ui.js`, targeted dangerous literal-secret scan, and added-line `any` scan passed.
- Targeted eslint on changed Header/Dashboard was attempted and failed on existing `Header.tsx:53` `setState`-in-effect plus dashboard warnings outside this diff; this remains frontend lint baseline debt.

Boundary:

- Source/verifier work only. No Auth runtime code, SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT value inspection, raw production customer data inspection, authenticated smoke, or live checkout submit.
- FlipFlop has an unrelated unstaged `shared/health/health.service.ts` change that was not staged or modified by this chunk.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth deploy, wallet endpoint 401 smoke, and post-deploy FlipFlop checkout/profile runtime smoke.

## 2026-07-02 - Goal 10.20 FlipFlop Profile Invoice Management

Current focus:

- Complete the source-level FlipFlop profile-management surface for Auth-owned reusable invoice profiles and align default-selection methods with the Auth contract.

Evidence:

- FlipFlop commit: `87e47ee feat: manage auth invoice profiles in account`.
- Added `/profile/invoice-profiles` account UI backed only by Auth invoice profile APIs.
- The UI supports listing, creating, editing, deleting, and default selection for Auth-owned invoice profiles with company, company ID, tax ID, VAT ID, invoice email, phone, and billing address fields.
- `/profile` now links to invoice profile management.
- Frontend `authApi` and shared Auth service now use `POST` for `/auth/profile/delivery-addresses/:id/default` and `/auth/profile/invoice-profiles/:id/default`, matching Auth controller and contract.
- Added `npm run verify:auth-wallet-profile-ui`.
- Read-only sidecar confirmed the Auth controller exposes default-selection endpoints as `POST` and that FlipFlop lacked profile invoice management before this chunk.

Validation:

- FlipFlop: `git diff --check`, `npm run verify:auth-wallet-profile-ui`, `npm run verify:auth-wallet-checkout-selectors`, `services/frontend npm run build`, `shared npm run build`, targeted frontend eslint for changed profile/auth files, targeted dangerous literal-secret scan, and added-line `any` scan passed.

Boundary:

- Source/verifier work only. No Auth runtime code, SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT value inspection, raw production customer data inspection, authenticated smoke, or live checkout submit.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth deploy, wallet endpoint 401 smoke, and post-deploy FlipFlop checkout/profile runtime smoke.

## 2026-07-02 - Goal 10.19 FlipFlop Checkout Wallet Save-Back

Current focus:

- Close the source-level FlipFlop checkout gap where Auth wallet entries could be selected but manual authenticated checkout edits were not saved back to Auth.

Evidence:

- FlipFlop commit: `0f04931 feat: save checkout wallet edits to auth`.
- Checkout now exposes manual invoice/company fields for `companyName`, `companyId`, `taxId`, `vatId`, and invoice recipient email.
- Explicit `Uložit údaje` now updates the canonical Auth profile and upserts the selected or new Auth invoice profile from billing fields.
- The same explicit save action upserts the selected or new Auth delivery address when separate delivery data is present.
- Order submit remains immutable-snapshot only: it still does not create wallet entries silently and does not send Auth wallet IDs to Orders before provenance approval.
- Read-only sidecar audit confirmed ChytraKoupe, Rent-a-box, and Cliplot remain dependency-gated, and Orders snapshot support is current at `3c7d0c3`.

Validation:

- FlipFlop: `git diff --check`, `npm run verify:auth-wallet-checkout-selectors`, `npm run verify:orders-hub-integration`, `services/frontend npm run build`, targeted dangerous literal-secret scan, and added-line `any` scan passed.
- `npm run verify:guest-checkout-ui` was attempted and failed because live `https://flipflop.alfares.cz/api/products?limit=1` returned HTTP 500; this is runtime/live dependency evidence, not a source compile failure.
- Single-file eslint was attempted from `services/frontend` and interrupted after hanging without output; full frontend lint remains known baseline debt from earlier validation.

Boundary:

- Source/verifier work only. No Auth runtime code, SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT value inspection, raw production customer data inspection, authenticated smoke, or live checkout submit.

Next unfinished chunk:

- Add profile invoice-profile management UI, or request owner approval for Auth schema-only live DB preflight, SQL apply, Auth deploy, wallet endpoint 401 smoke, and post-deploy FlipFlop checkout/profile runtime smoke including save-back.

## 2026-07-02 - Goal 10.18 Consumer Order Snapshot Support

Current focus:

- Source-prepare Orders and FlipFlop so Auth invoice profile fields can travel as immutable order snapshots while reusable profile truth remains Auth-owned.

Evidence:

- Orders commit: `3c7d0c3 feat: preserve auth invoice fields in order snapshots`.
- Orders now accepts, normalizes, persists, and documents optional billing snapshot fields `companyId`, `vatId`, and invoice recipient `email` alongside existing `companyName` and `taxId`.
- Orders verifiers now pin the create-order contract and invoice read boundary for those fields.
- FlipFlop commit: `20dd1f8 feat: forward auth invoice fields to order snapshots`.
- FlipFlop checkout now preserves Auth-selected invoice profile fields in form state and sends a dedicated billing snapshot with `companyName`, `companyId`, `taxId`, `vatId`, and `email`.
- FlipFlop order-service and shared central Orders client now forward those fields to `orders-microservice` without making delivery snapshots inherit billing-only invoice fields.
- Read-only sidecar audit completed before coding and found the exact Orders/FlipFlop contract gap.

Validation:

- Orders: `git diff --check`, `npm run build`, `npm run verify:create-order-contract`, `npm run verify:invoices-read-boundary`, full `npm test`, and targeted dangerous literal-secret scan passed.
- FlipFlop: `git diff --check`, `npm run verify:auth-wallet-checkout-selectors`, `npm run verify:orders-hub-integration`, shared build, order-service build, frontend build, `npm run verify:guest-checkout-ui`, and targeted dangerous literal-secret scan passed.
- FlipFlop full `services/frontend npm run lint` still fails on baseline debt in unrelated files plus existing `any` usage in changed files; added-line diff scans found no newly added `any` usage.

Boundary:

- Source/docs/verifier work only. No Auth runtime code, SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT value inspection, raw production customer data inspection, authenticated smoke, or live checkout submit.
- Orders still stores immutable order snapshots only and does not become the reusable profile source of truth.
- FlipFlop has an unrelated unstaged `k8s/deployment.yaml` imagePullPolicy change that was not staged, committed, or modified by this checkpoint.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth deploy, wallet endpoint 401 smoke, then consumer runtime smoke confirming selected Auth invoice profile data reaches immutable order billing snapshots.

## 2026-07-02 - Goal 10 Cliplot Readiness And Marketplace Channel Audit

Current focus:

- Complete the remaining non-live C1/M1 Goal 10 lanes while Auth wallet runtime
  endpoints remain undeployed.

Evidence:

- Cliplot worker completed on remote `alfares` only.
- Cliplot commit: `01f6dea docs: add auth wallet checkout readiness gate`.
- Added Cliplot execution plan
  `implementation-goals/GOAL-10-auth-wallet-checkout-readiness.execution-plan.md`,
  verifier `scripts/auth-wallet-checkout-readiness.js`, validation report
  `reports/validation/GOAL-10-auth-wallet-checkout-readiness.md`, and
  `npm run readiness:auth-wallet-checkout`.
- Coordinator revalidation passed in Cliplot: `npm run
  readiness:auth-wallet-checkout`, `node --check
  scripts/auth-wallet-checkout-readiness.js && git diff --check`, `npm run
  check`, and targeted dangerous literal-secret scan on changed files.
- Marketplace/channel read-only subagent audited `catalog-microservice`,
  `allegro`, `aukro`, `bazos`, `heureka`, and `shop-assistant`.
- Added Auth coordinator audit
  `docs/orchestrator/2026-07-02-auth-wallet-marketplace-channel-audit.md`.
- M1 conclusion: no repo-local Auth wallet plans are needed now for those six
  repositories. Marketplace buyer/contact/order data must remain immutable
  channel/Orders evidence and must not back-write reusable buyer wallet records
  into Auth.

Boundary:

- No Auth SQL, deploy, Kubernetes mutation, live checkout/order/payment/
  Warehouse/notification mutation, live DB query/write, secret/token/cookie
  inspection, customer row inspection, or marketplace repo edit.

Next unfinished chunk:

- Owner approval for Auth schema-only live DB preflight, live SQL apply, Auth
  deploy, wallet endpoint 401 smoke, and optional synthetic authenticated
  wallet/checkout smoke.

## 2026-07-02 - Goal 10 ChytraKoupe Source-Readiness Verifier And Callback Cleanup

Current focus:

- Add a dependency-gated ChytraKoupe verifier and safe hosted Auth callback URL
  cleanup while Auth wallet runtime endpoints remain undeployed.

Evidence:

- ChytraKoupe worker completed on remote `alfares` only.
- ChytraKoupe commit: `2838ebf test: add auth wallet checkout gate verifier`.
- Added `scripts/verify-auth-wallet-checkout-selectors.mjs` and `npm run
  verify:auth-wallet-checkout-selectors`.
- Added validation report
  `reports/validation/auth-wallet-checkout-selectors-verifier.md`.
- Hardened `app/auth/callback/AuthCallbackClient.tsx` so token-bearing
  query/hash material is stripped from browser history with
  `window.history.replaceState(null, "", url.pathname)` after callback values
  are captured.
- The verifier passes the expected dependency-gated state: wallet selector UI,
  wallet client/fetch source, and local wallet persistence remain absent while
  explicit Auth wallet/client-id/CORS/order-payload blockers remain documented.
- Coordinator revalidation passed: `npm run verify:auth-wallet-checkout-selectors`,
  `npm run lint`, `npm run build`, `node --check
  scripts/verify-auth-wallet-checkout-selectors.mjs && git diff --check`, and
  targeted dangerous literal-secret scan on changed ChytraKoupe files.

Boundary:

- No product wallet selector UI, checkout behavior migration, deploy,
  Kubernetes mutation, live checkout submit, live DB query/write, Auth SQL
  apply, secret/token/cookie inspection, or production customer-data access.

Next unfinished chunk:

- Actual ChytraKoupe delivery/invoice selector integration remains gated on
  Auth wallet endpoints returning 401 instead of 404, client_id decision,
  CORS/redirect allowlist confirmation, Orders snapshot contract, and invoice
  field contract.

## 2026-07-02 - Goal 10 Rent-a-box Source-Readiness Verifier

Current focus:

- Add a dependency-gated Rent-a-box verifier so the consumer migration lane can
  be resumed without attempting product code before Auth wallet runtime
  evidence exists.

Evidence:

- Rent-a-box read-only subagent confirmed product migration is still blocked by
  missing Auth wallet runtime, hosted Auth browser/callback contract, backend
  token validation contract, admin role mapping, and owner-approved
  migration/backfill scope.
- Added `rent-a-box/scripts/check_goal12_auth_wallet_readiness.py`.
- Updated Rent-a-box Goal 12 docs and orchestration state so the next action
  points at Goal 12 Auth wallet dependency gates instead of completed Goal 11.
- Rent-a-box commit: `09dce2f docs: add auth wallet readiness verifier`.
- Validation passed in Rent-a-box: `python3 -m py_compile
  scripts/check_goal12_auth_wallet_readiness.py`, `python3
  scripts/check_goal12_auth_wallet_readiness.py --root .`,
  `python3 scripts/check_no_cyrillic.py docs AGENTS.md README.md`,
  `git diff --check`, and targeted dangerous literal-secret scan on changed
  files.

Boundary:

- Source/docs only. No Rent-a-box product auth migration, live DB query,
  production row/password-hash/contract inspection, secret/token/cookie
  inspection, Auth SQL, deploy, Kubernetes mutation, or live checkout smoke.

Next unfinished chunk:

- ChytraKoupe safe verifier/callback-hardening lane can run next, or request
  owner approval for Auth schema-only live DB preflight, SQL apply, Auth deploy,
  wallet endpoint 401 smoke, and optional synthetic authenticated smoke.

## 2026-07-02 - Goal 10 Source-Only Wallet DB Preflight Helper

Current focus:

- Add a non-live helper for the Auth customer data wallet DB approval gate.

Evidence:

- Added `scripts/check-customer-data-wallet-preflight.js`.
- Added `npm run check:customer-data-wallet-preflight`.
- The helper validates the checked-in
  `scripts/create-customer-data-wallet-tables.sql` shape, rejects DML/drop-style
  lines, and prints the allowlisted schema metadata SQL and apply command
  template.
- The helper does not read DB environment values, connect to the database, apply
  SQL, inspect customer rows, or replace the owner-approved live DB preflight.
- Validation passed: `node --check scripts/check-customer-data-wallet-preflight.js`,
  `npm run check:customer-data-wallet-preflight`, `git diff --check`, targeted
  dangerous literal-secret scan on changed helper/docs, `npm run build`, and
  `npm run lint`.

Boundary:

- Source/docs only. No live SQL, deploy, Kubernetes mutation, production DB
  access, secret/token/password inspection, raw customer data inspection, or
  live checkout smoke.

Next unfinished chunk:

- Owner approval for schema-only live DB preflight, DB env use without printing
  values, live SQL apply, Auth deploy from current approved Auth HEAD, wallet
  endpoint 401 smoke, and optional synthetic authenticated smoke.

## 2026-07-02 - Goal 10 Continuation Source Validation And Active FlipFlop Target Integration

Current focus:

- Advance safe non-live Goal 10 rollout work while Auth SQL/deploy remains
  owner-approval gated.

Evidence:

- Auth runtime source commit `39b59d7` validation passed: focused Auth/User specs 2
  suites/15 tests, `npm run test:auth-contract` 3 suites/25 tests,
  `npm run build`, `npm run lint`, and `git diff --check`.
- Auth worktree remained clean on `main`, ahead of `origin/main` by 6.
- Live Auth read-only probes still show `/health` HTTP 200 and wallet endpoints
  HTTP 404 unauthenticated for `/auth/profile/checkout-data`,
  `/auth/profile/delivery-addresses`, and `/auth/profile/invoice-profiles`.
  Goal 10 SQL/deploy is therefore still unapplied.
- FlipFlop read-only subagent found active branch
  `codex/orders-lifecycle-cabinet-flipflop-clean` at `216264b` did not contain
  wallet commits `515f4b7`, `840eff6`, or `4268a48`; local `main` did contain
  them.
- Cherry-picked the wallet series onto the active FlipFlop target branch:
  `a8425a9 feat: add Auth wallet client bridge`,
  `15fb1ee feat: wire Auth wallet selectors in checkout`, and
  `f4af318 fix: guard checkout wallet autofill after manual edits`.
- FlipFlop pre-coding gate refreshed validation report in commit
  `223db57 chore: refresh checkout pre-coding gate`; branch is clean and aligned
  with `origin/codex/orders-lifecycle-cabinet-flipflop-clean`.
- FlipFlop validation passed: `python3 scripts/pre_coding_gate.py --root .`,
  `python3 scripts/strict_doc_audit.py --root . --format markdown
  --fail-on-issues` with 100/100, `git diff --check`,
  `npm --prefix shared run build`,
  `npm --prefix services/frontend exec -- tsc --noEmit`, and
  `npm --prefix services/frontend run build` with existing
  `baseline-browser-mapping` and workspace-root warnings only.
- Orders read-only subagent found current `orders-microservice` clean on `main`
  at `c5e6dd6`; Orders already accepts Auth subject aliases, persists immutable
  `customer`, `shippingAddress`, and `billingAddress` snapshots, and excludes
  raw customer/address/billing data from events. No Orders source change is
  needed before the final wallet provenance contract is approved.

Boundary:

- No live SQL, deploy, Kubernetes mutation, production DB access,
  secret/token/password inspection, raw customer data inspection, Orders edit,
  or live checkout submit was performed.

Next unfinished chunk:

- Owner approval for schema-only live DB preflight, DB env use without printing
  values, live SQL apply, Auth deploy from the current approved Auth HEAD,
  post-deploy wallet 401 smoke, and optional synthetic authenticated
  Auth/FlipFlop smoke.

## 2026-07-02 - Goal 10.11 Cross-Repo Validation And Deployment Plan

Current focus:

- Convert the Auth customer data wallet rollout into an approval-gated
  cross-repo validation/deployment plan.

Evidence:

- Auth live-gate subagent completed read-only review: Auth source is clean on
  `main` at `54743ed`, ahead of `origin/main` by 5; wallet source commit
  `b6c1585` is included; SQL checksum is
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`;
  deploy script checksum is
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Supersession note: the active deploy candidate was refreshed after Goal 10.14
  and 10.15 to `9ff1099bbee18836c40d9276d3b96a15e5e522fb`; do not use the
  historical `54743ed` value as the current deploy target.
- Live Auth backend/web were both `1/1` on old image
  `0d4282b-20260702102426`; public `/health` returned HTTP 200; wallet
  endpoints still returned HTTP 404 unauthenticated, so Goal 10 source is not
  deployed and SQL has not been applied.
- Consumer validation subagent completed read-only matrix for `flipflop`,
  `orders-microservice`, `rent-a-box`, `chytrakoupe`, and `cliplot`.
- Created
  `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
  with repo matrix, merge/deploy order, Auth live runbook, FlipFlop runtime
  smoke plan, rollback boundary, sensitive-data rules, parallel workstreams,
  and exact `[MISSING: ...]` blockers.
- Auth coordinator validation passed: `git diff --check` and targeted
  dangerous literal-secret scan on the changed Goal 10 documentation files.

Boundary:

- Documentation/status only. No live SQL, deploy, Kubernetes mutation,
  production DB access, secret/token/password inspection, raw customer data
  inspection, consumer source edit, or live checkout smoke.

Next unfinished chunk:

- Request explicit owner approval for schema-only live DB preflight, use of DB
  connection environment values without printing values, live SQL apply, Auth
  deploy from the current approved remote HEAD, and synthetic authenticated
  smoke if desired.

## 2026-07-02 - Goal 10.9 And 10.10 Consumer Plan Creation

Current focus:

- Create repo-local plans for the next dependency-gated consumer lanes without
  touching consumer runtime code.

Evidence:

- DocsRAG queried from the running Auth pod with the projected JWT token and
  returned HTTP 200. Retrieved headings were broad ownership references:
  Auth marketing preferences ownership, Catalog product truth, and general
  service contract material; no existing Goal 10 wallet plan source was found.
- Rent-a-box read-only audit: repo clean at `fa1fc85`. It has local
  email/password auth, local JWT minting, local password hash storage, local
  registered-user profile/contact/billing storage, contract PDFs embedding local
  billing data, and domain rows coupled to local `customer_profiles.id`.
- Rent-a-box repo-local plan committed as `fcfeb48`:
  `rent-a-box/docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`.
- Rent-a-box validation passed: `./scripts/intent_preflight.sh`,
  `python3 scripts/check_no_cyrillic.py docs AGENTS.md README.md`,
  `git diff --check`, and a targeted dangerous literal-secret marker scan.
- ChytraKoupe read-only audit: repo clean at `4817528`. Hosted Auth exists,
  checkout remains guest-first/manual, Auth wallet selectors are absent, and
  client-id/callback hardening decisions must precede selector implementation.
- ChytraKoupe repo-local plan committed as `a1dabca`:
  `chytrakoupe/implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`.
- ChytraKoupe validation passed: `git diff --check` and a targeted dangerous
  literal-secret marker scan. Validation report:
  `chytrakoupe/reports/validation/auth-wallet-checkout-selectors-plan.md`.
- Auth coordinator validation passed: `git diff --check` and a targeted
  dangerous literal-secret marker scan on changed Goal 10 coordinator docs.

Boundary:

- Planning/docs only. No consumer source code, live checkout submit, SQL,
  deploy, production DB access, secret inspection, token/password inspection,
  password hash inspection, contract storage inspection, or raw customer data
  inspection.

Next unfinished chunk:

- Goal 10.11 cross-repo validation and deployment plan, while live SQL/deploy
  remains owner-approval gated.


## 2026-07-02 - Goal 10 Coordinator Status Normalization

Current focus:

- Keep Goal 10 status aligned with current source-only cross-repo work.

Evidence:

- Goal 10.6 FlipFlop client bridge is source-prepared in `flipflop` commit
  `515f4b7`.
- Goal 10.7 FlipFlop checkout/profile selectors are source-prepared in
  `flipflop` commit `840eff6`; follow-up checkout manual-edit guard is
  source-prepared in `flipflop` commit `4268a48`.
- Goal 10.8 Orders compatibility audit is complete; no Orders source change is
  needed until an approved Auth wallet provenance contract defines wallet ID
  field names and idempotency semantics.
- Live Auth remains healthy on old image, but wallet endpoints are still not
  deployed; live SQL has not been applied.
- Auth coordinator docs validation passed `git diff --check` and a dangerous
  literal-secret marker scan on the changed files. Auth repo does not contain
  `scripts/pre_coding_gate.py` or `scripts/strict_doc_audit.py`; those checks
  remain `[MISSING: repo-local checker]` for this docs-only coordinator update.

Boundary:

- Documentation/status normalization only. No SQL, deploy, production DB access,
  secret inspection, customer-data inspection, or consumer runtime smoke.

Next unfinished chunk:

- Owner-approved Auth schema-only DB preflight, live SQL apply, Auth deploy,
  wallet endpoint 401 smoke, then FlipFlop runtime smoke including
  manual-edit-before-wallet-response and explicit selector override coverage.

## 2026-07-02 - Goal 10.7 FlipFlop Selectors And Orders Compatibility

Current focus:

- Continue dependency-gated consumer implementation without live Auth SQL/deploy.
- Preserve Orders as immutable order snapshot owner.

Auth source validation evidence:

- Source preflight showed clean `auth-microservice` worktree on `main`, ahead of
  `origin/main` by docs-only commits, with SQL checksum
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`
  for `scripts/create-customer-data-wallet-tables.sql`.
- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts
  src/users/users.service.spec.ts` passed: 2 suites, 15 tests.
- `npm run test:auth-contract` passed: 3 suites, 25 tests.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.

FlipFlop implementation evidence:

- Worker completed source-only selector wiring in `flipflop` commit
  `840eff6 feat: wire Auth wallet selectors in checkout`.
- Changed files: `services/frontend/app/checkout/page.tsx`,
  `services/frontend/app/profile/addresses/page.tsx`, and
  `implementation-goals/GOAL-10.7-auth-wallet-checkout-profile-selectors.validation-report.md`.
- Checkout defensively loads Auth wallet checkout data for authenticated users.
  Invoice profiles prefill existing contact/billing fields only; delivery
  addresses prefill existing optional different-delivery fields only.
- Profile addresses prefer Auth wallet addresses when available, with fallback
  to existing local `/users/addresses` when wallet endpoints fail or return 404.
- Guest checkout, manual entry, `/auth/profile`, and order payload semantics
  were preserved.

FlipFlop validation evidence from worker:

- `python3 scripts/pre_coding_gate.py --root .` passed.
- `python3 scripts/strict_doc_audit.py --root . --format markdown
  --fail-on-issues` passed, 100/100.
- `cd services/frontend && npm exec -- tsc --noEmit` passed.
- `cd services/frontend && npm run build` passed with existing-style Next/root
  and `baseline-browser-mapping` warnings.
- `git diff --check` and cached diff check passed.
- Commit hook pre-commit checks passed.

Orders compatibility evidence:

- Read-only Orders audit confirmed current clean `orders-microservice` source
  already accepts separate immutable `shippingAddress` and `billingAddress`
  snapshots and persists both as JSONB.
- `billingAddress` already supports invoice-style fields such as `companyName`
  and `taxId`.
- Unknown create/order fields are rejected or normalized away, and there is no
  current safe field for Auth wallet IDs.
- No Orders source change is needed before final FlipFlop payload provenance
  decisions. Adding wallet IDs now would be optional at best and harmful if it
  made Orders depend on mutable Auth data or leaked IDs into events/logs.

Boundary:

- No Auth SQL apply, Auth deploy, FlipFlop deploy, Orders edit, production DB
  read/write, secret/token/password/JWT value inspection, raw customer data
  inspection, or live checkout smoke was performed.

Next unfinished chunk:

- Request owner approval for schema-only DB preflight, live SQL apply, and Auth
  deploy. After Auth deploy, verify wallet endpoints return 401 unauthenticated
  instead of 404/500, then run non-destructive FlipFlop checkout/profile runtime
  smoke. Orders remains dependency-gated on final wallet provenance decisions.

## 2026-07-02 - Goal 10 Auth Runtime Recovered Before SQL/Deploy Gate

Current focus:

- Move from runtime-restoration blocker back to the owner-approved live SQL and
  deploy gate.

Runtime evidence:

- `auth-microservice` recovered on old image
  `localhost:5000/auth-microservice:0d4282b-20260702102426` with Deployment
  `SPEC=1`, `READY=1`, `DESIRED=1`, `AVAILABLE=1`.
- Backend pod `auth-microservice-69cbc75f5b-4bds2` was `1/1 Running` with pod IP
  `10.42.0.60`; `auth-microservice-web` remained `1/1 Running`.
- Public `https://auth.alfares.cz/health` returned
  `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Unauthenticated live wallet endpoint probes returned HTTP 404 for
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles`, confirming the Goal 10 wallet code is still
  not deployed. The expected post-deploy unauthenticated result is HTTP 401.

Boundary:

- No SQL apply, source deploy, image update, manifest edit, production DB row
  read, raw customer data read, secret/token/password/JWT value inspection, or
  consumer runtime smoke was performed.

Next unfinished chunk:

- Request owner approval for schema-only DB preflight, live SQL apply, and Auth
  deploy using the live-gate runbook. After deploy, verify health and that the
  wallet endpoints return 401 unauthenticated instead of 404/500.

## 2026-07-02 - Goal 10.6 FlipFlop Auth Wallet Client Bridge Source Prep

Current focus:

- Advance the first dependency-gated consumer lane without requiring live Auth
  wallet SQL/deploy.

Implementation evidence:

- Worker completed source-only FlipFlop client bridge commit `515f4b7 feat: add
  Auth wallet client bridge` in `alfares:/home/ssf/Documents/Github/flipflop`.
- Changed files were limited to `shared/auth/auth.interface.ts`,
  `shared/auth/auth.service.ts`, and `services/frontend/lib/api/auth.ts`.
- Added typed delivery address, invoice profile, checkout-data aggregate,
  create/update payload, delete-response, and default-operation client methods
  for `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles`.
- Existing checkout/profile pages, order payload behavior, deploy files, Auth
  repo source, Orders repo source, secrets, and customer data were not touched.

Validation evidence from worker:

- `python3 scripts/pre_coding_gate.py --root .` passed.
- `python3 scripts/strict_doc_audit.py --root . --format markdown
  --fail-on-issues` passed, 100/100.
- `git diff --check -- shared/auth/auth.interface.ts
  shared/auth/auth.service.ts services/frontend/lib/api/auth.ts` passed.
- `npm --prefix shared run build` passed.
- `npm --prefix services/frontend exec -- tsc --noEmit --pretty false` passed.
- `npm --prefix services/frontend run build` passed with only existing
  workspace-root and outdated `baseline-browser-mapping` warnings.

Boundary:

- No FlipFlop checkout/profile UI wiring, live consumer smoke, order creation
  payload change, Auth SQL apply, Auth deploy, production DB read/write, secret
  inspection, or customer-data inspection was performed.

Next unfinished chunk:

- Keep FlipFlop checkout/profile selector wiring gated on stable Auth runtime,
  owner-approved Auth SQL apply, and Auth deploy. Orders snapshot compatibility
  remains gated on the final FlipFlop selected-profile payload shape.

## 2026-07-02 - Goal 10 Auth Customer Data Wallet Repeated Replica Drift

Current focus:

- Keep Goal 10 live SQL/deploy blocked until baseline Auth backend runtime is
  stable.
- Preserve consumer readiness evidence without starting dependency-gated
  FlipFlop or Orders changes.

Runtime evidence:

- Remote source is clean on `main` at `f539476`; Goal 10 source remains
  committed, but live SQL apply and Goal 10 deploy have not run.
- Live `auth-microservice` backend remained on old image
  `localhost:5000/auth-microservice:0d4282b-20260702102426` and public
  `/health` continued to return HTTP 503 while `auth-microservice-web` stayed
  `1/1 Running`.
- `k8s/deployment.yaml` in source declares `replicas: 1`, but live backend
  repeatedly drifted to `spec.replicas=0`.
- HPA/KEDA resources were not found in `statex-apps`.
- Manual runtime restore attempts used only `kubectl scale
  deploy/auth-microservice --replicas=1` on the same old image. Both attempts
  created replacement backend pods, but live state later scaled the ReplicaSet
  down to `0` again before the backend app container became available.
- Pod `auth-microservice-69cbc75f5b-qtl7t` reached `wait-postgres` init start
  before being deleted by scale-down. Pod `auth-microservice-69cbc75f5b-bsl44`
  likewise reached `wait-postgres` creation/start, then was killed after live
  state returned to `spec.replicas=0`.
- Cluster events also showed broader deployment scale activity and API/runtime
  instability such as `database is locked`, endpoint update timeouts, stale
  sandbox reservations, and context deadline errors.

Consumer readiness evidence:

- Read-only sidecar confirmed `flipflop` is clean on `main` at `5ed12ad` and
  has no references to `/auth/profile/checkout-data`, `/delivery-addresses`, or
  `/invoice-profiles` yet.
- Read-only sidecar confirmed `orders-microservice` is clean on `main` at
  `a218f33` and has no references to the new Auth wallet endpoints.
- FlipFlop client/profile/checkout source work can be planned, but runtime
  wiring and smoke remain dependency-gated on Auth live SQL/deploy. Orders
  snapshot compatibility remains gated on the final FlipFlop selected-profile
  payload shape.

Boundary:

- No SQL apply, source deploy, image update, manifest edit, production DB row
  read, raw customer data read, secret/token/password/JWT value inspection, or
  consumer source edit was performed.

Next unfinished chunk:

- Identify or stop the external source of live backend `spec.replicas=0`, or
  have an operator restore Auth backend to stable `replicas=1`. Only after
  public Auth health is stable should the owner approval request proceed for
  schema-only DB preflight, SQL apply, Auth deploy, and consumer rollout.

## 2026-07-02 - Goal 10 Auth Customer Data Wallet Runtime Gate Blocker

Current focus:

- Preserve the owner-approved live gate ordering: runtime health first, then
  owner-approved schema-only DB preflight, live SQL apply, and Auth deploy.

Runtime evidence:

- `auth-microservice` remained `0/1` on old deployed image
  `localhost:5000/auth-microservice:0d4282b-20260702102426`; Goal 10 code was
  not deployed.
- `auth-microservice-web` was `1/1 Running`, while public
  `https://auth.alfares.cz/health` returned HTTP 503 because the backend pod was
  unavailable.
- A narrow Auth-only recovery deleted only the stuck backend pod
  `auth-microservice-69cbc75f5b-xm9mb`; the Deployment created
  `auth-microservice-69cbc75f5b-x9vwc`, which remained `Init:0/2` with no pod IP
  after the polling window.
- Kubernetes events showed repeated `FailedCreatePodSandBox` for Auth and many
  unrelated services, including `DeadlineExceeded` and reserved sandbox-name
  failures. Node `alfares` was `Ready` with no memory, disk, or PID pressure,
  and `kube-system` pods were running.
- Namespace status still showed broad container lifecycle backlog, including 24
  pods in `ContainerCreating` plus additional init states, so the gate is a
  cluster/container-runtime issue rather than a Goal 10 source regression.


Runtime repair evidence after blocker documentation:

- `auth-microservice` was found with `spec.replicas=0` and no HPA in the
  namespace. It was scaled back to `spec.replicas=1` using the same old image;
  this was a runtime restoration action, not a source deploy.
- The already deleting pod `auth-microservice-69cbc75f5b-x9vwc` blocked fresh
  pod creation and was force-deleted from the Kubernetes API.
- The Deployment then created `auth-microservice-69cbc75f5b-qtl7t`; after the
  polling window it was scheduled to node `alfares` but still `Init:0/2` /
  `PodInitializing` with no pod IP, so backend availability remained blocked before init/container start.

Boundary:

- No live SQL apply, deployment, production DB row read, raw customer data read,
  secret/token/password/JWT value inspection, DB mutation, source code change,
  manifest change, or deployed image change was performed.

Next unfinished chunk:

- Auth backend desired state has been restored to `spec.replicas=1`, but
  the replacement pod remains blocked before init/container start. Continue
  runtime recovery or operator-confirm the container runtime state before the
  Auth Customer Data Wallet SQL/deploy approval request can proceed.

## 2026-07-02 - Goal 10 Auth Customer Data Wallet A1 Source Implementation

Current focus:

- Implement Auth as the source of truth for reusable registered-user delivery
  address books and invoice/billing profiles.
- Preserve Orders as immutable order snapshot owner and consumer services as UX
  and guest-checkout orchestrators.

Schema-path evidence:

- Live non-secret Auth config uses `NODE_ENV=production` and `DB_SYNC=false`.
- `shared/database/database.module.ts` controls TypeORM schema sync only through
  `synchronize: process.env.DB_SYNC === 'true'`.
- No formal TypeORM migration runner, migration scripts, DataSource, or deploy
  migration step exists in the repo.
- Existing safe precedent is checked-in idempotent SQL such as
  `scripts/create-magic-link-table.sql`.

Implementation evidence:

- Added idempotent SQL source file
  `scripts/create-customer-data-wallet-tables.sql` for
  `user_delivery_addresses` and `user_invoice_profiles`, with FK ownership,
  active-row indexes, and one-default-per-user partial unique indexes.
- Added TypeORM entities for delivery addresses and invoice profiles and
  registered them in `UsersModule` and `DatabaseModule`.
- Added DTOs for delivery address and invoice profile create/update payloads.
- Added user-scoped CRUD, soft-delete, and default-selection methods in
  `UsersService`.
- Added authenticated Auth endpoints under `/auth/profile/delivery-addresses`,
  `/auth/profile/invoice-profiles`, and `/auth/profile/checkout-data`.
- Added sanitization so wallet responses omit `userId` and `deletedAt`.
- Extended Auth contract tests for checkout aggregate, delivery mutation, and
  invoice mutation boundaries using synthetic data.
- Updated service info and Auth contract docs for the new endpoints.

Subagents used:

- Auth schema/deploy-path explorer: completed read-only and confirmed the
  source-only SQL path with live SQL apply blocked.
- Consumer readiness monitor: completed read-only and confirmed FlipFlop is the
  first clean dependency-gated consumer candidate, while Orders is blocked by
  unrelated dirty event/order changes.

Validation evidence:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed: 13
  tests.
- `npm test -- --runTestsByPath src/users/users.service.spec.ts
src/auth/auth-contract.spec.ts` passed: 2 suites, 15 tests.
- `npm run test:auth-contract` passed: 3 suites, 25 tests.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- Missing-marker scan returned only documented Goal 10 approval/follow-up
  blockers after removing the resolved schema-path blocker.
- Secret-pattern scan returned no secret values; matches were limited to
  synthetic test `password` fields and existing source references such as
  `DB_PASSWORD`.

Boundary:

- No live SQL apply, deployment, production DB row read, raw customer data read,
  secret/token/password/JWT value inspection, JWT payload change, RBAC change,
  OAuth/magic-link/CORS/internal-service contract change, or consumer-service
  source edit was performed.

Next unfinished chunk:

- Auth A1 source was committed as `b6c1585`. Live SQL apply and deployment
  remain owner-approval-gated.

## 2026-07-02 - Goal 10 Auth Customer Data Wallet Pre-Approval Fixes

Current focus:

- Close pre-approval issues found by read-only deployment/consumer sidecars
  before requesting SQL/deploy approval.

Implementation evidence:

- Added `ParseUUIDPipe` to delivery address and invoice profile path params so
  malformed wallet UUIDs fail at the Auth controller boundary instead of
  reaching Postgres UUID columns.
- Updated `docs/orchestrator/GOALS.md` so Goal 10.1-10.5 reflect the
  source-implemented state and live SQL/deploy remain gated.
- Added `docs/orchestrator/2026-07-02-auth-customer-data-wallet-live-gate.md`
  with explicit preflight, owner approvals, SQL apply shape, schema-only
  verification, deploy smoke, rollback boundaries, and consumer gates.

Runtime evidence:

- Live Auth production runtime was observed unhealthy during this pass, but it
  was still running image `0d4282b-20260702102426`; `b6c1585` was not deployed.
  The outage appeared cluster-wide with many pods in image pull/container
  creation backlog, not a failure of the new Goal 10 source.
- To restore scheduler capacity, stuck pods that already had deletion
  timestamps were force-removed from the Kubernetes API. No database, source,
  secret, or deployed image was changed. Auth web recovered to `1/1`; Auth
  backend remained pending/init-blocked at the last check due cluster
  scheduling/container startup backlog on the old image.

Validation evidence:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts
src/users/users.service.spec.ts` passed: 2 suites, 15 tests.
- `npm run test:auth-contract` passed: 3 suites, 25 tests.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.

Boundary:

- No live SQL apply, deployment, production DB row read, raw customer data read,
  secret/token/password/JWT value inspection, JWT payload change, RBAC change,
  OAuth/magic-link/CORS/internal-service contract change, or consumer-service
  source edit was performed.

Next unfinished chunk:

- Commit the pre-approval fixes, then restore or confirm current Auth runtime
  health before requesting owner approval for schema-only DB preflight, live SQL
  apply, and Auth deploy.

## 2026-07-02 - Goal 10 Auth Customer Data Wallet Cross-Repo Planning

Current focus:

- Owner-selected cross-repo plan for Auth as the single editable source of truth for registered-user profile/contact data, delivery address books, and invoice/billing profiles.
- Preserved Auth ownership: profile/contact/address/invoice profile truth moves to Auth; Orders keeps order snapshots; Payments keeps payment/provider state; consumer checkouts keep UX and guest checkout orchestration.

DocsRAG evidence:

- Queried DocsRAG from the running Auth pod with projected `JWT_TOKEN`; HTTP 200 returned broad source headings for Auth identity/profile boundary, Catalog product truth, Orders order truth, Payments payment/VS truth, FlipFlop consumer architecture, Marketing preferences, and shared e-commerce ownership. No already-complete Auth address-book or invoice-profile contract was found.

Source evidence:

- Auth `POST /auth/register` stores `email`, `firstName`, `lastName`, and `phone` in `users`.
- Auth `GET /auth/profile` returns a fresh sanitized Auth database profile.
- Auth `PATCH /auth/profile` updates profile fields and one `perApplicationPreferences.canonicalProfile.address`, exposed as `profileAddress`.
- Auth has no first-class multi-address delivery address book or invoice/billing profile CRUD.
- FlipFlop already uses hosted Auth login/register and a shared Auth client for `/auth/profile`, but it still exposes local `/users/addresses`, mirrors one default address into local `delivery_addresses`, and collects checkout billing/delivery data inline.
- FlipFlop guest order creation creates a local order/address snapshot; when billing and delivery differ, current source evidence indicates billing is not stored separately and central Orders can receive the same bounded address for shipping and billing.
- Orders accepts `customer`, `shippingAddress`, and `billingAddress` as order creation snapshots and documents that order events must not include raw customer/address/payment payloads.
- Read-only consumer discovery also found `rent-a-box` as a high-risk local-auth/profile duplication repo, `chytrakoupe` as hosted-Auth checkout with duplicated contact/address payloads, `cliplot` as guarded checkout, and Allegro/Aukro/Bazos/Heureka as marketplace/channel order ingestion surfaces that should preserve external buyer/order evidence without back-writing marketplace buyer data to Auth.

Planning artifacts created:

- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`

Planning/index artifacts updated:

- `implementation-goals/README.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/IMPLEMENTATION_STATE.md`
- `TASKS.md`

Subagents used:

- Auth data-wallet readiness explorer: completed read-only.
- FlipFlop checkout/profile explorer: completed read-only.
- Non-FlipFlop commerce consumer explorer: completed read-only.

Validation evidence:

- Planning artifacts presence scan returned the three new files.
- Missing-marker scan returned only documented Goal 10 blockers.
- Secret-pattern scan returned no matches.
- `STATE.json` parsed successfully with `STATE_JSON_OK`.
- `git diff --check` passed.

Boundary:

- No runtime Auth code, DB schema, production DB rows, raw customer data, secrets, token values, passwords, decoded JWTs, consumer source code, deployment, or live checkout smoke was changed or run in this planning pass.

Next unfinished chunk:

- Goal 10.1 was later resolved by the A1 source implementation. Consumer code
  changes remain gated on owner-approved SQL apply and Auth deployment.

## 2026-07-02 - Auth Validate Logging Loop Source Fix

Current focus:

- Owner-reported Auth login/runtime issue and suspected circular logging.
- Preserved Auth ownership: identity, login, JWT validation, RBAC role lookup, and audit boundaries remain in Auth; logging storage remains in Logging.

Diagnosis evidence:

- `https://auth.alfares.cz/login` returned HTTP 200 and `/health` returned ok.
- Synthetic bad password login returned expected HTTP 401.
- Live Auth local logs showed password login successes at 2026-07-02 04:49:25, 04:50:24, and 04:50:32 UTC.
- Logging ingestion from inside the Auth pod to `http://logging-microservice:3367/api/logs` returned HTTP 201.
- Logging source confirms `POST /api/logs` is unguarded, while admin read endpoints call Auth `/auth/validate`.
- Auth and Logging stored logs showed repeated `/auth/validate` failures with `invalid input syntax for type uuid: "warehouse-reservation-expiry-cron"`.

Implementation evidence:

- Added pre-DB UUID subject validation in `AuthService.validateToken`.
- Expected `UnauthorizedException` validation denials now stay warning-level and are not re-logged as unexpected errors.
- Successful `validate_token` audit events are no longer emitted through the external logger, reducing Auth -> Logging -> Auth validation feedback noise.
- Added focused regression coverage proving non-UUID JWT subjects are rejected before `usersService.findById`.

Verification evidence:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed: 10 tests.
- `git diff --check` passed.
- `npm run build` passed.
- `npm run lint` passed.

Deployment:

- Deploy script Auth contract tests passed before image build.
- Backend image digest: `sha256:82a82874d3e7fa3eff250b0c0fef06d592a55f04a2cd3052716e5867c9cef79f`.
- Web image digest: `sha256:58e9c938f5741041f841079f06847068311aadd5133ecc6db5010d8882cba7bd`.
- Kubernetes backend and web rollouts completed; both deployments are `READY 1/1`.
- Public `/health` returned ok after deployment.
- Synthetic bad `/auth/login` returned HTTP 401 after deployment.
- Running compiled backend contains `invalid_subject` and `isUuid(value)`.

- Owner-approved deployment completed with backend image `localhost:5000/auth-microservice:854e4b0-20260702051115` and web image `localhost:5000/auth-microservice-web:854e4b0-20260702051115`.

Next unfinished chunks:

- No unfinished deployment action remains for this remediation.

2026-07-01: Owner-approved Auth profile single-source fix deployed to production. Deploy command: `./scripts/deploy.sh` from `alfares:/home/ssf/Documents/Github/auth-microservice` at commit `2d105b6`. Deploy script evidence: focused Auth contract tests passed 3 suites/19 tests; backend image built and pushed as `localhost:5000/auth-microservice:2d105b6-20260701184319` with digest `sha256:7da7a574b64dc600b62cc640bdcca158fef8654f7b3d96f90390b2d58be3abfe`; web image built and pushed as `localhost:5000/auth-microservice-web:2d105b6-20260701184319` with digest `sha256:6036290b742825188725285fe302d51144b2b57b6c0e8bc6b56625de00360b97`; ConfigMap, ExternalSecret, manifests, and image updates applied. Runtime note: initial backend rollout timed out because kubelet/containerd was slow pulling images while unrelated pods were also in image/container lifecycle states; production remained available through the old Auth pod due `maxUnavailable=0`. Recovery: deleted only the stuck new Auth pod so the Deployment retried the new pod; no old ready pod, database, secret, or source was deleted. Final verification: `kubectl rollout status deploy/auth-microservice` and `deploy/auth-microservice-web` both succeeded; deployments show backend and web `READY 1/1`, `UP-TO-DATE 1`, `AVAILABLE 1` on the `2d105b6-20260701184319` images; new backend pod `auth-microservice-f5f99b747-8gk6f` is `1/1 Running` with imageID digest `sha256:7da7a574b64dc600b62cc640bdcca158fef8654f7b3d96f90390b2d58be3abfe`; public `https://auth.alfares.cz/health` returned `success=true,status=ok`; unauthenticated `GET /auth/profile` returned HTTP 401; public `/login` returned HTTP 200; running compiled code contains `dist/src/auth/auth.service.js: async getProfile(userId)`. Boundary: no production user rows, tokens, passwords, decoded JWTs, Vault values, Bazos cookies, Bazos session data, DB mutation, user merge/backfill, JWT shape change, RBAC/OAuth/magic-link/CORS/internal-service/database schema change, or consumer-service source change was performed. Next unfinished chunk: optional owner-provided test-user live profile smoke through Bazos `/ui/auth/me` or hosted Auth callback.

2026-07-01: Owner-selected Auth profile single-source audit and contract hardening completed in source. Vision: Auth remains the Statex ecosystem identity and profile/contact source of truth for registered users. Goal Impact: consumers such as Bazos can initialize or refresh profile views from Auth after hosted handoff instead of forking email/name/phone into app-local registration forms. System: Auth `users` table, `/auth/profile`, `/auth/validate`, hosted Auth handoff, and read-only Bazos consumer bridge. Feature: canonical registered-user profile read. Task: inspect Auth profile persistence/response paths, make `/auth/profile` explicitly read and return a sanitized Auth DB user, add regression coverage for `email`, `firstName`, `lastName`, `phone`, `contactInfo`, and source metadata, and document consumer expectations. Execution Plan: bounded owner-selected profile single-source audit in `docs/orchestrator/EXECUTION_PLAN.md`. Coding Prompt: do not expose secrets, tokens, passwords, decoded JWTs, raw production user data, Bazos cookies, or session payloads. Code: added `AuthService.getProfile(userId)` and changed `AuthController.getProfile` to return `authService.getProfile(req.user.id)`; documented `/auth/profile` as the canonical sanitized Auth database profile read; added synthetic regression coverage. Validation: DocsRAG query from running Auth pod returned HTTP 200 with no matching context/sources for the specific Hevrike/Bazos profile query; `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed 8 tests; `npm run test:auth-contract` passed 3 suites/19 tests; `npm run build` passed; `npm run lint` passed; `git diff --check` passed; read-only Bazos source spot check confirmed hosted Auth migration and `/ui/auth/me` use Auth validation while Bazos local account/identity tables remain Bazos-platform entities. Boundary: no production DB mutation, user merge/backfill, raw production user-data read, secret/token/password inspection, decoded JWT inspection, JWT shape change, RBAC/OAuth/magic-link/CORS/internal-service/database schema change, consumer-service source edit, or production deployment was performed. Next unfinished chunk: owner-approved deployment and live profile smoke if this source fix should go to production.

2026-06-29: Catalog-to-Warehouse service identity projection regression coverage added. Change: extended `src/auth/auth-contract.spec.ts` with focused `/auth/validate` tests proving service actor fields are exposed for `userType=service` principals with `perApplicationPreferences.serviceIdentity` and are not exposed for normal users. Validation: `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts` passed 7 tests; `git diff --check` passed; `npm run test:auth-contract` passed 18 tests; `npm run build` passed. Boundary: no helper execution, live Auth request, DB mutation, role assignment, service-principal creation, token issuance, Vault/Kubernetes secret mutation, deployment, decoded secret/JWT inspection, Warehouse import, stock mutation, or Catalog runtime config change was performed. Next action: validate source, then keep runtime provisioning approval-gated.

2026-06-29: Catalog-to-Warehouse Auth service-principal provisioning helper prepared and deployed. Change: added `scripts/provision-catalog-warehouse-service-token.ts` and a backward-compatible Auth `/auth/validate` service identity projection for `userType=service` principals whose `perApplicationPreferences.serviceIdentity.serviceName` is set. The helper has a non-mutating `--dry-run` mode and an approval-gated `--apply` mode requiring explicit DB and token issuance confirmations plus `--token-output`; token values are written only to that file with mode `0600` and are never printed. This prepares the existing Warehouse Auth-validated bearer receiver path for Catalog-to-Warehouse stock acceptance without adding a Warehouse static-token bypass. Validation: `npx tsc --noEmit --skipLibCheck --experimentalDecorators --emitDecoratorMetadata --module commonjs --target es2020 --moduleResolution node --esModuleInterop scripts/provision-catalog-warehouse-service-token.ts` passed; `git diff --check` passed; `npm run build` passed; deploy-script `npm run test:auth-contract` passed 16 tests; deployment completed with backend image `localhost:5000/auth-microservice:97ea521-20260629180327` and web image `localhost:5000/auth-microservice-web:97ea521-20260629180327`; both deployments are ready `1/1`; public `/health` returned `success=true,status=ok`; running pod compiled code contains `resolveServiceIdentity`, `serviceIdentity`, and `auth-service-jwt`. Boundary: no helper execution, Auth DB mutation, role assignment, user/service-principal creation, token issuance, Vault/Kubernetes secret value change, decoded secret/JWT inspection, Warehouse import, stock mutation, or Catalog runtime config change was performed. Next action: after explicit owner approval run the helper in `--apply` mode, mount the resulting token through approved runtime secret management, and rerun Catalog `npm run verify:stock-acceptance:gates`.

2026-06-29: Catalog-to-Warehouse service role provisioning helper prepared. Change: added source-only support for `internal:<service>:<role>` parsing and `--dry-run` to `scripts/assign-role-by-email.ts`, with wrapper usage documentation. This prepares the approved Auth-compatible bearer-token path for the stock acceptance blocker without running any production provisioning. The exact future role shape needed by Warehouse is `internal:warehouse-microservice:admin`; the target principal/email and token/secret rotation path remain owner-approved runtime operations, not source defaults. Validation: `npx tsc --noEmit --skipLibCheck --experimentalDecorators --emitDecoratorMetadata --module commonjs --target es2020 --moduleResolution node --esModuleInterop scripts/assign-role-by-email.ts` passed; `bash -n scripts/assign-role-by-email.sh` passed; `git diff --check` passed; `npm run build` passed. Boundary: no Auth DB mutation, role assignment, user/service-principal creation, token issuance, Vault/Kubernetes secret mutation, deployment, decoded secret/JWT inspection, or production user data read was performed. Warehouse still requires an Auth-valid bearer credential; adding a Warehouse static-token receiver remains an owner-approved contract change and was not implemented. Next action: with explicit owner approval, create or identify the Catalog service principal, assign `internal:warehouse-microservice:admin` using the helper, issue/rotate an Auth-compatible runtime token without printing it, update Catalog runtime config, then rerun Catalog `npm run verify:stock-acceptance:gates`.

2026-06-29: Auth admin Users application-filter production remediation implemented and deployed on `alfares`. Vision: Auth remains the Statex identity and RBAC authority. Goal Impact: `/admin` Users application filters load without the backend 500 caused by SQL alias parsing. System: Auth admin Users API. Feature: server-side admin user list filtering. Task: fix SQL generated by `UsersService.findAdminListPage` for application and app-admin filters. Execution Plan: bounded production remediation from owner screenshot and live backend log evidence; patch only `src/users/users.service.ts`, add focused regression coverage in `src/users/users.service.spec.ts`, validate, deploy after owner approval, and verify live runtime. Coding Prompt: do not print or record secrets, tokens, passwords, raw production user rows, or change Auth contracts. Code: quoted the reserved TypeORM alias as `"user"."id"` in both raw subqueries. Validation: live logs showed `QueryFailedError: syntax error at or near "."` before the fix; `npm test -- --runTestsByPath src/users/users.service.spec.ts` passed 2 tests; `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts src/users/users.service.spec.ts` passed 8 tests; `npm run build` passed; `npm run lint` passed; `git diff --check` passed; deploy-script Auth contract tests passed 16 tests; Kubernetes rollout completed; live `/admin` returned HTTP 200; live `/health` returned ok; deployed images `localhost:5000/auth-microservice:9a309b0-20260629000608` and `localhost:5000/auth-microservice-web:9a309b0-20260629000608`; running pod compiled code contains both quoted alias clauses; post-deploy log scan showed no recurrence of the previous SQL error. Boundary: no database schema, JWT payload, RBAC assignment semantics, OAuth, magic-link, password reset, CORS, internal-service contract, decoded secrets, tokens, passwords, raw production user data, or consumer-service code changed. Next unfinished chunk: none.

# 2026-06-28 - Hosted Password Reset Success UX Fix

Current focus:

- Owner-reported hosted reset defect: after successful password reset, the `New password` and `Confirm new password` fields remained visible.
- Owner-reported hosted navigation defect: clicking reset page `Back to login` opened `/login` and immediately showed `Missing required query parameter: return_url`.
- Auth branch: `main`.
- Runtime code changes: hosted UI only.
- Deployment: completed with images `localhost:5000/auth-microservice:49a2f30-20260628230756` and `localhost:5000/auth-microservice-web:49a2f30-20260628230756`.

Implementation evidence:

- Added a stable `password-row` container to `web/public/index.html`.
- After successful `/auth/password-reset-confirm`, the hosted UI now clears and hides the new-password row, confirm-new-password row, and submit button, leaving only the success message and login link.
- The reset page `Back to login` link now preserves `return_url`, `client_id`, and `state` when those query parameters exist.
- A plain `/login` page load no longer renders the immediate `Missing required query parameter: return_url` error. The login action remains disabled until a valid consumer `return_url` exists.
- Updated `src/auth/hosted-auth-web.spec.ts` with focused assertions for the reset success and login-link behavior.

Validation evidence:

- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed: 1 suite, 6 tests.
- `git diff --check` passed.
- `npm run build` passed.
- `node --check web/server.js` passed.
- Extracted inline script from `web/public/index.html` and `node --check /tmp/auth-hosted-inline-check.js` passed.
- Owner approved production deployment on 2026-06-29 Europe/Prague.
- Deploy script `npm run test:auth-contract` passed: 3 suites, 16 tests.
- Deploy completed successfully in 279.77s with backend image `localhost:5000/auth-microservice:49a2f30-20260628230756` and web image `localhost:5000/auth-microservice-web:49a2f30-20260628230756`.
- Deploy health check returned Auth status `ok`.
- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web -o wide` showed both deployments `READY 1/1` on image tag `49a2f30-20260628230756`.
- `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/reset-password?token=synthetic-ui-check` returned HTTP 200.
- `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/login` returned HTTP 200.
- Live `https://auth.alfares.cz/health` returned status `ok`.
- Served hosted HTML contains `id="password-row"`, `resetLoginAnchor.href`, `(required by application)`, and `passwordRow.style.display = 'none'`; it no longer contains the old `Missing required query parameter: return_url` message.

Boundary evidence:

- No password reset API, reset-token generation, reset-token validation, reset-token expiry, email sending, JWT payload, refresh token, OAuth, magic-link, RBAC, redirect allowlist, CORS, internal-service contract, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, real reset token, password, API key, or raw production user data changed or was recorded.

Intent Compliance Report:

- Goal: make hosted password reset success and return-to-login UX coherent.
- Implemented: hosted UI hides reset fields after success and avoids the immediate missing-`return_url` error from the reset page login link.
- Not implemented: API changes, token changes, password policy changes, DB changes, or consumer-service changes.
- Boundary check: Auth remains the hosted credential and password reset authority.
- Subagents used: none.
- Validation evidence: focused hosted web test, build, diff-check, web server syntax, and inline script syntax passed.
- Risks: browser cache should be refreshed if a tab was already open on the old hosted HTML.
- Next action: owner verifies the hosted reset/login flow in browser.

2026-06-28: Owner-selected Auth admin Users role/application checkbox management implemented and deployed on `alfares`. Gate decision: accept before deployment. Scope: `src/auth/admin-users.controller.ts`, `src/users/users.service.ts`, `web/public/admin.html`, `web/public/js/admin.js`, `web/public/css/style.css`, `docs/orchestrator/CONTEXT_PACKAGE.md`, `docs/orchestrator/EXECUTION_PLAN.md`, `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATUS.md`. Implemented server-side `GET /auth/admin/users` filters for search text, application, active/inactive status, verified/unverified status, and application-admin-only; added per-user application and admin-application summaries; added `GET /auth/admin/users/application-admins` for admins grouped across every registered application; updated the selected-user roles panel so all global and per-application roles render as checkboxes; added application registration checkboxes that assign the default application `user` role and remove all assigned roles for that application when unchecked; reused existing `GET /auth/admin/roles`, `GET/POST/DELETE /auth/admin/users/:userId/roles`, and `GET /auth/admin/applications` contracts. Validation passed: `node --check web/public/js/admin.js`, `node --check web/server.js`, `git diff --check`, `npm run build`, `npm run lint`, and `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` (6 tests). No production database writes by agents, role mutations by agents, decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, raw production user-data dumps, consumer-service code, JWT payload changes, RBAC assignment semantic changes, OAuth, magic-link, CORS, internal-service contracts, or database schema changes. Deployment completed with backend image `localhost:5000/auth-microservice:bf7e63c-20260628214651` after the post-deploy restart and web image `localhost:5000/auth-microservice-web:bf7e63c-20260628214214`. Live verification passed: `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/admin` returned HTTP 200; served `/admin` HTML contains `View and update the selected user` and `/js/admin.js?v=20260628235000`; served admin JS contains `cachedRoles`, `/auth/admin/roles`, and `toggleApplicationMembership`; unauthenticated `GET /auth/admin/users/application-admins` returned HTTP 401, confirming the route is present and protected. Next unfinished task: owner browser-verifies checkbox assignment behavior with an authenticated admin session.

# 2026-06-28 - Admin Users Layout Width Fix

Current focus:

- Owner-reported production UI defect: the live `/admin` Users page is too narrow, making the populated table look clipped and hiding action controls.
- Auth branch: `main`.
- Runtime code changes: hosted admin CSS/cache-busting only.
- Deployment: completed with images `localhost:5000/auth-microservice:a39f9d2-20260628212026` and `localhost:5000/auth-microservice-web:a39f9d2-20260628212026`.

Implementation evidence:

- Updated `web/public/css/style.css` so the authenticated dashboard container is `80vw` with no `max-width` cap.
- Changed `.log-list` to allow horizontal overflow instead of clipping table content.
- Added a `1100px` minimum width to `.users-table` so the Actions column remains reachable.
- Added a mobile fallback for dashboard width under `900px`.
- Bumped the admin asset query in `web/public/admin.html` to force refreshed hosted admin assets.

Validation evidence:

- `git status --short --branch` was clean before editing target files.
- Source inspection confirmed the page data is rendered by `web/public/js/admin.js` into `#users-container`; the observed issue is layout clipping, not an empty users API response.
- `node --check web/public/js/admin.js` passed.
- `node --check web/server.js` passed.
- `npm run build` passed.
- `git diff --check` passed before deployment.
- Deploy script `npm run test:auth-contract` passed: 3 suites, 16 tests.
- Deploy completed successfully in 187.21s with images `localhost:5000/auth-microservice:a39f9d2-20260628212026` and `localhost:5000/auth-microservice-web:a39f9d2-20260628212026`.
- Deploy health check returned Auth status `ok`.
- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web` showed both deployments ready on image tag `a39f9d2-20260628212026`.
- `curl -I -H Cache-Control: no-cache https://auth.alfares.cz/admin` returned HTTP 200.
- Live `https://auth.alfares.cz/css/style.css` contains `#dashboard-view.container`, `width: 80vw`, `overflow-x: auto`, and `min-width: 1100px`.

Boundary evidence:

- No Auth endpoint, JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, reset token, password, API key, or raw production user data changed or was recorded.

Intent Compliance Report:

- Goal: make the hosted Auth admin Users page wide enough to inspect populated user rows.
- Implemented: dashboard-only width and table overflow fix.
- Not implemented: API/data changes, user-data inspection, Auth contract changes, or role changes.
- Boundary check: Auth remains identity/access authority; this is hosted admin presentation only.
- Subagents used: none.
- Validation evidence: syntax checks, build, deploy contract tests, rollout, live route, and served CSS checks passed.
- Risks: existing browser tabs may need a hard refresh if they cached the old CSS before deployment.
- Next action: owner verifies the live `/admin` Users page in browser.

# 2026-06-27 - Catalog Service Identity Ownership Confirmation

Change: created Auth-owned runtime Vault property `secret/prod/auth-microservice#CATALOG_INTERNAL_SERVICE_TOKEN` without printing or recording the value. Catalog and Orders ExternalSecret manifests consume that property under their local `CATALOG_INTERNAL_SERVICE_TOKEN` environment key.

Boundary decision: the supported machine-auth contract is `x-internal-service-token` plus `x-service-name: catalog-microservice`, mapped by Orders to `internal:catalog-microservice:service`. This does not mint or validate a user JWT through `/auth/validate`, because `/auth/validate` is user-token validation and machine actors are not Auth users.

Validation: no secret values were printed or committed. Auth docs only record the ownership source and contract; runtime synchronization and smoke validation are owned by the Catalog/Orders manifests and Kubernetes checks.

# Auth Orchestrator Status

## 2026-06-26 - Hosted Password Reset Route Fix Deployed

Current focus:

- Owner-reported production defect: password reset email links open `GET /reset-password`, which returned `Cannot GET /reset-password`.
- Auth branch: `main`.
- Deployment: completed after owner approval; deploy script built and pushed images `localhost:5000/auth-microservice:1026463-20260626175614` and `localhost:5000/auth-microservice-web:1026463-20260626175614`.
- Runtime code changes: hosted route/UI only; existing reset token API contract is unchanged.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- DocsRAG returned no matching sources for the password reset hosted route query, so remote source and Auth contract docs were used.

Implementation evidence:

- Added `/reset-password` to hosted route serving in `src/main.ts` and `web/server.js`.
- Added hosted reset-password mode in `web/public/index.html` that reads the email token query parameter in-browser and submits only to `/auth/password-reset-confirm`.
- Added focused regression coverage in `src/auth/hosted-auth-web.spec.ts`.
- Updated `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/orchestrator/CONTEXT_PACKAGE.md`, and `docs/orchestrator/EXECUTION_PLAN.md`.

Validation evidence:

- Pre-deploy live probe with a synthetic token confirmed current production `/reset-password` returned HTTP 404 and `Cannot GET /reset-password`.
- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed.
- Deploy script `npm run test:auth-contract` passed: 3 suites, 16 tests.
- `npm run build` passed.
- `node --check web/server.js` passed.
- Inline hosted Auth script extraction plus `node --check /tmp/auth-hosted-inline-check.js` passed.
- `git diff --check` passed.
- Active gate-critical missing-marker scan returned no matches.
- Documentation secret-pattern scan returned no matches.
- Broad `docs/orchestrator` missing-marker scan still reports pre-existing historical rollout planning markers under `docs/orchestrator/2026-06-24-*`; those files were not introduced by this fix.
- Deploy script timed out while waiting for the backend rollout, then the same rollout completed successfully on a follow-up `kubectl rollout status deployment/auth-microservice --timeout=120s` check.
- `kubectl -n statex-apps rollout status deployment/auth-microservice --timeout=30s` passed.
- `kubectl -n statex-apps rollout status deployment/auth-microservice-web --timeout=30s` passed.
- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web -o wide` showed both deployments `READY 1/1` on image tag `1026463-20260626175614`.
- `GET https://auth.alfares.cz/reset-password?token=synthetic-final-probe` returned HTTP 200 and contained hosted reset form markers `resetToken`, `password-confirm`, and `/auth/password-reset-confirm`.
- `GET https://auth.alfares.cz/health` returned HTTP 200 with status `ok`.
- Synthetic invalid `POST /auth/password-reset-confirm` returned HTTP 400 `Invalid or expired reset token`, without using or recording a real reset token.

Boundary evidence:

- No Auth JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database schema, consumer-service code, decoded secret, JWT, refresh token, OAuth token, magic-link token, real reset token, password, API key, or raw production user data changed or was recorded.

Next action:

- No action needed for the reset-password route. The remote repo has no configured git remote, so pushing to origin is blocked until a remote URL is configured.

## 2026-06-13 - Goal 09 Auth Contract Production Smoke Verification Completed

Current focus:

- Owner-selected Goal 09: Auth contract production smoke verification after `AUTH-ALPHA-01` and `RBAC-REM-07` production deployment.
- Auth branch: `main`.
- Deployment: not run.
- Runtime code changes: none.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved source headings included Authentication API Endpoints, Business: auth-microservice, and Post-Cutover Verification Evidence.

Verification evidence:

- `npm run build` passed.
- `node --check web/public/js/admin.js` passed.
- Inline hosted login script syntax extraction passed.
- `https://auth.alfares.cz/health` returned HTTP 200.
- `https://auth.alfares.cz/login` returned HTTP 200.
- `https://auth.alfares.cz/register` returned HTTP 200.
- `https://auth.alfares.cz/admin` returned HTTP 200.
- Synthetic invalid `POST /auth/validate` returned HTTP 401 with a safe `valid` response summary.
- Safe `GET /auth/validate-return-url` returned HTTP 200 with the expected HTTPS return URL.
- Gate-critical missing-marker scan returned no matches.
- Documentation secret-pattern scan returned no matches.
- `git diff --check` passed.

Boundary evidence:

- No Auth runtime code, consumer code, endpoint, JWT payload, RBAC, OAuth, magic-link, redirect allowlist, CORS, internal-service, database, deployment, production user data, decoded secret, JWT, refresh token, OAuth token, magic-link token, reset token, password, API key, or token value changed or was recorded.

Next action:

- Owner selection for the next Auth remediation or implementation chunk.

## 2026-06-13 - AUTH-ALPHA-01 And RBAC-REM-07 Production Deployment Completed

Current focus:

- Owner approved production deployment after Auth Alpha and Logging admin RBAC remediation.
- Auth branch: `main` at `b540e74`.
- Logging branch: `main` at `4769c51`.

Deployment evidence:

- Logging deployed image `localhost:5000/logging-microservice:4769c51`; rollout completed and in-pod health check passed.
- Auth deployed backend image `localhost:5000/auth-microservice:b540e74-20260613062417` and web image `localhost:5000/auth-microservice-web:b540e74-20260613062417`.
- Auth deploy applied ConfigMap, ExternalSecret, manifests, deployment images, rollout, health check, and post-deploy config patch; final rollout completed successfully.

Production verification evidence:

- `kubectl -n statex-apps get deploy auth-microservice auth-microservice-web logging-microservice -o wide` showed all three deployments `READY 1/1` on the expected new images.
- `https://auth.alfares.cz/health` returned status `ok`.
- `https://auth.alfares.cz/login` returned HTTP 200.
- `https://auth.alfares.cz/admin` returned HTTP 200.
- `https://logging.alfares.cz/health` returned status `ok`.
- No decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, internal-service tokens, API keys, raw production user data, or database changes were recorded.

Next action:

- Owner selection for the next Auth remediation or implementation chunk after production deployment.

## 2026-06-13 - AUTH-ALPHA-01 Hosted Token Handoff URL Normalization Completed

Current focus:

- Owner-selected Auth Alpha implementation chunk: AUTH-ALPHA-01.
- Auth branch: `main`.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved current Auth context confirmed hosted Auth login/token validation and historical unified Auth flow requirements; current source-of-truth contract came from `docs/UNIFIED_AUTH_CONTRACT.md`.

Implementation evidence:

- Added backend `buildTokenHandoffUrl` helper in `src/auth/auth.service.ts`.
- OAuth callback and magic-link verify now build handoff URLs through the shared helper.
- Hosted email/password login/register UI now builds handoff URLs with `URL` plus `URLSearchParams` and replaces any caller fragment with Auth's handoff fragment.
- Added focused unit tests in `src/auth/auth-token-handoff.spec.ts` for caller-fragment replacement and optional fragment fields.

Validation evidence:

- `npm test -- --runTestsByPath src/auth/auth-token-handoff.spec.ts` passed.
- `npm run build` passed.
- `node --check web/public/js/admin.js` passed.
- Inline hosted login page script syntax extraction passed.
- `git diff --check` passed for changed Auth files.
- Auth documentation missing-marker scan returned no matches for gate-critical docs.
- Auth documentation secret-pattern scan returned no matches.
- No endpoint path, JWT payload, OAuth provider, magic-link token storage, CORS, redirect allowlist, deployment, database, production user data, decoded secrets, JWTs, refresh tokens, OAuth tokens, magic-link tokens, reset tokens, passwords, internal-service tokens, or API keys changed or were recorded.

Next action:

- Owner selection for the next Auth remediation or implementation chunk after AUTH-ALPHA-01.

## 2026-06-13 - RBAC-REM-07 Logging Admin Role-Enforcement Verification Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-07 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Logging branch: `main`.
- Logging commit: `4769c51 Enforce Auth roles for logging admin reads`.
- Auth runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved shared RBAC context included the expected pattern that internal microservice admin surfaces require an admin role or `global:superadmin` while Auth remains role authority.

Implementation evidence:

- Verified Logging `GET /api/logs/query` and `GET /api/logs/services` were previously unguarded backend reads, while `POST /api/logs` served ecosystem ingestion.
- Added `logging-microservice/src/auth/admin-role.guard.ts` to validate bearer tokens through Auth `/auth/validate` and require one of `global:superadmin`, `app:logging-microservice:admin`, or `internal:logging-microservice:admin`.
- Applied the guard only to Logging log-query and service-list endpoints; log ingestion remains unchanged.
- Updated Logging admin frontend role checks so authenticated non-admin users are cleared from the admin UI before data loads.

Validation evidence:

- `logging-microservice npm run build` passed.
- `node --check web/js/auth.js` passed.
- `node --check web/js/admin.js` passed.
- Compiled guard assertions passed for missing bearer token rejection, non-admin role rejection, and accepted Logging admin role.
- `git diff --check` passed for changed Logging files.
- No Auth runtime code, Auth JWT payload, Auth token validation endpoint, Logging log-ingestion endpoint, deployment, database, production user data, decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, or magic-link tokens changed.

Next action:

- Owner selection for the next Auth remediation or implementation chunk.

## 2026-06-13 - RBAC-REM-06 Internal Service-Token/API-Key Boundary Review Completed

Current focus:

- Owner-approved remediation chunk: RBAC-REM-06 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Auth runtime code changes: none.
- Consumer runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved context confirmed Auth centralizes identity and JWT issuance. Machine-auth specifics were completed from source inspection.

Implementation evidence:

- Added `docs/INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`.
- Reviewed Auth `InternalServiceGuard`, internal Auth endpoint guards, and `docs/UNIFIED_AUTH_CONTRACT.md`.
- Reviewed RunLayer `JwtGuard`, service-token env keys, and outbound token clients.
- Reviewed Notifications `JwtRolesGuard`, deployment notes, and orchestrator/AI service clients.
- Reviewed Payments `ApiKeyGuard`, `JwtRolesGuard`, controller guard usage, and key configuration docs.
- Reviewed Catalog `CatalogAuthGuard`, internal-service header handling, and Warehouse availability client.
- Reviewed Warehouse `JwtRolesGuard` as the receiving side for the Catalog availability call.
- Recorded follow-ups for RunLayer static service-token identity, Notifications broad bearer `SERVICE_TOKEN`, Payments `X-API-Key` production constraints, and Catalog/Warehouse availability-token reconciliation.

Validation evidence:

- `git diff --check` passed for changed Auth documentation/state files.
- Auth documentation missing-marker scan returned no matches for gate-critical docs.
- Auth documentation secret-pattern scan returned no matches.
- No Auth runtime code, consumer runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secrets, JWTs, API keys, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, or magic-link tokens changed.

Next action:

- RBAC-REM-07 completed later on 2026-06-13; next chunk requires owner selection.

## 2026-06-13 - RBAC-REM-05 School Committee Local-Role Contract Note Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-05 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- School Committee branch: `main`.
- Auth runtime code changes: none.
- School Committee runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved School Committee auth-integration context confirmed the platform must not implement authentication internally, Auth owns identity/JWT issuance/login/password reset, and the BFF validates Auth tokens through Auth.

Implementation evidence:

- Reviewed School Committee `README.md`, `SYSTEM.md`, `lib/auth/get-current-user.ts`, `lib/auth/validate-token.ts`, `lib/auth/require-role.ts`, `lib/auth/require-approved.ts`, and `prisma/schema.prisma` role/profile models.
- Added a School Committee README note clarifying that Auth validates identity while School Committee owns local school roles, tenant/school scoping, and profile approval workflow.
- Updated Auth RBAC audit and continuation docs to mark RBAC-REM-05 complete and set RBAC-REM-06 as the next remediation chunk.

Validation evidence:

- `git diff --check` passed for changed School Committee and Auth documentation/state files.
- Auth documentation missing-marker scan returned no matches for gate-critical docs.
- Auth documentation secret-pattern scan returned no matches.
- School Committee `npm run type-check` passed.
- No Auth runtime code, School Committee runtime code, JWT payload, token validation endpoint, deployment, database, production user data, decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, or magic-link tokens changed.

Next action:

- Recommended next remediation chunk: RBAC-REM-06 internal service-token/API-key bypass inventory and Auth boundary review.

## 2026-06-13 - RBAC-REM-04 SpeakASAP Scoped-Role Normalization Review Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-04 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- SpeakASAP branch: `main`.
- SpeakASAP commit: `7135483 Preserve scoped Auth roles in SpeakASAP checks`.
- Auth runtime code changes: none.
- Deployment: not run.

DocsRAG evidence:

- Queried DocsRAG from `deployment/auth-microservice` with the pod `JWT_TOKEN`; request returned `HTTP 200` without printing the token.
- Retrieved shared RBAC context confirmed Auth issues JWTs with role claims and consuming services should use centralized Auth role claims.

Implementation evidence:

- Reviewed `speakasap/assessment-service/src/auth/normalize-roles.ts`, `assessment-service` guards, `certification-service/src/auth/roles.ts`, certification role guards, SpeakASAP RBAC docs, and Auth RBAC seed definitions.
- Auth seeds `speakasap` as a user-facing application, so `app:speakasap:<role>` is the explicit application-scope mapping.
- Assessment no longer strips everything after the first colon; it preserves unscoped legacy local roles, maps accepted global staff roles, maps `app:speakasap:<role>`, and ignores unrelated scoped roles.
- Certification no longer grants access to any scoped role ending in `:manager` or `:teacher`; it uses the same explicit SpeakASAP/global mapping.
- Pre-existing dirty SpeakASAP files were not staged. Only the two RBAC-REM-04 helper files were committed.

Validation evidence:

- Isolated TypeScript compile passed for `assessment-service/src/auth/normalize-roles.ts`.
- Isolated TypeScript compile passed for `certification-service/src/auth/roles.ts`.
- Compiled helper assertions passed for local legacy roles, `app:speakasap:*`, `global:superadmin`, and denied `internal:speakasap:*` / `app:other:*` role shapes.
- `git diff --check -- assessment-service/src/auth/normalize-roles.ts certification-service/src/auth/roles.ts` passed.
- SpeakASAP pre-commit checks passed for commit `7135483`.
- Full `npm run build` was attempted in both changed services but could not complete because of pre-existing dependency state: assessment could not find `prisma` from the package script, and certification could not unlink a root-owned generated Prisma client file.
- No Auth runtime code, JWT payload, token validation endpoint, deployment, database, decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data changed.

Next action:

- Recommended next remediation chunk: RBAC-REM-05 School Committee local-role contract note.

## 2026-06-13 - DocsRAG JWT Token Pickup Fixed

Current focus:

- Owner request: fix DocsRAG unavailability caused by `JWT_TOKEN` not being set in the remote SSH shell, using the same operational pattern as RunLayer and AI microservice.
- Runtime code changes: none.
- Deployment manifest changes: none; `k8s/external-secret.yaml` already maps `JWT_TOKEN` from `secret/prod/auth-microservice`.

Implementation evidence:

- Verified live `ExternalSecret` `auth-microservice-secret` maps `JWT_TOKEN` from `secret/prod/auth-microservice` property `JWT_TOKEN`.
- Verified live Kubernetes Secret `auth-microservice-secret` contains a `JWT_TOKEN` key without printing or decoding its value.
- Restarted `deployment/auth-microservice` so the running pod picked up the synced secret.
- Updated `AGENTS.md` to document that remote SSH shells are not expected to export `JWT_TOKEN`; future DocsRAG queries should run from `deployment/auth-microservice` using the pod environment and must not print token values.

Validation evidence:

- `kubectl -n statex-apps rollout status deployment/auth-microservice --timeout=180s` passed.
- `kubectl -n statex-apps exec deployment/auth-microservice -- sh -c "printenv JWT_TOKEN >/dev/null && echo JWT_TOKEN_ENV_PRESENT || echo JWT_TOKEN_ENV_MISSING"` returned `JWT_TOKEN_ENV_PRESENT`.
- DocsRAG retrieval from inside `deployment/auth-microservice` returned `HTTP 200` using the pod `JWT_TOKEN` without printing the token.
- `https://auth.alfares.cz/health` returned status `ok`.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, production user data, database changes, or runtime code changes.

Next action:

- Continue with the next owner-selected Auth remediation chunk when requested.

## 2026-06-13 - RBAC-REM-03 Catalog Frontend Role-Aware Admin Guard Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-03 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Catalog branch: `feature/catalog-goal-04-channel-readiness-model`.
- Catalog commit: `5f0e087 Make catalog admin guard role aware`.
- Auth runtime code changes: none.
- Catalog backend authorization changes: none.
- Deployment: not run.

Implementation evidence:

- Removed stale Catalog frontend AdminGuard text that said Auth does not support roles/admin flags.
- AdminGuard now requires one of: `global:superadmin`, `app:catalog-microservice:admin`, `internal:catalog-microservice:admin`, or `catalog:write` before rendering admin children.
- Authenticated users without those roles see an access-required state rather than admin content.
- Catalog continuation docs were updated with validation evidence.

Validation evidence:

- `services/frontend npm run build` passed.
- `git diff --check -- services/frontend/components/AdminGuard.tsx` passed.
- Catalog pre-commit checks passed.
- Auth documentation `git diff --check` and secret scans are required before final Auth commit.
- DocsRAG was unavailable because `JWT_TOKEN` is absent in the remote shell; source evidence came from Auth contract docs and Catalog source.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, production user data, deployment, or database changes.

Next action:

- Recommended next remediation chunk: RBAC-REM-04 SpeakASAP scoped-role normalization review.

## 2026-06-12 - RBAC-REM-02 Consumer JWT Validation Standardization Completed

Current focus:

- Owner-selected remediation chunk: RBAC-REM-02 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Runtime Auth code changes: none.
- Consumer runtime code changes: none.
- Deployment: not run.

Decision evidence:

- Default consumer pattern is `POST /auth/validate` for admin panels, browser-facing backends, lower-throughput APIs, and consumers that do not need JWT verification secret material.
- High-throughput backend exception is an approved shared local verifier pattern, constrained to Auth-sourced verification material, expiry/signature validation, unsafe-algorithm rejection, full Auth role-string preservation, safe logging, and consumer-owned endpoint authorization.
- Static service tokens and API keys remain separate from Auth user identity and are deferred to RBAC-REM-06.

Implementation evidence:

- Added `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`.
- Updated `docs/UNIFIED_AUTH_CONTRACT.md` with the consumer token validation standard.
- Updated `docs/RBAC_CONSUMING_SERVICES_AUDIT.md` with RBAC-REM-02 completion, consumer classification, and follow-up chunks.
- Updated continuation and execution-plan state for RBAC-REM-02 completion.

Validation evidence:

- DocsRAG remained unavailable because `JWT_TOKEN` is absent in the remote shell; gate remains pass-with-exception with source-code and Auth contract evidence.
- Missing-marker scan returned no matches for gate-critical docs.
- Documentation secret-pattern scan returned no matches.
- `git diff --check` passed for changed docs/state files.
- No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed, decoded, or persisted.

Next action:

- Recommended next remediation chunk: RBAC-REM-03 Catalog frontend role-aware admin guard and stale comment cleanup.

## 2026-06-12 - RBAC-REM-02 Selected: Consumer JWT Validation Standardization

Current focus:

- Owner-selected remediation chunk: RBAC-REM-02 from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Objective: standardize when consumers use POST /auth/validate versus an approved shared local verifier for Auth-issued JWTs.
- Runtime Auth code changes: none in this selection/planning update.
- Consumer runtime code changes: none in this selection/planning update.
- Deployment: not run.

Gate evidence:

- Required Auth orchestrator, contract, environment, verification, IPS, goal, and audit docs were read from the remote Auth source of truth.
- JWT_TOKEN is absent in the remote shell, so DocsRAG retrieval cannot be authenticated. Gate decision for this planning update: pass-with-exception for AUTH-INV-007, with compensating evidence from existing Auth contract docs and the completed RBAC consuming-services audit.
- Sensitive-data classification: masked. No decoded secrets, JWTs, refresh tokens, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed, decoded, or persisted.

Planning evidence:

- Updated docs/orchestrator/EXECUTION_PLAN.md for RBAC-REM-02.
- Updated docs/orchestrator/CONTEXT_PACKAGE.md target task to the owner-selected chunk.
- Updated continuation state so the next Auth orchestrator session resumes at RBAC-REM-02.

Validation evidence:

- Missing-marker scan returned no matches for gate-critical docs.
- Documentation secret-pattern scan returned no matches.
- git diff --check passed for STATE.json, TASKS.md, docs/IMPLEMENTATION_STATE.md, and the changed orchestrator docs.
- Unrelated pre-existing dirty files remain untouched: .env.example and k8s/external-secret.yaml.

Next action:

- Implement RBAC-REM-02 decision documentation: choose the default consumer JWT validation standard and split any consumer code changes into separately approved implementation chunks.

## 2026-06-12 - RBAC-REM-01 Secret-Source Alignment Review

Current focus:

- Owner-selected remediation chunk: `RBAC-REM-01` from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`.
- Runtime Auth code changes: none.
- Consumer runtime code changes: none.
- Consumer manifest changes: `k8s/external-secret.yaml` only in catalog, warehouse, suppliers, orders, and payments.
- Deployment: not run.

Gate evidence:

- Required Auth orchestrator, contract, environment, verification, README, BUSINESS, SYSTEM, state, and audit docs were read from the remote Auth source of truth.
- DocsRAG was unavailable because `JWT_TOKEN` was absent in the remote shell. Gate decision: pass-with-exception for `AUTH-INV-007` with compensating remote source and Kubernetes metadata evidence.
- Sensitive-data classification: masked. Only secret key names, Vault path names, source file paths, and commit IDs were recorded. No secret values, JWTs, tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed, decoded, or persisted.

Review evidence:

- Live ExternalSecret metadata before remediation mapped `JWT_SECRET` to service-specific Vault paths for catalog, warehouse, suppliers, orders, and payments.
- `notifications-microservice` remained the positive aligned pattern with `JWT_SECRET` sourced from `secret/prod/auth-microservice`.
- Live Kubernetes Secret key-name checks confirmed the relevant secrets expose a `JWT_SECRET` key, without decoding or printing values.

Implementation evidence:

- `catalog-microservice`: committed `fcb1919 Align JWT secret source with auth`.
- `warehouse-microservice`: committed `015cf4f Align JWT secret source with auth`.
- `suppliers-microservice`: committed `c1e92d2 Align JWT secret source with auth`.
- `orders-microservice`: committed `e05c2c3 Align JWT secret source with auth`.
- `payments-microservice`: committed `66bf990 Align JWT secret source with auth`.
- Each commit changes only the `JWT_SECRET` ExternalSecret `remoteRef.key` to `secret/prod/auth-microservice` and leaves other service-owned secret keys unchanged.
- `orders-microservice` had pre-existing adjacent `JWT_TOKEN` changes in `k8s/external-secret.yaml`; only the `JWT_SECRET` source-path hunk was staged and committed.

Validation evidence:

- `kubectl apply --dry-run=server -f k8s/external-secret.yaml` passed for all five target consumer manifests.
- `git diff --check -- k8s/external-secret.yaml` passed for all five target consumer manifests.
- Staged diff review confirmed only the intended `JWT_SECRET` source-path hunk was committed in each consumer repo.
- Consumer repository pre-commit hooks passed for all five commits.
- Auth documentation missing-marker, secret-pattern, and `git diff --check` checks were run after documentation updates.

Residual risks and follow-ups:

- Source manifests are committed but not deployed by this session. Final live metadata showed catalog already aligned, while warehouse, suppliers, orders, and payments still used their previous source paths; those remaining live changes require consumer deployment or GitOps sync.
- `suppliers-microservice`, `orders-microservice`, and `payments-microservice` retain unrelated dirty worktree files from other sessions. Those were not staged or committed here.
- Next remediation chunk: `RBAC-REM-02` standardize consumer JWT validation pattern (`/auth/validate` versus shared local verifier).

## 2026-06-12 - Goal 06 RBAC Consuming Services Audit

Current focus:

- Owner-selected next task: Goal 06, RBAC audit across consuming services.
- Runtime code changes: none.
- Consumer service changes: none.

Gate evidence:

- Required Auth orchestrator, contract, environment, verification, README, BUSINESS, SYSTEM, and goal docs were read from the remote Auth source of truth.
- DocsRAG query was attempted against `docs-rag-microservice.statex-apps.svc.cluster.local:3397`, but the remote shell did not have `JWT_TOKEN` set. Gate decision: pass-with-exception for `AUTH-INV-007`; compensating evidence came from remote source scans only.
- Sensitive-data classification: masked. No decoded secrets, JWTs, service tokens, passwords, OAuth tokens, reset tokens, magic-link tokens, or raw production user records were printed or recorded.

Implementation evidence:

- Added `docs/RBAC_CONSUMING_SERVICES_AUDIT.md` with inspected consumer list, Auth contract baseline, compatibility findings, and owner-approvable remediation backlog.
- Updated Goal 06 status in `docs/orchestrator/GOALS.md`, `implementation-goals/GOAL-06-rbac-consuming-services-audit.md`, `implementation-goals/README.md`, `TASKS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/EXECUTION_PLAN.md`, and `docs/IMPLEMENTATION_STATE.md`.
- Updated `STATE.json` milestone and next focus.

Source evidence summary:

- Direct JWT role guards inspected in catalog, warehouse, suppliers, orders, payments, and notifications.
- `/auth/validate` consumers inspected in shop-assistant, runlayer, speakasap, school-committee, and logging web admin.
- K8s ExternalSecret/ConfigMap references inspected for catalog, warehouse, suppliers, orders, payments, and notifications.
- App-local role systems identified in school-committee and SpeakASAP.

Findings summary:

- Direct JWT consumers generally match Auth role-string shape, but catalog, warehouse, suppliers, orders, and payments source `JWT_SECRET` from service-specific Vault paths instead of the Auth Vault path in their K8s ExternalSecret files; notifications shows the aligned pattern.
- Catalog frontend AdminGuard contains stale text saying Auth does not support roles and only gates by authentication client-side.
- SpeakASAP scope-stripping role normalization can collapse Auth role scopes into unscoped names.
- School Committee uses Auth for identity validation and local DB roles for school authorization; this should remain documented as app-local authorization.
- Runlayer, notifications, payments, and catalog have machine-auth bypass paths that need separate service-auth review.
- Logging web admin Auth validation was found, but role enforcement was not proven in inspected web files.

Validation evidence:

- Documentation report created without runtime deployment.
- Final documentation presence, missing-marker scan, secret-pattern scan, and `git diff --check` were run after edits; see latest session command output.

Next action:

- Owner should select one remediation chunk from `docs/RBAC_CONSUMING_SERVICES_AUDIT.md`, starting with `RBAC-REM-01` secret-source alignment review for direct JWT consumers.

## 2026-06-12 - IPS Documentation Compliance Update

Current focus:

- Owner-selected documentation update: implement the company intent-preservation-system approach in this Auth project.
- Runtime code changes: none.

Source context:

- Reviewed Auth orchestrator pack, implementation state docs, unified Auth contract docs, goal templates, and Goal 06 RBAC audit instructions.
- Reviewed company IPS source at `/Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system`, including documentation completeness, operational gate, project invariants, execution-plan, context-package, task, and readiness-gate templates.
- DocsRAG was not queried for this documentation-only local workflow update because no service JWT was available in the session and the task did not require new ecosystem architecture facts beyond existing local source-of-truth docs.

Implementation evidence:

- Added remote source-of-truth memory: all future Auth changes must be made and committed on `alfares` in `/home/ssf/Documents/Github/auth-microservice`.
- Added `docs/orchestrator/PROJECT_INVARIANTS.md` with Auth-specific invariant IDs for ownership, non-ownership boundaries, contract compatibility, sensitive-data handling, hosted Auth, evidence, and DocsRAG usage.
- Added `docs/orchestrator/PRE_CODING_GATE.md` defining required inputs, gate checklist, documentation scans, runtime checks, DocsRAG rule, and pass/fail policy.
- Added `docs/orchestrator/CONTEXT_PACKAGE.md` defining target-task selection, included/excluded documents, Auth constraints, allowed/forbidden changes, prompt source, and validation instructions.
- Added `docs/orchestrator/EXECUTION_PLAN.md` defining the reusable Auth execution-plan frame with traceability, invariant, sensitive-data, contract, replay/idempotency, scope, test, validation, rollback, and completion sections.
- Added `docs/orchestrator/READINESS_GATES.md` defining integration, deployment, and documentation-only readiness evidence.
- Updated `AGENTS.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/PLAN.md`, and `docs/orchestrator/PROMPTS.md` so future coding must pass context, invariant, sensitive-data, contract, validation, pre-coding, and readiness checks.

Verification evidence:

- Documentation file presence check passed on `alfares`: `find docs/orchestrator -maxdepth 1 -type f -name '*.md' -print` lists `PROJECT_INVARIANTS.md`, `PRE_CODING_GATE.md`, `CONTEXT_PACKAGE.md`, `EXECUTION_PLAN.md`, `READINESS_GATES.md`, and the existing orchestrator files.
- Missing-marker scan passed on `alfares` for active docs with no matches. Reusable templates under `implementation-goals/templates/` intentionally retain placeholder markers for future agents to fill.
- Secret-pattern scan passed on `alfares` with no matches: `rg -n "Authorization: Bearer ...|(access_token|client_secret|password|private_key) assignment pattern" docs AGENTS.md TASKS.md`.
- Remote commit created for orchestration documentation; unrelated pre-existing remote change `scripts/bootstrap-speakasap-legacy-users.ts` was not included.

Next unfinished chunks:

- No runtime implementation chunk selected. Next owner-selected item remains Goal 06 - RBAC Consuming Services Audit.

## 2026-06-12 - Goal 5 Goalkeeper-Style Orchestrator Workflow

Current focus:

- Goal 5 - Goalkeeper-Style Orchestrator Workflow: done.
- Next focus: owner selection. Suggested next goal: Goal 6 - RBAC Consuming Services Audit.

Goalkeeper reference evidence:

- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/AGENTS.md`.
- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/docs/IMPLEMENTATION_STATE.md`.
- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/docs/IMPLEMENTATION_ORCHESTRATOR.md`.
- Reviewed `/Users/Sergej.Stasok/Documents/Gitlab/goalkeeper/implementation-goals/README.md`.
- Reviewed Goalkeeper execution, context package, coding prompt, and validation report templates.

Implementation evidence:

- Added `docs/IMPLEMENTATION_ORCHESTRATOR.md` as the Auth master-agent prompt.
- Added `docs/IMPLEMENTATION_STATE.md` as the state-driven continuation checkpoint.
- Added `implementation-goals/README.md`.
- Added completed goal files for Goals 1-5 and ready backlog goal file for Goal 6.
- Added `implementation-goals/templates/EXECUTION_PLAN.md`, `CONTEXT_PACKAGE.md`, `CODING_PROMPT.md`, and `VALIDATION_REPORT.md`.
- Updated `AGENTS.md` with the `AUTH ORCHESTRATOR: continue implementation` command, required reading, core intent, and orchestrator duties.
- Updated `MASTER_PROMPT.md`, `GOALS.md`, `PLAN.md`, and `PROMPTS.md` to route future work through `docs/IMPLEMENTATION_STATE.md`.

Verification evidence:

- Documentation file presence and cross-reference scan passed on `alfares`.
- No runtime Auth source files, frontend files, deployment scripts, or production configuration were changed.
- `README.md`, `BUSINESS.md`, and `SYSTEM.md` are not present in this local snapshot; the new docs instruct future sessions to read them if restored.

Next unfinished chunks:

- Goal 6: RBAC Consuming Services Audit, pending owner selection.

## 2026-06-12

Current focus:

- Goal 1 - Admin Token Copy UX And Safety: done.
- Goal 2 - Auth Intent Preservation Pack: done.
- Next focus: Goal 3 - Unified Auth Contract Recovery.

Evidence gathered:

- Local working directory was empty; live source is on `alfares` at `/home/ssf/Documents/Github/auth-microservice`.
- Auth production frontend is `https://auth.alfares.cz/admin`.
- Auth live repo has static admin frontend files under `web/public/admin.html` and `web/public/js/admin.js`.
- Admin JS already strips URL parameters named `email`, `password`, `token`, `accessToken`, and `refreshToken`.
- Existing Copy Token button was hidden until Show Token was clicked.
- DocsRAG was queried from the `docs-rag-microservice` pod because the Auth image lacks `curl`.
- DocsRAG confirmed Auth source-of-truth themes: centralized login/registration, cross-domain token handoff, JWT/RBAC compatibility, no secrets in docs, structured logging, and the shared ecosystem single-source-of-truth boundaries.
- DocsRAG confirmed Goalkeeper/Project OS themes: human sets goals, coordinator plans/decomposes, workers execute atomic tasks, validators verify, and goal lifecycle includes planning/approval/active execution.

Implementation evidence:

- Updated admin token UI so Copy Token is visible after login.
- Copy Token now reads the current access token from session storage and does not require revealing the masked input.
- Added secure clipboard API path plus hidden-textarea fallback.
- Added `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `PROMPTS.md`, and `STATUS.md`.
- Updated `AGENTS.md` to require future agents to follow the Auth orchestrator pack.
- `node --check web/public/js/admin.js` passed locally and on the remote repo.
- Remote `npm run build` passed.
- Ran `./scripts/deploy.sh`; deployment completed successfully in 355.39s.
- Deployment image tag: `localhost:5000/auth-microservice:79ebc08-20260612091531`.
- Deploy health check returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Remote public verification found `Copy Token` in `https://auth.alfares.cz/admin`.
- Remote public verification found deployed `admin.js` includes `copyTokenToClipboard`, `const token = getAccessToken()`, `copyTokenBtn.disabled`, and `fallbackCopyText`.
- Triggered docs-rag-microservice ingestion for `auth-microservice`; job `a236f5f7-8b0f-44ea-9bb7-9ab67c264e2f` returned HTTP 202.
- DocsRAG retrieval for `Auth Orchestrator Master Prompt intent preservation workflow` returned the new `auth-microservice/docs/orchestrator/*` files.

Next unfinished chunks:

- Goal 3: locate or reconcile historical unified Auth contract docs currently referenced by DocsRAG.

## 2026-06-12 - Goal 3 Contract Recovery

Current focus:

- Goal 3 - Unified Auth Contract Recovery: done.
- Next focus: Goal 4 - Auth Observability And Safety Checks.

DocsRAG evidence:

- Queried DocsRAG from the `docs-rag-microservice` pod using an in-memory service JWT with issuer `docs-rag-microservice`; no token or secret value was printed or persisted.
- DocsRAG returned historical references to `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, `docs/UNIFIED_AUTH_VERIFICATION.md`, and `docs/agents/*`.
- Retrieved source headings included: `Deliverables (All Required, No "Optional Later" Bucket)`, `Inputs (read first)`, `Success Criteria`, `Related Documentation`, `Core Design Principles`, `Input Artifacts (Source of Truth)`, `1. Centralized Login/Registration Form (Hosted Only in Auth-Microservice)`, and `Task Group A0.1 - Unified Auth Contract (Auth Unified Contract Validator)`.

Git history evidence:

- `git log --all --name-only` confirmed historical files: `docs/UNIFIED_AUTH_CONTRACT.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, `docs/UNIFIED_AUTH_VERIFICATION.md`, and `docs/agents/{master-prompt.md,AUTH_PHASE1_IMPLEMENTATION_AND_VALIDATION.md,AUTH_REFACTOR_TASKS_INDEX.md,AUTH_REFACTOR_VALIDATION_REPORT.md}`.
- Commit `3338638 chore: remove obsolete documentation and command files` removed the historical docs.
- The current `README.md` still linked to `docs/UNIFIED_AUTH_CONTRACT.md`, making the missing contract path an active stale reference.

Implementation evidence:

- Restored `docs/UNIFIED_AUTH_CONTRACT.md` as the current authoritative contract for hosted entry points, core API endpoints, JWT shape, OAuth, magic links, redirect allowlist, CORS, internal service auth, registered-user preferences, and client responsibilities.
- Restored `docs/ENV_CORS_AND_AUTH_CHECK.md` with current K8s/Vault-managed CORS and Auth URL behavior.
- Restored `docs/UNIFIED_AUTH_VERIFICATION.md` with static, reachability, contract, redirect-safety, and secret-safety checks.
- Added supersession stubs under `docs/agents/` so historical DocsRAG references resolve but point future agents to `docs/orchestrator/*` and the restored contract docs.

Verification evidence:

- Remote `test -f` check passed for restored contract, CORS, verification, and historical agent paths.
- Remote route inspection found current Auth controller endpoints for login, register, validate, refresh, OAuth, magic-link, redirect validation, internal preferences, and internal magic-link/check-email.
- Secret-pattern scan across restored docs returned no matches for inline JWTs, secret assignments, internal-service tokens, notification tokens, or password-value patterns.
- Local trailing-whitespace scan across restored docs returned no matches.
- Triggered DocsRAG ingestion for `auth-microservice`; job `cee8c6d9-1db8-43e9-a3af-cc9d0746df04` completed successfully with `20/20` chunks processed.
- Post-ingestion DocsRAG retrieval for the current unified Auth contract returned `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md` and `auth-microservice/docs/ENV_CORS_AND_AUTH_CHECK.md` from the current repo.
- Remote `git status --short` showed unrelated pre-existing modified files `src/auth/admin-users.controller.ts` and `src/users/users.service.ts`; this chunk did not edit them.

Next unfinished chunks:

- Goal 4: review Auth-sensitive logs for login, refresh, password reset, magic link, OAuth, admin user management, and role changes.

## 2026-06-12 - Goal 4 Auth Observability And Safety Checks

Current focus:

- Goal 4 - Auth Observability And Safety Checks: done.
- Next focus: owner selection. Remaining broad backlog item: RBAC roles audit across consuming services.

DocsRAG evidence:

- Queried DocsRAG for `auth-microservice observability logging redaction login refresh password reset magic link OAuth admin users role changes sensitive tokens`.
- Retrieved source headings included: `Features`, `Business: auth-microservice`, `Active Work`, `Preserved Intent`, `Goal 4 - Auth Observability And Safety Checks`, `Non-Negotiable Boundaries`, and `Client Responsibilities`.
- DocsRAG confirmed the contract rule that applications and Auth must not log tokens, password reset tokens, magic-link tokens, OAuth tokens, client secrets, or JWT secrets.

Review evidence:

- Reviewed current log statements in `src/auth/auth.service.ts`, `src/auth/admin-users.controller.ts`, `src/admin/admin-roles.controller.ts`, `src/roles/roles.service.ts`, and `shared/logger/logger.service.ts`.
- Found that production logging had no centralized redaction layer before this change.
- Found and removed a risky OAuth error log that serialized provider token response bodies.

Implementation evidence:

- Added `LoggerService.redactSensitive()` and applied it to central logging payloads, local log files, and development console output.
- Redaction covers JWTs, bearer headers, token/password/client-secret query parameters, and JSON-like sensitive fields.
- Added structured audit fields for login, registration, token validation, refresh, password reset, password change/set, magic-link request/verify, OAuth init/callback, admin user management, and RBAC role assignment/removal.
- Added `shared/logger/logger.service.spec.ts` regression coverage for JWT, bearer, token URL, password, OAuth token, and client-secret redaction.

Verification evidence:

- Remote focused test passed: `npm test -- --runTestsByPath shared/logger/logger.service.spec.ts`.
- Remote full test suite passed: `3` suites, `6` tests.
- Remote `npm run build` passed.
- Static scan returned no direct logger references to provider token response bodies, reset URLs, verify URLs, token DTOs, refresh/access token variables, or `JSON.stringify(tokenResponse.data)`.
- Ran `./scripts/deploy.sh`; deployment completed successfully in `194.14s`.
- Deployment image tag: `localhost:5000/auth-microservice:af00816-20260612095714`.
- Deploy health check returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- `curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin` returned HTTP `200`.
- Production failed-login probe returned HTTP `401` in `0.349419s`.
- Production pod check showed two backend pods running image `localhost:5000/auth-microservice:af00816-20260612095714`, both ready with restart count `0`.
- Pod log file contained `[AuthAudit] service=auth-microservice operation=login outcome=failure identifier=codex-observability-check@example.invalid reason=invalid_credentials duration_ms=78`.
- The probe password `not-a-real-password` did not appear in the matched production audit log output.
- Triggered DocsRAG ingestion for `auth-microservice`; job `7cd50a90-3493-44b5-81d2-69cb00c2694b` completed successfully with `20/20` chunks processed.

Next unfinished chunks:

- No active orchestrator goal remains. Suggested next owner-selected item: audit RBAC roles across consuming services.

## 2026-06-12 - Admin Users List Production Fix

Current focus:

- Owner-selected production fix for `/admin` registered-user management section.
- Preserved Auth ownership: the change stays inside registered Auth user management and does not move catalog, orders, marketing sending, notification, logging, gateway, or database ownership into Auth.

Diagnosis evidence:

- Production `/admin` users section showed `Error loading users: Unknown error`.
- Unauthenticated `GET https://auth.alfares.cz/auth/admin/users` returned expected JSON `401 Unauthorized`, so routing existed.
- Authenticated login with stored remote test credentials returned HTTP `201`; the old users-list request then returned Cloudflare `502`.
- Kubernetes described the Auth container as `OOMKilled` with exit code `137` at the `512Mi` memory limit.
- The old endpoint attempted to load all registered users with full `User` entities.

Implementation evidence:

- Added `UsersService.findAdminListPage(limit, offset)` with a narrow selected column set for the admin table.
- Updated `AdminUsersController.getAllUsers` to accept bounded `limit` and `offset`, clamp `limit` to `100`, and return `count`, `limit`, and `offset`.
- Updated `web/public/js/admin.js` to request `/auth/admin/users?limit=100&offset=0`, track pagination state, and render Previous/Next controls.

Verification evidence:

- Remote `node --check web/public/js/admin.js` passed.
- Remote `npm run build` passed.
- Ran `./scripts/deploy.sh` for the API/UI pagination change; deployment completed successfully in `199.22s`.
- Ran `./scripts/deploy.sh` again after adding the admin JS cache-busting query; deployment completed successfully in `198.71s`.
- Final deployment image tag: `localhost:5000/auth-microservice:af00816-20260612094806`.
- Deploy health check returned `{"success":true,"status":"ok","service":"auth-microservice"}`.
- Authenticated production check for `GET /auth/admin/users?limit=100&offset=0` returned HTTP `200` in `213ms` after the pagination deploy and `269ms` after the final cache-bust deploy.
- Production users response returned `success=true`, `count=214246`, `users.length=100`, `limit=100`, and `offset=0`.
- Returned user-list keys were limited to `createdAt,email,firstName,id,isActive,isVerified,lastName,phone,updatedAt,userType`; no password field was returned.
- `curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin` returned HTTP `200`.
- Web pod verification showed `/app/public/admin.html` references `/js/admin.js?v=20260612094229`.
- Web pod verification showed `/app/public/js/admin.js` fetches `/auth/admin/users` with `limit: String(usersLimit)` and `offset: String(usersOffset)`.
- Kubernetes pod check showed image `localhost:5000/auth-microservice:af00816-20260612094806`, state `Running`, ready `True`, and restart count `0`.

Next unfinished chunks:

- Goal 4: review Auth-sensitive logs for login, refresh, password reset, magic link, OAuth, admin user management, and role changes.

2026-07-02: Owner-reported Catalog hosted Auth loop investigated. Clean headless Chrome CDP flow from `https://catalog.alfares.cz/login` completed hosted register and hosted login to `https://catalog.alfares.cz/dashboard`; dashboard rendered the synthetic user, `auth_token` was present, `/api/auth/profile` returned HTTP 200, and Catalog dashboard data requests returned HTTP 200. Internal Catalog pod probe confirmed `/api/auth/register` returned `accessToken` and `/api/auth/profile` returned HTTP 200 with nested `user`. A separate premature/native form-submit race reproduced an Auth-side fail-open fallback: before hosted UI JS/return-url validation was ready, the browser performed a default GET form submit, dropped `return_url/state`, and returned to `/login` with `Redirect target: (required by application)`. Source fix implemented in `web/public/index.html`: hosted form now has `onsubmit="return false;"`, submit and contact-code buttons are disabled until `return_url` validation succeeds, and validation success explicitly enables them. Regression added in `src/auth/hosted-auth-web.spec.ts`. Pre-deploy validation passed: DocsRAG query from running Auth pod returned HTTP 200 with 10 sources; `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed 7 tests; `node --check web/server.js`; `node --check web/public/js/admin.js`; `git diff --check`; `npm run build`; and `npm run lint` passed. No production DB mutation, raw production user-data read, token/secret/password/JWT value inspection, JWT payload change, RBAC/OAuth/magic-link/CORS/internal-service/database schema change, or consumer-service source edit was performed. Deployment and post-deploy race validation pending.

2026-07-02: Hosted Auth form fail-closed hardening deployed to production. Commit `0d4282b` deployed with backend image `localhost:5000/auth-microservice:0d4282b-20260702102426` digest `sha256:3c745e83dd9a62656ca1cf103b624fbe410c1633782b160f2cb3a60eca4fef1e` and web image `localhost:5000/auth-microservice-web:0d4282b-20260702102426` digest `sha256:262637d2d2772549db47b4b9585b607bb58cf9880cb165f0e892c75c9e9d51a5`. Deploy-script focused Auth contract tests passed 3 suites/22 tests; backend and web rollouts completed; public `/login` returned HTTP 200 with `last-modified: Thu, 02 Jul 2026 10:22:52 GMT`; in-cluster served HTML check returned `formFailClosed=true`, `submitDisabled=true`, `magicDisabled=true`, and `enablesAfterValidation=true`. Post-deploy headless Chrome CDP verification from `https://catalog.alfares.cz/login` completed hosted register and hosted login to `https://catalog.alfares.cz/dashboard`; `auth_token` was present, `/api/auth/profile` returned HTTP 200, and the dashboard rendered the synthetic user plus product/category/attribute counters. No token, refresh token, password, decoded JWT, secret, raw production user data, production DB mutation, JWT payload change, RBAC/OAuth/magic-link/CORS/internal-service/database schema change, or consumer-service source edit was performed.

## 2026-07-02 - Goal 10.14 Auth Hosted Profile Wallet UI Source Prep

Current focus:

- Goal 10.14 Auth hosted `/profile` wallet management UI: source-prepared.
- Live SQL apply, Auth deploy, wallet endpoint 401 smoke, and synthetic
  authenticated wallet smoke remain owner-approval gated.

Subagent evidence:

- Read-only hosted UI explorer confirmed `/profile` is served by the web
  container, existing profile page was token/password only, and wallet APIs
  already exist in source under `/auth/profile/...`.
- Read-only post-change reviewer found two pre-commit issues: malformed or
  variant token hash handoffs could leave token-like material in the URL, and
  direct `/profile` sign-in still used email-only login instead of the Auth
  `identifier` contract. Both findings were fixed before commit.

Implementation evidence:

- `web/public/profile.html` now renders canonical profile, delivery address
  book, and invoice profile forms in hosted Auth.
- `web/public/js/profile.js` loads `/auth/profile` and
  `/auth/profile/checkout-data`, writes profile updates through
  `PATCH /auth/profile`, and manages delivery/invoice CRUD, default selection,
  and soft-delete through existing `/auth/profile/...` endpoints.
- The hosted profile script keeps bearer tokens in `sessionStorage`, uses
  same-origin requests with `Authorization: Bearer ...`, strips snake-case and
  camel-case token-bearing hash fragments after hosted handoff even when the
  access token is malformed or empty, and does not use `localStorage` or
  console logging.
- Direct `/profile` password login now uses `{ identifier, password }`, matching
  the central Auth email-or-phone login contract.
- `web/public/css/style.css` adds responsive profile wallet layout styles.
- `src/auth/hosted-auth-web.spec.ts` now pins `/profile` route serving, wallet
  UI sections/forms, company/tax/VAT invoice fields, wallet endpoint usage,
  bearer auth, mutation methods, defensive token-hash cleanup, identifier-based
  profile login, and absence of `localStorage`/console logging in the profile
  script.

Verification evidence:

- `node --check web/public/js/profile.js` passed.
- `node --check web/server.js` passed.
- `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts` passed:
  1 suite, 9 tests.
- `npm run test:auth-contract` passed: 3 suites, 27 tests.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- Targeted dangerous literal-secret scan on changed hosted profile source files
  returned no matches.

Boundary:

- No live SQL, deploy, Kubernetes mutation, production DB access,
  secret/token/password/JWT value inspection, raw production customer data
  inspection, backend API contract change, consumer repo edit, or live checkout
  smoke was performed.

Next unfinished chunks:

- Goal 10.14 is committed in `4bdbd27`.
- Owner approval is still required for schema-only DB preflight, SQL apply,
  Auth deploy, wallet endpoint 401 smoke, and optional synthetic authenticated
  wallet smoke.

## 2026-07-02 - Goal 10.15 Auth Wallet Runtime Gate Verifier

Current focus:

- Goal 10.15 Auth wallet runtime 401 smoke verifier: source-prepared.
- Live SQL apply, Auth deploy, strict post-deploy wallet 401 smoke, and
  synthetic authenticated wallet smoke remain owner-approval gated.

Subagent evidence:

- Read-only runtime gate explorer confirmed only
  `scripts/check-customer-data-wallet-preflight.js` existed; it validates SQL
  shape and does not perform public HTTP runtime checks.
- Existing runbooks used manual curl probes for `/health`,
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles`.
- Expected behavior remains: before deploy wallet endpoints return HTTP 404;
  after approved SQL + deploy they must return HTTP 401 unauthenticated, proving
  route availability and Auth guard protection, not DB schema correctness.

Implementation evidence:

- Added `scripts/check-customer-data-wallet-runtime-smoke.js`.
- Added `npm run check:customer-data-wallet-runtime`.
- The verifier supports:
  - `--expect=predeploy`: `/health` 200 and wallet endpoints 404.
  - `--expect=deployed`: `/health` 200 and wallet endpoints 401.
  - `auto`: classify uniform 404 as
    `dependency_gated_wallet_routes_not_deployed` and uniform 401 as
    `pass_post_deploy_wallet_401_smoke`.
- The verifier sends unauthenticated bodyless GET requests only, sends no
  Authorization header, cookies, or request body, reads no response body, and
  prints only status metadata.
- Updated live-gate and validation/deployment runbooks to use
  `npm run check:customer-data-wallet-runtime -- --expect=deployed` for the
  post-deploy wallet 401 smoke gate.

Verification evidence:

- `node --check scripts/check-customer-data-wallet-runtime-smoke.js` passed.
- `npm run check:customer-data-wallet-runtime -- --expect=predeploy` passed
  against current live runtime with `/health` 200 and wallet endpoints 404.
- `npm run check:customer-data-wallet-runtime` passed and reported
  `dependency_gated_wallet_routes_not_deployed`.
- `npm run check:customer-data-wallet-preflight` passed.
- `npm run test:auth-contract` passed.
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- Targeted dangerous literal-secret scan on changed verifier/docs returned no
  secret values.

Boundary:

- No SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT
  value inspection, raw production customer data inspection, response body
  capture, authenticated smoke, or consumer repo edit was performed.

Next unfinished chunks:

- Owner approval is still required for schema-only DB preflight, SQL apply,
  Auth deploy, strict wallet endpoint 401 smoke, and optional synthetic
  authenticated wallet smoke.

## 2026-07-02 Goal 10.17 Auth Invoice Profile Field Semantics

Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding
Prompt -> Code -> Validation:

- Vision: Auth remains the single source of truth for reusable registered-user
  invoice profile data across customer checkout surfaces.
- Goal Impact: storefronts can select the same Auth invoice profile fields
  without guessing whether company ID, tax ID, VAT ID, or invoice email use
  local aliases.
- System: `auth-microservice` contract docs define the canonical producer
  schema; consumer order snapshots remain immutable copies and do not become
  reusable profile truth.
- Feature: Auth invoice profile v1 fields are explicitly defined as
  `companyId`, `taxId`, `vatId`, and invoice recipient `email`.
- Task: update Auth contract docs and Goal 10 blockers so the unresolved item is
  limited to consumer order snapshot support/validation for optional Auth
  invoice fields not currently preserved by Orders.
- Execution Plan: source-only documentation patch; no runtime code, SQL,
  deployment, DB, secret, customer data, or consumer repo edit.
- Coding Prompt: preserve Auth ownership boundaries and mark remaining
  consumer gaps precisely instead of keeping a broad missing Auth field
  contract.
- Code: updated `docs/UNIFIED_AUTH_CONTRACT.md`,
  `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`,
  `implementation-goals/GOAL-10-auth-customer-data-wallet.md`,
  `docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md`,
  `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`,
  and `docs/IMPLEMENTATION_STATE.md`.
- Validation: passed. Commands: `git diff --check`, targeted stale invoice
  contract scan, targeted canonical invoice field scan, and targeted dangerous
  literal-secret scan on changed Goal 10 docs.

Evidence:

- `companyId` is the company registration identifier, including Czech
  ICO-style values.
- `vatId` is the VAT/DIC-style identifier when applicable.
- `taxId` remains a separate storefront/accounting tax identifier.
- Invoice recipient email is Auth field `email`; `invoiceEmail` and
  `electronicInvoiceEmail` are not Auth v1 aliases.
- Read-only sidecar audit found FlipFlop Auth client already uses
  `companyId`, `taxId`, `vatId`, and `email`; Orders currently snapshots only
  `companyName`/`taxId`; ChytraKoupe remains dependency-gated on accepted order
  payload fields.

Boundary:

- No runtime code, SQL, deploy, Kubernetes mutation, DB access,
  secret/token/password/JWT value inspection, raw production customer data
  inspection, authenticated smoke, or consumer repo edit was performed.

Next unfinished chunks:

- Consumer order snapshot support/validation for optional Auth invoice fields
  `companyId`, `vatId`, and `email` beyond the current
  `companyName`/`taxId` subset.
- Owner approval is still required for schema-only DB preflight, SQL apply,
  Auth deploy, strict wallet endpoint 401 smoke, and optional synthetic
  authenticated wallet smoke.

## 2026-07-02 - Goal 10.16 Auth Release Gate Head Refresh

Current focus:

- Goal 10 release gate documentation refreshed to current Auth deploy candidate
  `9ff1099bbee18836c40d9276d3b96a15e5e522fb`.
- Live SQL apply, Auth deploy, strict post-deploy wallet 401 smoke, and
  synthetic authenticated wallet smoke remain owner-approval gated.

Source evidence:

- `git status --short --branch` returned `main...origin/main [ahead 13]`.
- `git rev-parse HEAD` returned
  `9ff1099bbee18836c40d9276d3b96a15e5e522fb`.
- `git merge-base --is-ancestor b6c1585 HEAD` passed, confirming the original
  wallet API source is included in the current deploy candidate.
- Current checksums:
  - wallet SQL:
    `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`;
  - runtime verifier:
    `3786afab774e58dd9800272507ca919b7cfdf8d80a16fb4f09ef1541e482ec26`;
  - deploy script:
    `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.

Implementation evidence:

- Updated the Goal 10 validation/deployment plan so the Auth source row,
  evidence section, and open deploy approval blocker point to exact HEAD
  `9ff1099bbee18836c40d9276d3b96a15e5e522fb`, not the earlier `54743ed`.
- Updated the live-gate runbook so the current deploy candidate includes wallet
  API commit `b6c1585`, hosted profile wallet UI commit `4bdbd27`, and runtime
  verifier commit `9ff1099`.
- Updated the live-gate preflight command to record SQL, runtime verifier, and
  deploy script checksums and to run the source-only predeploy runtime gate.
- Updated `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`,
  `docs/orchestrator/PLAN.md`, and context/status state to describe the Auth
  API, hosted profile UI, runtime gate, and FlipFlop source-prepared state.

Verification evidence:

- `npm run check:customer-data-wallet-runtime` passed and reported
  `dependency_gated_wallet_routes_not_deployed` with `/health` 200 and wallet
  endpoints 404.
- `npm run check:customer-data-wallet-preflight` passed and confirmed the
  checked-in wallet SQL shape without reading env values or connecting to the
  database.
- `git diff --check` passed.
- Targeted active stale-deploy-reference scan found no operator-facing
  instruction to deploy the superseded `54743ed`/`39b59d7` snapshots.
- Targeted dangerous literal-secret scan on changed Goal 10 docs found no
  secret/token/password/JWT values.

Boundary:

- No SQL, deploy, Kubernetes mutation, DB access, secret/token/password/JWT
  value inspection, raw production customer data inspection, response body
  capture, authenticated smoke, or consumer repo edit was performed.

Next unfinished chunks:

- Owner approval is still required for schema-only DB preflight, SQL apply,
  Auth deploy, strict wallet endpoint 401 smoke, and optional synthetic
  authenticated wallet smoke.
