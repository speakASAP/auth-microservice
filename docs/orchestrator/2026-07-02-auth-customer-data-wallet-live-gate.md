# Auth Customer Data Wallet Live Gate

Status: Auth SQL/deploy/401 gate completed and current-head live refresh verified; synthetic authenticated smoke remains approval-gated
Created: 2026-07-02
Scope: `auth-microservice` Goal 10 A1 live SQL apply and deployment.

## Purpose

Record the live database and runtime deployment gate for the Auth customer data
wallet runtime source checkpoint:

```text
1a60240de3affb739cfbe1cac49dd95e5025582a docs: revalidate auth wallet live approval gate
```

This runtime source checkpoint includes the wallet API source commit `b6c1585`,
hosted profile wallet UI commit `4bdbd27`, runtime 401 smoke verifier commit
`9ff1099`, and later source-only documentation/checkpoint commits through
`1a60240`. Runtime source has not changed after the source-validated `9ff1099`
verifier checkpoint. Source Preflight must capture the exact remote HEAD
immediately before approved live execution because docs-only checkpoint commits
may sit above this runtime source checkpoint.

This runbook records the exact safe sequence that was used after owner approval
for schema-only DB preflight, SQL apply, Auth deploy, wallet endpoint 401
smoke, and non-mutating FlipFlop post-deploy runtime smoke.

## Current Gate State

- Latest approved refresh completed from Source Preflight-captured HEAD
  `548df583bff50057c79c4c6705e6a379f4d1b63b`.
- Latest deployed Auth image tag is `548df58-20260703051411` for backend and
  web.
- Latest refresh confirmed schema metadata in the `auth` database, idempotent
  SQL apply, Auth wallet 401 smoke, and non-mutating FlipFlop runtime smoke.
- During the latest refresh, Source Preflight was clean on `main`, ahead of
  `origin/main` by 3 coordinator docs commits. The deployed-mode validation
  passed because wallet routes are already live and return protected `401`.
- Auth source for delivery addresses, invoice profiles, checkout aggregate,
  hosted profile wallet management, and runtime wallet route gate exists in the
  deployed Source Preflight HEAD
  `548df583bff50057c79c4c6705e6a379f4d1b63b`.
- `scripts/create-customer-data-wallet-tables.sql` is additive and idempotent.
- Production uses `DB_SYNC=false`; do not set `DB_SYNC=true`.
- Live SQL has been applied for `scripts/create-customer-data-wallet-tables.sql`.
- Auth deploy completed with backend image
  `localhost:5000/auth-microservice:548df58-20260703051411` and web image
  `localhost:5000/auth-microservice-web:548df58-20260703051411`; both
  deployments are `1/1`.
- Post-deploy runtime smoke passed: `/health` returned HTTP 200 and wallet
  endpoints returned HTTP 401 unauthenticated.
- FlipFlop non-mutating post-deploy smoke passed; authenticated synthetic
  wallet and checkout smoke remains gated on synthetic account/token approval.
- Historical pre-live Kubernetes/pod sandbox blockers listed in earlier
  checkpoints were resolved before this live gate executed and are no longer
  active gate blockers.

## Required Owner Approvals

Completed approvals:

- Schema-only live DB preflight and verification.
- Use of DB connection environment values without printing them.
- Live apply of `scripts/create-customer-data-wallet-tables.sql`.
- Auth deploy with `./scripts/deploy.sh`.
- Wallet endpoint 401 smoke and non-mutating FlipFlop post-deploy smoke.

Still required:

- Approval for authenticated synthetic smoke that creates, updates, defaults,
  and deletes wallet rows through
  `docs/orchestrator/2026-07-03-auth-wallet-authenticated-smoke-approval.md`.
- Owner-approved synthetic Auth account/token and non-secret approval id for
  `npm run check:customer-data-wallet-authenticated -- --execute`.

## Source Preflight

