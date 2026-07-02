# Auth Customer Data Wallet Validation And Deployment Plan

Status: Auth live SQL/deploy and unauthenticated 401 smoke completed; rollback mutation, synthetic authenticated smoke, and consumer deploys remain owner-approval gated
Created: 2026-07-02
Owner: Auth coordinator

## Intent Chain

- Vision: Auth is the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data across the Statex
  ecosystem.
- Goal impact: users enter reusable personal, delivery, and invoice data once;
  all integrated checkouts select Auth-owned entries and submit immutable order
  snapshots.
- System: Auth owns reusable customer data; storefronts render selectors and
  save back through Auth; Orders stores immutable order snapshots only.
- Feature: customer data wallet with multi-address delivery profiles,
  multi-entry invoice profiles, default selection, checkout aggregate reads, and
  consumer fallback behavior.
- Task: create the cross-repo validation, merge, deployment, and rollback plan
  for Goal 10.11 without running live SQL, deploys, or mutating checkout smoke.
- Execution plan: freeze repository states, validate Auth source, run approved
  schema-only DB preflight, apply approved SQL, deploy Auth, smoke Auth wallet
  routes, then validate/deploy consumers in dependency order.
- Coding prompt: implement only the assigned repo-local lane, preserve Auth as
  the source of truth, keep Orders as snapshot owner, avoid secrets/raw customer
  data in docs/logs/prompts, and mark unknowns as `[MISSING: ...]` or
  `[UNKNOWN: ...]`.
- Code: no code change in this Goal 10.11 chunk. This is a coordination and
  validation artifact.
- Validation: documentation diff-check and dangerous literal-secret scan only.

## Gate Decision

Decision: `pass` for docs-only planning.

Decision: `pass` for approved Auth live SQL apply, Auth deploy, and
unauthenticated wallet 401 smoke. These were executed on 2026-07-02 from
Source Preflight-captured Auth HEAD
`2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`.

Decision: `hold` remains for live operations not covered by the completed gate:

- Kubernetes rollback mutation if rollback is needed;
- synthetic authenticated account/token for cross-repo smoke;
- consumer deploy/runtime checkout smoke beyond the completed non-mutating
  FlipFlop checks.

2026-07-03 refresh: owner-approved Auth live refresh completed from Source
Preflight-captured HEAD `ff974345c52a41ac8b920a3dba0f44795a23950d`. Schema
preflight was metadata-only; approved SQL apply was idempotent because wallet
tables/indexes already existed; Auth backend/web rolled out on image tag
`ff97434-20260702223501`; unauthenticated wallet endpoints returned HTTP 401;
and non-mutating FlipFlop runtime smoke passed. The deploy script timed out
during the first backend rollout wait, so its final non-secret ConfigMap patch
was applied manually and the backend restart completed successfully.

## Current Evidence

Auth:

- Repo: `alfares:/home/ssf/Documents/Github/auth-microservice`.
- Current Source Preflight captured deploy HEAD
  `ff974345c52a41ac8b920a3dba0f44795a23950d`.
- Wallet API source commit `b6c1585`, hosted profile wallet UI commit
  `4bdbd27`, and runtime gate verifier commit `9ff1099` are ancestors of the
  runtime source checkpoint. Runtime source has not changed after the
  source-validated `9ff1099` verifier checkpoint; later commits are
  documentation/checkpoint updates.
- SQL checksum:
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`.
- Runtime gate verifier checksum:
  `3786afab774e58dd9800272507ca919b7cfdf8d80a16fb4f09ef1541e482ec26`.
- SQL shape is additive/idempotent: `CREATE TABLE IF NOT EXISTS` for
  `user_delivery_addresses` and `user_invoice_profiles`, FK to `users(id)`,
  normal indexes, and partial unique indexes for one active default per user.
- No `INSERT`, `UPDATE`, `DELETE`, `DROP`, or `TRUNCATE` operation is part of
  the source SQL.
- Deploy script checksum:
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Deploy script runs Auth contract tests/build/image rollout/health checks; it
  does not run SQL.
- Live runtime: backend/web are `1/1` on image tags
  `ff97434-20260702223501`.
- Live `/health` returned HTTP 200.
- Live unauthenticated wallet probes returned HTTP 401 for
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles`, proving Goal 10 wallet routes are deployed
  and protected by Auth.

Consumers:

