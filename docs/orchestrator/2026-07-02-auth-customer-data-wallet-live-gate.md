# Auth Customer Data Wallet Live Gate

Status: approval-gated
Created: 2026-07-02
Scope: `auth-microservice` Goal 10 A1 live SQL apply and deployment.

## Purpose

Prepare the live database and runtime deployment gate for the Auth customer data
wallet source commit:

```text
b6c1585 feat: add auth customer data wallet api
```

This runbook does not grant approval. It records the exact safe sequence to use
after the owner approves schema-only DB preflight, SQL apply, and Auth deploy.

## Current Gate State

- Auth source for delivery addresses, invoice profiles, and checkout aggregate
  exists in `b6c1585`.
- `scripts/create-customer-data-wallet-tables.sql` is additive and idempotent.
- Production uses `DB_SYNC=false`; do not set `DB_SYNC=true`.
- Live SQL has not been applied.
- Auth `b6c1585` has not been deployed in this runbook.
- FlipFlop and other consumer runtime work remains dependency-gated until Auth
  SQL and deploy are live.
- Runtime gate blocker observed after pre-approval fixes: Auth backend was
  `0/1` on old image `0d4282b-20260702102426`, public health returned HTTP
  503, and an Auth-only pod recreation still left the backend pod stuck before
  init containers due cluster-wide `FailedCreatePodSandBox` / stale sandbox
  reservation failures. Treat this as an operational gate: do not run SQL or
  deploy until Auth backend health is restored or an owner-approved node/runtime
  recovery window is completed.

- Runtime repair follow-up: backend desired state was restored from
  `spec.replicas=0` to `spec.replicas=1` on the same old image, the already
  deleting Auth pod was force-deleted, and Kubernetes created a replacement pod
  that remained `Init:0/2` / `PodInitializing` after the polling window. SQL/deploy remains blocked
  until this replacement backend reaches healthy runtime or an owner-approved
  node/container-runtime recovery completes.

- Runtime drift follow-up: repeated safe restore attempts with
  `kubectl scale deploy/auth-microservice --replicas=1` were reverted by live
  state back to `spec.replicas=0` on the old image. HPA/KEDA were not found, and
  source `k8s/deployment.yaml` still declares `replicas: 1`. Treat the external
  replica drift as a hard live gate: do not run SQL or deploy until the backend
  remains stable at `replicas=1` and public `/health` is healthy.

- Runtime recovered follow-up: backend recovered on old image
  `0d4282b-20260702102426` with backend and web both `1/1 Running`, and public
  `/health` returned ok. Live wallet endpoint probes still returned HTTP 404,
  confirming Goal 10 wallet code is not deployed. The live gate can proceed
  only after owner approval for schema-only DB preflight, SQL apply, and Auth
  deploy.

## Required Owner Approvals

- Approval to run schema-only live DB preflight and verification.
- Approval to use DB connection environment values without printing them.
- Approval to apply `scripts/create-customer-data-wallet-tables.sql` in a live
  DB change window.
- Approval to deploy Auth with `./scripts/deploy.sh`.
- Approval for any authenticated synthetic smoke that creates, updates,
  defaults, or deletes wallet rows.

## Source Preflight

Run before any DB action:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && git status -sb --ahead-behind && git status --porcelain=v1 && git rev-parse HEAD && git rev-parse origin/main && git log -1 --oneline && sha256sum scripts/create-customer-data-wallet-tables.sql scripts/deploy.sh'
```

Expected:

- `HEAD` and `origin/main` are the approved commit.
- No dirty tracked source files.
- Any unrelated untracked files are identified and left untouched.
- SQL and deploy script checksums are recorded.

Rerun source validation before approval execution:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/auth-microservice && npm test -- --runTestsByPath src/auth/auth-contract.spec.ts src/users/users.service.spec.ts && npm run test:auth-contract && npm run build && npm run lint && git diff --check'
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
curl -fsS https://auth.alfares.cz/health
curl -i https://auth.alfares.cz/auth/profile
curl -i https://auth.alfares.cz/auth/profile/checkout-data
curl -i https://auth.alfares.cz/auth/profile/delivery-addresses
curl -i https://auth.alfares.cz/auth/profile/invoice-profiles
```

Expected unauthenticated result for profile and wallet endpoints: `401`, not
`500`.

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