Run before any DB action:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && git status -sb --ahead-behind && git status --porcelain=v1 && git rev-parse HEAD && git rev-parse origin/main && git log -1 --oneline && sha256sum scripts/create-customer-data-wallet-tables.sql scripts/check-customer-data-wallet-runtime-smoke.js scripts/deploy.sh'
```

Expected:

- `HEAD` is the exact owner-approved deploy candidate; if `origin/main`
  differs, record the ahead/behind state and do not substitute another commit.
- No dirty tracked source files.
- Any unrelated untracked files are identified and left untouched.
- SQL, runtime verifier, and deploy script checksums are recorded.

Rerun source validation before approval execution:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run check:customer-data-wallet-preflight && npm run check:customer-data-wallet-runtime -- --expect=predeploy && npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/users/users.service.spec.ts && npm run test:auth-contract && npm run build && npm run lint && git diff --check'
```

Source-only preflight helper:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run check:customer-data-wallet-preflight'
```

This helper validates the checked-in SQL file shape and prints the allowlisted
metadata SQL plus apply command template. It does not read DB environment
values, connect to the database, apply SQL, or replace the approved live
schema-only preflight.

## Schema-Only DB Preflight

Do not run until approved. Do not print DB secrets.

Check that the base users table exists, wallet tables are not already present
with an incompatible schema, and `gen_random_uuid()` is available:

```sql
SELECT to_regclass('public.users');
SELECT to_regclass('public.user_delivery_addresses');
SELECT to_regclass('public.user_invoice_profiles');
SELECT to_regproc('gen_random_uuid');
```

Abort if:

- `public.users` is missing.
- Existing wallet tables have an incompatible schema.
- `gen_random_uuid` is missing and extension creation is not separately
  approved.

## SQL Apply Shape

Preferred shape when DB environment variables are already available in the
remote shell:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && PGPASSWORD="$DB_PASSWORD" psql --host="$DB_HOST" --port="${DB_PORT:-5432}" --username="$DB_USER" --dbname="${DB_NAME:-auth}" --set=ON_ERROR_STOP=1 --single-transaction --file=scripts/create-customer-data-wallet-tables.sql'
```

If DB variables are only available in the running Auth pod, first verify the
pod is healthy and has a `psql` client. If not, use an approved operator
environment that has `psql` and the same DB env values. Do not print DB env
values.

## Post-Apply Schema Verification

Do not inspect customer rows. Use schema metadata only:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_delivery_addresses', 'user_invoice_profiles');

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('user_delivery_addresses', 'user_invoice_profiles')
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('user_delivery_addresses', 'user_invoice_profiles')
ORDER BY tablename, indexname;
```

Expected:

- Both wallet tables exist.
- Foreign keys point to `users(id)`.
- Partial unique indexes enforce one active default delivery address and invoice
  profile per user.
- No customer data is selected or printed.

## Deploy

Deploy only after SQL verification:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && ./scripts/deploy.sh'
```

Post-deploy checks:

```bash
ssh alfares 'kubectl rollout status deploy/auth-microservice -n statex-apps && kubectl rollout status deploy/auth-microservice-web -n statex-apps'
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm run check:customer-data-wallet-runtime -- --expect=deployed'
```

Expected unauthenticated result for wallet endpoints: `401`, not `404`, `500`,
`200`, or redirect. Before deploy, the same verifier can be run with
`--expect=predeploy`; the expected wallet result in that mode is `404`.

## Abort And Rollback Boundaries

Abort before SQL on:

- Dirty tracked source files.
- Wrong commit or branch.
- Missing `users` table.
- Missing `gen_random_uuid` without separate extension approval.
- Existing incompatible wallet tables.
- Auth runtime not healthy enough to support a safe deploy window.

If SQL fails, `--single-transaction` should roll back the failed SQL. After SQL
succeeds, do not drop tables as rollback without explicit destructive approval.
Prefer app rollback through Kubernetes rollout undo or a forward source fix.

## Consumer Gate

Consumer code remains gated as follows:

- FlipFlop typed wallet client work is source-prepared in commit `515f4b7`.
- FlipFlop checkout/profile selector wiring is source-prepared in commit
  `840eff6`; checkout manual-edit guard is source-prepared in commit `4268a48`.
  Runtime deployment/smoke waits for Auth SQL and deploy, and must cover
  manual edit before wallet response plus explicit selector override.
- Orders compatibility audit is complete; no Orders source change is needed until
  an approved Auth wallet provenance contract defines ID field names and
  idempotency semantics.