- `flipflop`: the superseded
  `codex/orders-lifecycle-cabinet-flipflop-clean` lane is merged into `main`.
  Current `main` is `7a092c2` with an existing generated validation report
  modification not touched by Auth live refresh; the wallet lane was merged at
  `7e97e98` and includes wallet selector/save-back/profile commits through
  `e499dd4`. Source verifiers
  `npm run verify:auth-wallet-profile-ui` and
  `npm run verify:auth-wallet-checkout-selectors` passed on current `main`;
  `npm run verify:orders-hub-integration` also passed for order payload
  forwarding.
  Non-mutating post-deploy runtime smoke also passed after the Auth live
  refresh: `/`, `/checkout`, `/profile/addresses`,
  `/profile/invoice-profiles`, and `/api/products?limit=1` returned HTTP 200;
  gateway-proxied Auth wallet endpoints returned HTTP 401. Authenticated synthetic
  checkout/profile smoke remains gated on synthetic account/token approval.
- `orders-microservice`: current clean `main` at `2111389` includes immutable
  order snapshot support for optional Auth invoice fields through commit
  `3c7d0c3`; it does not accept Auth wallet IDs. Goal 10 must not add Orders
  source changes until the provenance contract is approved.
- `rent-a-box`: current `main` is clean and ahead of origin at `9e6cf38`; the
  Goal 12 readiness verifier records the completed Auth wallet 401 gate,
  generic hosted Auth handoff, default `POST /auth/validate`, Auth wallet API
  shape, and Auth-side wildcard redirect/CORS evidence. Code migration remains
  blocked until a source-backed Rent-a-box callback route, concrete
  `client_id`/`return_url`, admin role mapping, consent/profile migration
  mapping, and migration/backfill decisions are approved.
- `chytrakoupe`: current `main` is clean and ahead of origin at `002818f`; the
  Goal 06 verifier records the completed Auth wallet 401 gate, Orders snapshot
  shape, Auth v1 invoice fields, fragment-only Auth handoff direction,
  Auth-side wildcard redirect/CORS evidence, and `flipflop-service`
  `/api/orders/guest` snapshot mapping. Selector implementation remains blocked
  until Auth client-id and authenticated Auth subject linkage decisions are
  approved.
- `cliplot`: current clean `main` at `9f1be04` includes refreshed Auth wallet
  readiness evidence. Checkout mutation and wallet selector integration remain
  approval-gated on selector behavior, browser/session, PII exposure, and
  response-contract decisions.
- Marketplace/channel audit: `catalog-microservice`, `allegro`, `aukro`,
  `bazos`, `heureka`, and `shop-assistant` do not need repo-local wallet plans
  now. Marketplace buyer/contact/order data must remain immutable channel or
  Orders evidence and must not back-write reusable wallet records into Auth.

## Repository Matrix

