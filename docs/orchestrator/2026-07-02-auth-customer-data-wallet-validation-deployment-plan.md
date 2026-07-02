# Auth Customer Data Wallet Validation And Deployment Plan

Status: plan-only; live SQL, Auth deploy, rollback mutation, synthetic authenticated smoke, and consumer deploys remain owner-approval gated
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

Decision: `hold` for live operations until explicit owner approval covers each
bounded operation:

- schema-only live DB preflight;
- use of DB connection environment values without printing values;
- live SQL apply for `scripts/create-customer-data-wallet-tables.sql`;
- Auth deploy from exact remote HEAD `9ff1099bbee18836c40d9276d3b96a15e5e522fb`;
- Kubernetes rollback mutation if rollback is needed;
- synthetic authenticated account/token for cross-repo smoke;
- consumer deploy/runtime checkout smoke.

## Current Evidence

Auth:

- Repo: `alfares:/home/ssf/Documents/Github/auth-microservice`.
- Current source: `main` at
  `9ff1099bbee18836c40d9276d3b96a15e5e522fb`, ahead of `origin/main` by
  13.
- Wallet API source commit `b6c1585`, hosted profile wallet UI commit
  `4bdbd27`, and runtime gate verifier commit `9ff1099` are ancestors of the
  current deploy candidate.
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
- Live runtime: backend/web are `1/1` on old image tag
  `0d4282b-20260702102426`.
- Live `/health` returned HTTP 200.
- Live unauthenticated wallet probes returned HTTP 404 for
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles`, proving Goal 10 code is not deployed yet.
- Expected unauthenticated result after deploy is HTTP 401, not 404 or 500.

Consumers:

- `flipflop`: continuation review found active branch
  `codex/orders-lifecycle-cabinet-flipflop-clean` initially missed the wallet
  source series. The active target is now source-integrated with commits
  `a8425a9`, `15fb1ee`, `f4af318`, and validation report commit `223db57`.
  Deploy/runtime smoke remains gated until Auth wallet endpoints return 401
  unauthenticated after Auth SQL/deploy.
- `orders-microservice`: current clean `main` at `c5e6dd6` already accepts Auth
  subject aliases and immutable shipping/billing snapshots; it does not accept
  Auth wallet IDs. Goal 10 must not add Orders source changes until the
  provenance contract is approved.
- `rent-a-box`: plan commit `fcfeb48` created; code migration is blocked until
  hosted Auth/session/admin-role and data migration decisions are approved.
- `chytrakoupe`: plan commit `a1dabca` and verifier/callback cleanup commit
  `2838ebf` created; selector implementation is blocked until Auth wallet
  deploy, client-id, CORS/redirect, and snapshot decisions are approved.
- `cliplot`: readiness commit `01f6dea` created; checkout mutation and wallet
  selector integration remain approval-gated.
- Marketplace/channel audit: `catalog-microservice`, `allegro`, `aukro`,
  `bazos`, `heureka`, and `shop-assistant` do not need repo-local wallet plans
  now. Marketplace buyer/contact/order data must remain immutable channel or
  Orders evidence and must not back-write reusable wallet records into Auth.

## Repository Matrix

| Repo | Owner role | Current state | Required pre-deploy checks | Post-deploy/runtime checks | Blockers |
| --- | --- | --- | --- | --- | --- |
| `auth-microservice` | Auth coordinator | Source ready at `9ff1099`; live still old image with wallet 404 | `npm run check:customer-data-wallet-preflight`; `npm run check:customer-data-wallet-runtime -- --expect=predeploy`; `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/users/users.service.spec.ts`; `npm run test:auth-contract`; `npm run build`; `npm run lint`; `git diff --check`; schema-only DB preflight after approval | rollout backend/web; `/health` 200; `npm run check:customer-data-wallet-runtime -- --expect=deployed`; optional synthetic CRUD/default/delete smoke | live DB preflight, SQL apply, deploy, synthetic account approvals |
| `flipflop` | FlipFlop integration owner | Active target `codex/orders-lifecycle-cabinet-flipflop-clean` source-integrated at `223db57` | pre-coding gate passed; strict doc audit passed 100/100; shared build passed; frontend `tsc --noEmit` passed; frontend build passed; `git diff --check` passed | guest checkout unchanged; authenticated checkout/profile selectors; wallet fallback on 404/failure; manual-edit-before-wallet-response guard; explicit selector override; profile address fallback; no wallet IDs in order payload unless approved | Auth wallet deploy; owner-approved synthetic account; runtime smoke |
| `orders-microservice` | Orders contract owner | Clean `main` at `c5e6dd6`; Auth subject aliases and immutable snapshots already supported | if provenance fields are approved, run build, create-order contract verifier, event verifier, lifecycle/invoice verifiers, full tests, and secret scan | optional validate-create payload smoke and event privacy check after contract approval | wallet provenance field names/idempotency semantics not approved |
| `rent-a-box` | Rent-a-box migration owner | Plan-only commit `fcfeb48` | intent preflight, lint, tests, focused API/web checks, diff-check when code lane starts | hosted Auth callback/token/session/admin mapping; wallet read/write adapter; no backfill without approval | hosted Auth token/session/admin-role decision; DB migration/backfill approval; row counts unknown |
| `chytrakoupe` | ChytraKoupe checkout owner | Plan/verifier commit `2838ebf`; selector UI still absent by design | `npm run verify:auth-wallet-checkout-selectors` passed; `npm run lint` passed; `npm run build` passed; `node --check scripts/verify-auth-wallet-checkout-selectors.mjs && git diff --check` passed; literal-secret scan passed | delivery/invoice selectors; guest fallback; order snapshot check; no live checkout submit without approval | Auth wallet deploy; client-id decision; CORS/redirect allowlist; Orders snapshot decisions |
| `cliplot` | Cliplot coordinator | Readiness commit `01f6dea`; checkout still guarded | `npm run readiness:auth-wallet-checkout` passed; `node --check scripts/auth-wallet-checkout-readiness.js && git diff --check` passed; `npm run check` passed; literal-secret scan passed | no live order/payment/Warehouse/notification mutation without approval | checkout approval, Auth wallet live contract, authenticated session contract, no-PII logging/frontend exposure review |
| marketplace/channel repos | Auth coordinator | `catalog-microservice` `311030d`, `allegro` `6c64a30`, `aukro` `ba61422`, `bazos` `cdcd739`, `heureka` `976a1a8`, `shop-assistant` `4ed76b1` | read-only status/head and bounded source/doc audit completed | no wallet back-write; preserve channel evidence and Orders snapshots | possible later Allegro raw-payload retention review; Bazos/Aukro provider-specific unknowns |

## Merge And Deployment Order

1. Freeze current source states and decide target branches/SHAs for Auth,
   Rent-a-box, ChytraKoupe, Orders, and Cliplot. FlipFlop active target is
   currently `codex/orders-lifecycle-cabinet-flipflop-clean` at `223db57`.
2. Push or merge plan/source commits that are intentionally part of the release.
3. Resolve or isolate the dirty Orders provenance lane before any Orders
   deployment decision.
4. Re-run Auth source validation on the exact target Auth commit.
5. After owner approval, run schema-only DB preflight without printing
   credentials, customer rows, passwords, token values, or raw address data.
6. After owner approval and passing preflight, apply Auth wallet SQL in a single
   transaction.
7. Deploy Auth from the exact approved remote HEAD.
8. Run Auth post-deploy smoke: backend/web rollout, `/health` 200, and wallet
   endpoints return 401 unauthenticated through
   `npm run check:customer-data-wallet-runtime -- --expect=deployed`.
9. If owner approves a synthetic account/token, run authenticated Auth wallet
   CRUD/default/delete smoke with synthetic data only and cleanup where agreed.
10. Deploy/runtime-smoke FlipFlop from the approved target branch only after
    Auth wallet 401 smoke passes.
11. Keep Orders unchanged unless the wallet provenance contract is approved.
12. Start Rent-a-box and ChytraKoupe code lanes only after their missing hosted
    Auth/client/snapshot decisions are resolved.
13. Keep Cliplot read-only/guarded until checkout mutation approval and Auth
    wallet live contract evidence exist.
14. Keep marketplace/channel repositories out of Auth wallet back-write scope
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

- `[MISSING: owner approval to run schema-only live DB preflight]`
- `[MISSING: approval to use DB connection environment values without printing them]`
- `[MISSING: owner approval to apply live SQL]`
- `[MISSING: owner approval to deploy exact Auth remote HEAD 9ff1099bbee18836c40d9276d3b96a15e5e522fb]`
- `[MISSING: owner approval for Kubernetes rollback mutation if rollback is needed]`
- `[MISSING: destructive DB rollback/drop approval; do not drop wallet tables by default]`
- `[MISSING: owner-approved synthetic account/token for authenticated Auth wallet and cross-repo checkout smoke]`
- `[MISSING: FlipFlop target branch decision before runtime deployment]`
- `[MISSING: final wallet provenance contract for Orders field names and idempotency semantics]`
- Auth invoice profile v1 field semantics are source-defined:
  `companyId`, `taxId`, `vatId`, and invoice recipient `email`.
- `[MISSING: consumer order snapshot support/validation for optional Auth invoice fields companyId, vatId, and email beyond the current companyName/taxId subset]`
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