| Repo | Owner role | Current state | Required pre-deploy checks | Post-deploy/runtime checks | Blockers |
| --- | --- | --- | --- | --- | --- |
| `auth-microservice` | Auth coordinator | Source Preflight deploy HEAD `2871a6f`; live backend/web `1/1` on image tags `2871a6f-20260702210100`; wallet routes return HTTP 401 unauthenticated | `npm run check:customer-data-wallet-preflight` passed; predeploy runtime verifier passed with wallet 404; focused Auth/User specs passed; `npm run test:auth-contract` passed; `npm run build`; `npm run lint`; `git diff --check`; schema-only DB preflight passed; live SQL apply completed | `/health` 200; `npm run check:customer-data-wallet-runtime -- --expect=deployed` passed; optional synthetic CRUD/default/delete smoke remains gated | synthetic account/token approval for authenticated smoke |
| `flipflop` | FlipFlop integration owner | Clean `main` at `97b7e40`; wallet lane merged at `7e97e98` | `npm run verify:auth-wallet-profile-ui` passed; `npm run verify:auth-wallet-checkout-selectors` passed; `npm run verify:orders-hub-integration` passed; earlier shared/frontend/order-service build evidence remains recorded in Goal 10.18-10.21 | non-mutating post-deploy smoke passed including guest checkout; authenticated checkout/profile selectors, manual-edit guard, explicit save-back, and invoice profile CRUD/default UI still need synthetic authenticated smoke before completion | owner-approved synthetic account/token; authenticated runtime smoke |
| `orders-microservice` | Orders contract owner | Clean `main` at `2111389`; Auth subject aliases and immutable snapshots supported, including optional Auth invoice fields from `3c7d0c3` | `npm run verify:create-order-contract` passed; `npm run verify:invoices-read-boundary` passed; earlier build/full-test evidence remains recorded in Goal 10.18 | optional validate-create payload smoke and event privacy check after Auth deploy approval | optional future wallet provenance field names/idempotency semantics not approved |
| `rent-a-box` | Rent-a-box migration owner | Clean `main` ahead 3 at `9e6cf38`; Auth wallet 401 gate, hosted Auth handoff, live wildcard redirect/CORS evidence, `/auth/validate`, and wallet API shape consumed by Goal 12 verifier | `python3 -m py_compile scripts/check_goal12_auth_wallet_readiness.py scripts/check_doc_state.py scripts/ips_pre_coding_gate.py` passed; `python3 scripts/check_goal12_auth_wallet_readiness.py --root .` passed with `pass_dependency_gated`; `./scripts/intent_preflight.sh` passed; `git diff --check`, targeted literal-secret scan, and stale broad callback/allowlist blocker scan passed | hosted Auth callback/session/admin adapter; consent/profile migration mapping; no backfill without approval | source-backed callback route, concrete `client_id`/`return_url`, admin role mapping, consent/profile migration mapping, DB migration/backfill, row counts unknown |
| `chytrakoupe` | ChytraKoupe checkout owner | Clean `main` ahead 1 at `002818f`; Auth wallet 401 gate, Orders snapshot shape, Auth v1 invoice fields, fragment-only Auth handoff, Auth-side wildcard redirect/CORS evidence, and `/api/orders/guest` snapshot mapping consumed by Goal 06 verifier; selector UI still absent by design | `npm run verify:auth-wallet-checkout-selectors` passed; `node --check scripts/verify-auth-wallet-checkout-selectors.mjs` passed; `git diff --check`, targeted dangerous literal-secret scan, and stale blocker scan passed | delivery/invoice selectors; guest fallback; optional Auth subject linkage; no live checkout submit without approval | Auth client-id decision; authenticated Auth subject linkage if central Orders must persist `customer.authSubject` |
| `cliplot` | Cliplot coordinator | Clean `main` ahead 1 at `8dbd1e2`; Auth wallet 401 gate consumed by readiness verifier; checkout still guarded and source-known facts recorded | `npm run readiness:auth-wallet-checkout` passed; `node --check scripts/auth-wallet-checkout-readiness.js` passed; `npm run check` passed; `git diff --check` and targeted literal-secret scan passed | no live order/payment/Warehouse/notification mutation without approval | selector behavior approval, authenticated browser/session contract, no-PII logging/frontend exposure review, response fields/version identifier |
| marketplace/channel repos | Auth coordinator | `catalog-microservice` `311030d`, `allegro` `6c64a30`, `aukro` `ba61422`, `bazos` `cdcd739`, `heureka` `976a1a8`, `shop-assistant` `4ed76b1` | read-only status/head and bounded source/doc audit completed | no wallet back-write; preserve channel evidence and Orders snapshots | possible later Allegro raw-payload retention review; Bazos/Aukro provider-specific unknowns |

## Merge And Deployment Order

1. Current source states are frozen in this plan: Auth deployed Source
   Preflight HEAD `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`, FlipFlop
   `97b7e40`, Orders `2c35d2f`, Rent-a-box `9e6cf38`, ChytraKoupe `002818f`,
   and Cliplot `8dbd1e2`.
2. Push or merge plan/source commits that are intentionally part of the release.
3. Keep Orders unchanged for current snapshot support unless a separate
   wallet-provenance contract is approved.
4. Auth source validation, schema-only DB preflight, live SQL apply, deploy, and
   unauthenticated wallet 401 smoke are complete from Source Preflight HEAD
   `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`.
5. If owner approves a synthetic account/token, run authenticated Auth wallet
   CRUD/default/delete smoke with synthetic data only and cleanup where agreed.
6. Deploy/runtime-smoke FlipFlop from the approved target branch only after
    Auth wallet 401 smoke passes.
7. Keep Orders unchanged unless the wallet provenance contract is approved.
8. Start Rent-a-box and ChytraKoupe code lanes only after their remaining
   callback/client/Auth-subject and migration decisions are resolved.
9. Keep Cliplot read-only/guarded until selector/session/PII/response-contract
   approvals exist.
10. Keep marketplace/channel repositories out of Auth wallet back-write scope
    unless a future source change introduces a registered-user checkout wallet
    surface.

## Auth Live Operation Runbook

Source validation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/users/users.service.spec.ts'
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run test:auth-contract'
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run build'
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run lint'
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && git diff --check'
```

Schema-only DB preflight after approval:

```bash
cd /home/ssf/Documents/Github/auth-microservice
PGPASSWORD="$DB_PASSWORD" psql --host="$DB_HOST" --port="${DB_PORT:-5432}" --username="$DB_USER" --dbname="${DB_NAME:-auth}" --set=ON_ERROR_STOP=1
```

Preflight SQL should check only schema metadata:

```sql
SELECT to_regclass('public.users');
SELECT to_regclass('public.user_delivery_addresses');
SELECT to_regclass('public.user_invoice_profiles');
SELECT to_regproc('gen_random_uuid');
```

SQL apply after approval and passing preflight:

```bash
cd /home/ssf/Documents/Github/auth-microservice
PGPASSWORD="$DB_PASSWORD" psql --host="$DB_HOST" --port="${DB_PORT:-5432}" --username="$DB_USER" --dbname="${DB_NAME:-auth}" --set=ON_ERROR_STOP=1 --single-transaction --file=scripts/create-customer-data-wallet-tables.sql
```

Deploy after SQL apply:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && ./scripts/deploy.sh'
```

Post-deploy 401 smoke:

```bash
ssh alfares 'kubectl rollout status deploy/auth-microservice -n statex-apps'
ssh alfares 'kubectl rollout status deploy/auth-microservice-web -n statex-apps'
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run check:customer-data-wallet-runtime -- --expect=deployed'
```

## FlipFlop Runtime Smoke Plan

Run only after Auth wallet endpoint 401 smoke passes.

- Confirm the deployment target includes commits `515f4b7`, `840eff6`, and
  `4268a48`, or explicitly document why a different target branch is used.
- Validate source: pre-coding gate, strict doc audit, shared build, frontend
  typecheck, frontend build, and diff-check.
- Guest checkout remains available and does not require Auth wallet.
- Authenticated checkout fetches `GET /auth/profile/checkout-data`.
- Saved delivery address selector fills only delivery fields.
- Saved invoice profile selector fills only billing/contact fields.
- Manual typing before a delayed wallet response is preserved.
- Explicit selector selection overrides existing manual fields.
- Wallet 404/failure falls back to current local/manual checkout flow.
- Profile addresses prefer Auth wallet data when available and fallback to
  legacy local addresses when unavailable.
- Order payload keeps immutable snapshots; wallet IDs remain excluded unless
  the provenance contract is approved.

## Rollback Boundary

- Preferred rollback for Auth deploy risk is application rollback or forward
  fix.
- Wallet SQL is additive/idempotent. Do not drop wallet tables during ordinary
  rollback.
- Any Kubernetes rollback mutation requires owner approval.
- Any destructive DB rollback/drop requires separate explicit owner approval.
- If wallet routes deploy but fail, disable consumer rollout first and keep
  existing guest/local fallback paths active.

## Sensitive Data Rules

- Do not print DB connection strings, passwords, tokens, JWT values, OAuth
  tokens, magic-link tokens, reset tokens, private keys, or Vault values.
- Do not read or dump customer rows, password hashes, or raw production address
  and invoice payloads.
- Synthetic smoke may use only owner-approved synthetic account data.
- Runtime logs and reports must summarize HTTP status, endpoint shape, and
  schema metadata only.

## Open Blockers

- `[MISSING: owner approval for Kubernetes rollback mutation if rollback is needed]`
- `[MISSING: destructive DB rollback/drop approval; do not drop wallet tables by default]`
- `[MISSING: owner-approved synthetic account/token for authenticated Auth wallet and cross-repo checkout smoke]`
- `[MISSING: authenticated synthetic FlipFlop runtime smoke after Auth wallet 401 gate]`
- `[MISSING: optional future wallet provenance contract for Orders field names and idempotency semantics]`
- Auth invoice profile v1 field semantics are source-defined:
  `companyId`, `taxId`, `vatId`, and invoice recipient `email`.
- Consumer order snapshot support/validation for optional Auth invoice fields
  `companyId`, `vatId`, and `email` is source-prepared and verified in Orders
  through `3c7d0c3` and current `2111389`.
- `[MISSING: Rent-a-box hosted Auth token/session/admin-role migration decision before code changes]`
- `[MISSING: ChytraKoupe hosted Auth client_id decision before selector implementation]`
- `[UNKNOWN: final customer-checkout consumer repo set beyond FlipFlop, Chytrakoupe, Rent-a-box, and Cliplot]`

## Parallel Execution

Ready now:

- Auth coordinator: keep docs/state current and prepare owner approval request.
- Orders contract reviewer: isolate/resolve the dirty provenance lane without
  coupling it to Goal 10 deploy.
- Consumer coordinators: verify target branches and validation scripts
  read-only.

Dependency-gated:

- Auth operator: DB preflight, SQL apply, deploy, and rollback operations.
- FlipFlop runtime owner: deploy/smoke only after Auth wallet 401 smoke.
- Rent-a-box/ChytraKoupe workers: code lanes only after Auth deploy and local
  Auth/client decisions.

Final integration:

- Integration owner: Auth coordinator.
- Validation owner: repo-local owner per matrix plus Auth coordinator for
  cross-repo evidence.
- Merge order: Auth source/deploy first, FlipFlop second, Orders provenance only
  if approved, Rent-a-box/ChytraKoupe later, Cliplot last.
