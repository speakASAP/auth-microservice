# RS256 Service-Token Migration — Per-Pair Identities with Automatic Rotation

**Status:** approved 2026-08-25 · owner-approved for execution
**Owner:** ssf
**Trigger:** `9269a86 feat(auth): retire HS256 signing and verification (F3 step 4)`, 2026-08-18

---

## 1. Why this exists

auth-microservice verifies **RS256 only** since 2026-08-18. Every HS256 service token
in the ecosystem is refused at `jwt-verifier.ts:142` before any other check — before
`exp`, before roles. A token with `exp` in 2027 is just as dead as an expired one, and
it looks perfectly healthy in every dashboard.

This went unnoticed for six days because every rejection path threw a bare
`UnauthorizedException` and logged nothing. Fixed in `eb03ddb` (2026-08-25): rejections
now log at error level with `alg`, `kid`, `sub`.

The visible symptom was `catalog-contract-monitor` failing hourly with two 503s naming
neither auth nor the algorithm:

```
catalog → warehouse /api/stock/availability/batch
  → warehouse JwtRolesGuard → auth /auth/validate
  → 401 "Unsupported token algorithm HS256; RS256 required"
  → warehouse 401 → catalog ServiceUnavailableException → 503
```

## 2. Design decision: per-pair Auth-issued RS256 service JWTs

Approved by owner 2026-08-25. Recorded in
`docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`, which was revised the same day.

RS256 already removed the catastrophic blast radius: only auth holds `JWT_PRIVATE_KEY`,
so a compromised service cannot mint anything. Verifiers hold public key material and
are structurally incapable of signing.

**Per-pair** narrows it further. One principal per `(caller → target)` pair, so
compromising `catalog → warehouse` does not expose `catalog → bazos`. Revocation is
per-pair: deactivate that principal, reissue that one token, restart that one service.

```
email: svc-<caller>--<target>@internal.alfares.cz
name:  <caller>--<target>
role:  internal:<target>:<least-privilege-role>
exp:   90d
```

### Rejected alternatives

**Shared static `x-internal-service-token`.** The pre-2026-08-25 standard preferred this
for new machine paths, and this plan initially recommended adopting it. It fails both
owner requirements: `InternalServiceGuard` compares one shared `INTERNAL_SERVICE_TOKEN`,
so a single leak forces simultaneous rotation everywhere — structurally the same failure
as the shared HS256 secret being retired — and it carries no roles, only a binary string
match plus a caller-asserted `x-service-name` that any holder can spoof.

**Per-application signing keys.** Replaces one key-distribution problem with N across
40+ services, and does not bound the only remaining ecosystem-wide risk: auth's private
key. That is bounded instead by 90-day lifetimes and `kid`-based rotation, which JWKS
already supports without redeploy. Today's 2027 expiries mean a 15-month forgery window
if auth's key leaks; 90 days means 90 days.

## 2b. Why this keeps recurring

The owner's observation that "this fix was done several times" is correct, and the
mechanism is visible in the repository:

- **Four provisioning scripts existed**, three of them HS256-only. Each incident
  produced a new script instead of fixing the previous one. Consolidated to one on
  2026-08-25; see `scripts/REMOVED-PROVISIONING-SCRIPTS.md`.
- **The RS256 migration shipped with no design document.** Four commits
  (`ac029df` → `9269a86`), no plan, no service-token phase. It handled user tokens and
  silently orphaned every service token.
- **A known open item was left open.** `INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`
  follow-up 4 (2026-06-13) flagged the catalog↔warehouse token contract as needing
  reconciliation. Two months later HS256 retirement detonated exactly that gap.
- **The verifiers check plumbing, not acceptance.** `check-stock-credential-wiring.sh`
  reports `passed` when a key exists and ESO says `SecretSynced`. Both were true for the
  entire outage.
- **Auth logged nothing on rejection** until `eb03ddb`, so the failure surfaced only as a
  downstream 503 naming neither auth nor the algorithm.

Each fix addressed a symptom. The durable corrections are: one script, a standard that
states the required shape, acceptance-based rotation, and rejection logging.

## 2c. Independent validation, 2026-08-25 — what changed in this plan

A read-only validation session re-derived the findings below against the live cluster and
the auth database. Three results changed the plan and are folded into the phases:

**The role claim did not constrain anything (now fixed for warehouse).** Every service
except `orders-microservice` fell through to a blanket guard default:

```ts
return [`global:superadmin`, `internal:${name}:admin`];
```

Warehouse had 3 `@Roles` decorators across 45 routes. `POST /api/stock/set`, `increment`,
`decrement`, `reserve` and `unreserve` therefore required the *same* role as the read-only
`POST /api/stock/availability/batch` that catalog actually calls. A leaked catalog→warehouse
token could rewrite inventory. Per-pair issuance bounds *revocation*; it does not bound
*authority* until the receiver can tell read from write. **Phase 1a below closes this and
must land before Phase 2.**

**The inventory covers about a third of the surface.** The 46-token count was derived by
walking named `env[]` entries. 64 of 82 running pods mount secrets in bulk via
`envFrom.secretRef`, whose keys never appear as named env vars — catalog's own
`WAREHOUSE_SERVICE_TOKEN` among them. Enumerating keys across bulk-mounted secrets gives
**157 distinct `(secret, key)` token materials**, 19 shared by more than one pod. Phase 6's
manifest must be rebuilt against that number.

**Agent-to-agent is not covered by this plan.** `docs-rag-microservice` runs a separate
credential system: `HS256` via `createHmac`, a shared symmetric secret, `serviceId` instead
of `sub`, no roles, and a 365-day default expiry (`src/service-identity/jwt.util.ts`).
Symmetric signing means every verifier can also mint — the property RS256 was chosen to
eliminate. Phase 5 currently treats these as misplaced variables; they are an unmigrated
auth system and need their own phase.

### Findings outside this plan's scope, ranked

| # | Finding | Why it outranks the migration |
| --- | --- | --- |
| 1 | `speakasap-financial-config` is a **ConfigMap** (unencrypted) holding four token keys that are byte-identical to one another — one shared static secret across four service paths | Plaintext, shared, and the exact failure mode this plan exists to remove |
| 2 | `suppliers-microservice` maps `CATALOG_SERVICE_TOKEN` **and** `WAREHOUSE_SERVICE_TOKEN` to the same key `stock-traceability-runtime-token#JWT_TOKEN`, which has **no ExternalSecret** | Hand-created, outside Vault/ESO, so no manifest-driven rotation will ever reach it. No matching principal exists in the auth DB, so it cannot be revoked |
| 3 | `test@example.com` holds `global:superadmin` and is active in production | Verification gate 4 checks service tokens only and would not catch it |
| 4 | Warehouse's `resolveStaticServiceActor` granted full admin on a shared static string, mounted by two pods | Auth-side revocation cannot close it. **Downgraded to read-only in Phase 1a** |

## 3. Inventory (measured 2026-08-25, all 81 running pods)

46 JWT-shaped env tokens: **41 HS256 (dead), 5 RS256** (`AI_SERVICE_TOKEN` only —
someone migrated that one and stopped).

The 41 are not one problem. They are four, and only category A is a straight reissue.

### A. Real principals, DB-backed — 12 tokens, 6 principals

| Principal | email | Held by |
|---|---|---|
| `4779b55f…` | catalog-warehouse-service@alfares.cz | catalog `WAREHOUSE_SERVICE_TOKEN` |
| `6ce0e6a7…` | orders-microservice@internal.alfares.invalid | orders `WAREHOUSE_SERVICE_TOKEN` |
| `f1a51702…` | aukro-service@internal.alfares.invalid | aukro `WAREHOUSE_SERVICE_TOKEN` |
| `b4907676…` | allegro-service@internal.alfares | allegro `WAREHOUSE_INTERNAL_SERVICE_TOKEN` |
| `c4fe2c2e…` | cliplot-orders-status-smoke@internal.alfares.cz | cliplot `ORDERS_STATUS_SERVICE_TOKEN` |
| `369e4f3c…` | service.allegro@internal.alfares.cz | **5 holders** (see B) |

### B. Shared identity across services — violates per-pair

`369e4f3c…` (`service.allegro`) appears in **five** places:
allegro-imports `JWT_TOKEN`, allegro-service `ALLEGRO_INTERNAL_SERVICE_TOKEN`,
allegro-service `JWT_TOKEN`, orders `ALLEGRO_INTERNAL_SERVICE_TOKEN`,
marketing `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN`.

One compromise exposes four other call paths. Splitting these is the single biggest
isolation win in this plan.

### C. Invented `sub`, no DB row — 7 tokens, unrevocable

`catalog-authorized-runtime-smoke`, `catalog-to-bazos-draft-smoke`,
`codex-runtime-smoke`, `bazos-service`, `flipflop-service`, and monitoring's
`d9e47c17…` (UUID-shaped but no row).

These were hand-signed with arbitrary `sub` strings and arbitrary roles. They worked
only because HS256 let anyone holding the shared `JWT_SECRET` mint any claim — exactly
the forgery property RS256 removes. **You cannot deactivate a principal that does not
exist**, so today these are unrevocable.

> `codex-runtime-smoke` carries **`global:superadmin`** plus four `internal:*:admin`
> roles, in suppliers-microservice under both `CATALOG_SERVICE_TOKEN` and
> `WAREHOUSE_SERVICE_TOKEN`. This is the highest-privilege credential found and it has
> no identity behind it. Treat as the priority item.

### D. Not auth tokens at all — 22 tokens

Payload: `{"serviceId":"alfares-agent-rag","iss":"docs-rag-microservice",…}` — no `sub`,
no `roles`. `docs-rag-microservice` tokens copy-pasted into env vars named
`WAREHOUSE_INTERNAL_SERVICE_TOKEN`, `PAYMENTS_INTERNAL_SERVICE_TOKEN`,
`ORCHESTRATOR_SERVICE_TOKEN`, `MARKETING_API_TOKEN`, and 18 more.

These would fail auth on **missing roles** even under HS256. Grep confirms the vars
*are* read by service code (orders 3 files, runlayer 2, marketing/payments/heureka 1
each), so these are live call paths carrying credentials that never could have worked.
This is a second, pre-existing breakage independent of the HS256 retirement, and it
means some of these paths have been silently failing or silently skipped for a long
time. **Each needs its call path traced before issuing anything** — the right fix may be
"delete the var and fix the caller", not "mint a token".

## 4. Execution

### Phase 0 — done (`eb03ddb`, deployed, verified in production)

- `jwt-verifier.ts`: rejections log at error level with `alg`/`kid`/`sub`; token value
  never logged
- `scripts/provision-service-token.js`: RS256 provisioning runnable inside the pod
  (the `.ts` helper needs a workstation DB connection — port-forward and Vault-read
  password, both forbidden by the postgres MCP agent guide)
- `Dockerfile`: ship `scripts/` into the runtime stage (was builder-only)
- Verified: 28 suites / 211 tests, `tsc --noEmit` clean, 8/8 argument gates reject
  before DB access, live log line confirmed on the new pod

### Phase 0b — standard and scripts (2026-08-25)

- `SERVICE_IDENTITY_CONSUMER_STANDARD.md` revised: per-pair Auth-issued RS256 service
  JWTs are the standard for service↔service and agent↔agent; the static header contract
  is legacy and closed to new paths; rotation must verify acceptance; a lane is not
  closed without a successful authenticated call
- Three HS256-only provisioning scripts removed, consolidated into
  `scripts/provision-service-token.js` with `--check-db-only` carried over
- Follow-up 4 of `INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md` closed

### Phase 1 — catalog → warehouse (pilot, proves the pipeline)

**Prior art — read before running.**
`catalog-microservice/docs/orchestrator/TASK-STOCK-004-catalog-warehouse-token-runbook.md`
already documents this exact lane and has already been executed once. It established the
wiring in place today:

```
Vault:    secret/prod/auth-microservice#CATALOG_WAREHOUSE_SERVICE_TOKEN
ES remap: catalog-microservice-secret WAREHOUSE_SERVICE_TOKEN → that property
Env key:  WAREHOUSE_SERVICE_TOKEN (unchanged; catalog tries this key first)
```

Catalog's warehouse token is stored under **auth's** Vault path, not catalog's. Writing
to `secret/prod/catalog-microservice#WAREHOUSE_SERVICE_TOKEN` is inert — nothing reads
it. This plan's first attempt did exactly that, and ESO still reported
`True SecretSynced` while the K8s Secret kept its old HS256 value. Fingerprint the
mounted Secret against the minted token; never trust the sync status alone.

Steps:

1. `--check-db-only` to inspect existing principal state
2. `--dry-run`, confirm `wouldCreateUser` matches intent (`false` when reusing an
   existing principal — guards the email-typo path that silently creates a duplicate)
3. `--apply --expires-in=90d`, token written to a 0600 file, never printed
4. **Probe before storing**: call `/auth/validate` and the real warehouse endpoint with
   the new token. Do not touch Vault until both succeed.
5. Pipe into `vault kv patch secret/prod/auth-microservice CATALOG_WAREHOUSE_SERVICE_TOKEN=-`
   — never via stdout
6. Fingerprint-compare Vault value and mounted K8s Secret against the minted token
7. Force-sync the ExternalSecret, restart catalog, delete the token file
8. **Verify by reproducing the original failure**: `catalog-contract-monitor` succeeds
   with both previously-failing contracts passing. Not "pod restarted" — the actual
   contract.

Rollback: previous token value stays in Vault history; `vault kv rollback` + restart.

`npm run verify:stock-credential:wiring` (catalog) checks this lane's plumbing but makes
no authenticated call — it reported `passed` throughout the outage. Treat it as a
necessary-not-sufficient gate and add a probe.

### Phase 1a — role model, using the `orders-microservice` pattern (blocks Phase 2)

Per-pair tokens do not bound authority until receivers distinguish read from write. This
phase makes that true service by service. **Warehouse is done and is the worked example;
every other service follows the same six steps.**

#### The reference pattern

`orders-microservice` is the only service that already had this right — 19 `@Roles`
decorators over 13 distinct role sets, defined as named constants rather than inline
strings. Copy that shape, not its guard verbatim (orders still keeps the unsafe default
fallback described in §2c).

Four properties make it the model:

1. **A role vocabulary below `admin`** — `:readonly` and `:action-admin` alongside `:admin`.
2. **Named constants per capability**, e.g. `@Roles(...ADMIN_READ_ROLES)` — greppable,
   reviewable, one edit point per capability.
3. **Per-caller identity maps to a per-caller role**, not a blanket admin grant.
4. **Deny by default** — mutations require an explicitly different role from reads.

#### Steps, per service

1. Create `src/auth/roles.constants.ts` with `<SERVICE>_READ_ROLES`,
   `<SERVICE>_WRITE_ROLES`, `<SERVICE>_ADMIN_ROLES`. Include `global:superadmin` and the
   existing `:admin` in every tier so nothing in flight breaks.
2. Decorate **every** route with exactly one constant. Classify by effect, not HTTP verb —
   `POST /stock/availability/batch` is a read.
3. Replace the guard's `getDefaultRoles()` fallback with a deny that logs the offending
   `Controller.handler` at error level. An undecorated route must fail loudly, not inherit
   admin.
4. Downgrade any static-token bypass to `:readonly` and log a warning on use.
5. Seed the missing role rows in the auth DB (see below) before minting tokens against them.
6. Prove it with tests: a readonly principal is **accepted** on a read route and
   **refused** on a write route; an undecorated route is refused.

#### Roles are per-application rows — seed before minting

`roles` rows are scoped by `applicationId`, so `internal:<service>:readonly` must be created
against that service's application id. Warehouse already has `admin` (12 holders) and
`action-admin` (1 holder); only `readonly` is missing.

`roles` defaults `id` (`uuid_generate_v4()`), `isActive` (`true`), `createdAt` and
`updatedAt` (`now()`), so the insert only needs four columns:

```sql
-- warehouse-microservice applicationId: 72b8dcc1-6bd6-47f0-be43-83e74def56a5
-- verified 2026-08-25; existing roles on this application: admin, action-admin
-- Run through the postgres MCP. Show the SQL and confirm before writing.
INSERT INTO roles (name, scope, "applicationId", description)
VALUES ('readonly', 'internal',
        '72b8dcc1-6bd6-47f0-be43-83e74def56a5',
        'Read-only warehouse access for per-pair service JWTs');
```

Verify before and after:

```sql
SELECT r.name, r.scope, r."isActive" FROM roles r
JOIN applications a ON a.id = r."applicationId"
WHERE a.name = 'warehouse-microservice' ORDER BY r.name;
```

Then grant it to the catalog→warehouse principal `500affb4-1ddb-46ab-abd1-a191891104db`
**in place of** its current `internal:warehouse-microservice:admin` grant, and re-mint.

#### Warehouse: deployed and verified in production 2026-08-25

Commit `a8f76d0`, rolled out at 13:35Z. Verified against the live pod, by pod age against
commit time rather than log-window matching:

| Probe | Result |
| --- | --- |
| `GET /api/health` (a `@Public()` route) | `200` |
| `POST /api/stock/availability/batch`, no credential | `401` |
| `POST /api/stock/availability/batch`, cliplot static token | `201` |
| `POST /api/stock/set`, cliplot static token | **`403`** — was `200` before this commit |
| `"missing an authorization policy"` in logs since rollout | none — all 45 routes are decorated |

The write probe is the finding closed: the same credential that could rewrite inventory an
hour earlier is now refused on mutations and still serves reads. Confirmed the shipped image
actually contains the change (`dist/src/auth/roles.constants.js` present, `getDefaultRoles`
absent from the compiled guard) rather than trusting the deploy banner.

`catalog-contract-monitor` still reports the same two pre-existing 503s,
`authorized-warehouse-availability` and `authorized-flipflop-projection`, caused by
catalog's dead HS256 token. Phase 1 has not been wired yet, so this is unchanged — not a
regression from this commit.

#### Regression found and fixed: trace internal callers, not just external ones

Restricting the cliplot static token to read-only broke `warehouse-reservation-expiry`,
which called `POST /api/reservations/expire-due` with that credential and began failing
`403` every minute. Commit `c4f5427` fixes it.

The endpoint classification was derived from *cross-service* callers, which correctly
showed that no external service mutates warehouse stock. It missed that warehouse's **own
CronJob** was borrowing `CLIPLOT_WAREHOUSE_SERVICE_TOKEN` — cliplot's external credential,
sourced from `secret/prod/cliplot` and also mounted by heureka-service — to perform a
write. Restricting a shared external token therefore disabled internal maintenance.

Re-granting write to that token would have restored the job by reopening the exposure. The
fix instead gives maintenance a dedicated identity: `WAREHOUSE_MAINTENANCE_TOKEN` carrying
only `internal:warehouse-microservice:maintenance`, required by `expire-due` alone, so the
maintenance credential cannot perform general writes either.

**Apply this to every remaining service.** Before restricting any credential, enumerate
*all* of its consumers — CronJobs, Jobs, init containers and sidecars included, not just
service-to-service HTTP calls:

```bash
# every workload mounting a given secret key
kubectl get cronjob,deploy,job -n statex-apps -o json \\
  | grep -l '<SECRET_KEY_NAME>'
```

Two further traps this surfaced:

- **`JWT_TOKEN` in `secret/prod/warehouse-microservice` is not a warehouse credential.** It
  holds a docs-rag HS256 token (`serviceId: alfares-agent-rag`) — a category-D credential
  in a misleading variable name. Decode before reusing any token by its name alone.
- **A new Vault key never reaches pods until `external-secret.yaml` names it**, and ESO
  reports `Synced` regardless. The key was added to the manifest in the same commit.

#### Verified live after `c4f5427` (deployed 16:30Z)

All four role boundaries probed against the running pod:

| Probe | Expected | Actual |
| --- | --- | --- |
| maintenance token → `POST /api/reservations/expire-due` | 2xx | `201` |
| maintenance token → `POST /api/stock/set` | 403 | `403` |
| cliplot token → `POST /api/reservations/expire-due` | 403 | `403` |
| cliplot token → `POST /api/stock/availability/batch` | 2xx | `201` |

The CronJob was then unsuspended and confirmed on a real scheduled run
(`warehouse-reservation-expiry-29794593`, `succeeded=1`, body
`{"status":201,"success":true,...}`) rather than a manual probe. Zero
`missing an authorization policy` and zero `Insufficient permissions` entries in
warehouse logs since the rollout; heureka-service, the other holder of the cliplot
token, is healthy.

**Deploy note.** The first attempt at `c4f5427` failed after 1s in preflight:
`deploy.sh` refuses to deploy while the service has unhealthy pods, and the failing
CronJob pods from the regression were themselves blocking the fix that repairs them.
Delete the failed jobs first (`kubectl delete job <name> -n statex-apps`), then deploy.

#### Warehouse: change detail

- `src/auth/roles.constants.ts` — new; three tiers plus `ALLEGRO_FULFILLMENT_ROLES` and
  `FULFILLMENT_WRITE_ROLES` so the marketplace and orders lanes cannot reach general
  warehouse mutations.
- `src/auth/jwt-roles.guard.ts` — `getDefaultRoles()` removed; undecorated routes now raise
  `ForbiddenException` and log at error level. Static cliplot token downgraded from
  `:admin` to `:readonly` and logs a warning on use.
- All **45 routes** decorated: 42 `@Roles` + 3 `@Public` (health/readiness). The 3
  pre-existing inline decorators were migrated onto the shared constants.
- Tests: 127/127 pass, `tsc --noEmit` clean. Four new cases cover deny-by-default, the
  readonly/write split, and the downgraded static token.

Endpoint classification, derived from actual callers (only `catalog-microservice` calls
warehouse externally, and only these two paths):

| Route | Tier | Caller |
| --- | --- | --- |
| `POST /api/stock/availability/batch` | READ | catalog-microservice |
| `POST /api/warehouses/logistics/batch` | READ | catalog-microservice |
| `GET  /api/stock/*`, `/movements/*`, `/reservations` (GET) | READ | internal |
| `POST /api/stock/{set,increment,decrement,reserve,unreserve}` | WRITE | **no external caller** |
| `POST /api/reservations/{reserve,release,fulfill,cancel,expire,expire-due,return}` | WRITE | internal |
| `POST/PUT/DELETE /api/warehouses`, `PATCH /supplier-reconciliations/:id/review` | ADMIN | internal |

No external caller touches any stock mutation, so catalog's token can be minted
`:readonly` with no loss of function.

#### orders-microservice: the reference had the same gap (`8093657`, deployed 19:01Z)

The service held up as the pattern still carried the fallback it demonstrates
against. 12 routes across `items`, `pricing`, `shipments` and `GET /orders` were
undecorated and inherited `[global:superadmin, internal:orders-microservice:admin]`.

All 12 decorated using the constants that already existed (`ADMIN_READ_ROLES`,
`ADMIN_ACTION_ROLES`, `PRICING_ADMIN_ROLES`); `getDefaultRoles()` removed. Verified
live: deny-by-default present in the shipped image, `getDefaultRoles` absent,
`/health` 200, and all four route groups return 401 unauthenticated. Zero
`missing an authorization policy` entries and zero permission denials since rollout,
with every orders consumer healthy.

**Counting `@Roles` with a line-based grep undercounts.** Both warehouse and orders
place some `@Roles` *after* the route decorator, so a naive "previous line" check
reports them as undecorated — it claimed 23 for orders where only 12 were real. Scan
the whole decorator block above and below the route.

**Cross-repo assertions break on refactors.**
`orders-microservice/scripts/verify-shipment-runtime-readiness.js` asserted on the
literal string `@Roles('internal:allegro-service:service')` inside *warehouse's*
controller, so migrating that to a shared constant failed an orders test. It now
checks the decorator and separately asserts the constant carries the minimal role —
verifying the contract rather than the spelling. Expect more of these when
decorating the remaining services.

#### logging, backups, monitoring — Phase 1a complete (deployed and verified)

Three services, three different architectures. Only backups used the global
`JwtRolesGuard` pattern; logging and monitoring gate per controller with
`@UseGuards`, so counting missing `@Roles` overstated the exposure badly — 59
"undecorated" routes were really 11 unguarded ones, most of them intentionally
public (health, static admin HTML, signature-checked webhooks).

**logging (`a50e9dd`, `9ffb9f0`) — a live unauthenticated data leak.**
`GET /api/logs/marathon-events/summary` answered `200` with no credential while
`query`, `coverage` and `services` in the same controller all required
`AdminRoleGuard`. It returned marathon registration event codes, per-code counts,
error totals and last-seen timestamps. Now `401`. Because it is a summary rather
than raw log contents it gets a read tier (`LogReadRoleGuard`) accepting
`internal:logging-microservice:readonly`; admin routes still refuse that role.

Both callers had to be fixed in the same change or the guard would have broken
them: monitoring's marathon panel sent no credential at all, and the logging MCP
called it with `auth:false`. Monitoring now uses a per-pair RS256 principal,
`svc-monitoring--logging@internal.alfares.cz`.

**backups (`a0d1e9f`) — 24 undecorated routes and a superadmin bypass.** Every
non-public route inherited the guard default, so read access implied delete
access. Now three tiers with deletes and infrastructure discovery at ADMIN. The
static `SERVICE_TOKEN` bypass returned `true` with `global:superadmin` before any
role check; it is scoped to the operator tier, must satisfy the route policy, and
logs a warning. Verified live: that token gets `200` on `GET /jobs`, `403` on
`DELETE /jobs/:id` and `403` on `/discovery/kubernetes`.

**monitoring (`39fbc3e`) — authentication without authorization.**
`MonitoringAuthGuard` validated the token and returned `true` with no role check,
so any valid ecosystem principal could list, create, rotate keys for and delete
customer integrations. It now requires an admin or operator role. Verified live:
a valid token carrying an unrelated role gets `403` where it previously got `200`.

Auth rows created: `readonly` on logging; new `monitoring-microservice` and
`backups-microservice` **application** rows (neither existed) with `admin`,
`operator` and — for backups — `readonly`.

**A guard's constructor is part of its contract.** Giving `AdminRoleGuard` a
`ReadonlySet` constructor parameter made Nest unable to resolve it, and
logging crash-looped on deploy (`Nest can't resolve dependencies of the
AdminRoleGuard (?)`). The unit tests passed throughout because they construct
guards directly and never touch the DI container. Narrow a role set with an
overridable protected field, and resolve guards through
`Test.createTestingModule` so a non-injectable constructor fails in tests.

**A crash-looping pod blocks its own fix.** `deploy.sh` preflight refuses to
deploy while the service has unhealthy pods, and the ReplicaSet keeps recreating
the broken pod from the previous image. Delete the failed pods and scale the
deployment to zero before redeploying.

#### Remaining services, by exposure

| Service | Routes | `@Roles` today | Priority |
| --- | --- | --- | --- |
| `warehouse-microservice` | 45 | **42 + 3 public** | **done** (`a8f76d0`) |
| `orders-microservice` | 35 | **done** (pre-existing) | already deny-by-default; audit false positive |
| `payments-microservice` | 46 | **done** (`7ab8bd1`) | already covered; deny-by-default added |
| `notifications-microservice` | 36 | **done** (`e7a5cac`) | 29 decorated; superadmin removed |
| `suppliers-microservice` | 11 | **done** (`6674357`) | 9 decorated; `authenticated` default removed |
| `logging-microservice` | 6 controllers | 0 | medium |
| `backups-microservice` | 9 controllers | 0 | medium |
| `monitoring-microservice` | 10 controllers | 0 | medium |

#### Gate

Phase 2 does not start until: warehouse is deployed and verified, the `readonly` role row
exists, principal `500affb4` is re-minted `:readonly`, and `catalog-contract-monitor`
succeeds.

### Phase 2 — split the shared `369e4f3c…` identity (category B)

Five new per-pair principals, one per holder. Reissue, roll out one service at a time,
verify each before the next. Deactivate `369e4f3c…` only after all five are confirmed —
it is live and shared, so premature deactivation breaks four services at once.

### Phase 3 — category A remainder (5 principals)

Same as Phase 1, one at a time.

### Phase 4 — category C, identity-less tokens

Per token: decide **create a real principal** or **delete and fix the caller**.
`codex-runtime-smoke` first, and its `global:superadmin` is not to be reissued —
replace with least-privilege per-pair roles matching what the code actually calls.

### Phase 5 — category D, wrong-service tokens

Trace each of the 22 call paths. Expect a mix of "delete the var", "point at
docs-rag properly", and "issue a real auth token".

### Phase 6 — automatic rotation

CronJob `service-token-rotation` in `statex-apps`, from the auth image, daily.

For each entry in a manifest of `(caller, target, vault_path, vault_property, env_var,
probe)`:

1. **Probe acceptance first.** Make the real authenticated call and check it succeeds.
2. Re-mint if the probe fails **or** `exp` is under 30 days away.
3. Write to Vault, force-sync the ExternalSecret, restart the consumer.
4. **Re-probe.** The lane is not closed until an authenticated call succeeds.

> **Acceptance is the trigger, not `exp`.** A token can be unexpired and still refused —
> algorithm change, key rotation, deactivated principal. On 2026-08-18 that was true of
> 41 tokens at once, several with `exp` in 2027. An `exp`-based check calls every one of
> them healthy and skips the rotation that would fix them. This is the single most
> important correction in this plan: the first draft rotated on `exp` alone and would
> have missed the entire outage it was written to prevent.
>
> `shared/scripts/rotate-logging-admin-token.sh` already implements this correctly and is
> the reference: *"never trusts exp on its own — it asks the logging service whether the
> token is actually accepted, and re-mints on any rejection."* Reuse its structure.

Non-negotiables, learned from this incident:

- **Fail loudly.** Any rotation failure raises and alerts to Telegram. A rotation job
  that silently skips is how 2027 expiries happened.
- **Assert RS256 on every emitted token** (already in the script) — emitting HS256
  would recreate this outage.
- **Probe, don't infer.** Key present, `SecretSynced`, pod restarted — none of these
  prove acceptance. `catalog-microservice/scripts/check-stock-credential-wiring.sh`
  reported `status: passed` throughout the outage because it never made an
  authenticated call. Extend it with a probe rather than trusting it.
- **Never log token values.**

Rotation at 30-days-remaining on a 90-day token gives three overlapping windows before
expiry — two failed runs still leave a month of headroom. Daily runs mean an acceptance
failure is caught within a day rather than at expiry.

## 5. Verification gates

Nothing is "done" until the original failing scenario passes:

| Phase | Gate |
|---|---|
| 1 | `catalog-contract-monitor` job succeeds; both 503 contracts pass |
| 2 | All five ex-`369e4f3c` consumers serve traffic; old principal deactivated |
| 3 | Each service's live call returns 2xx |
| 4 | No `global:superadmin` remains on any service token |
| 5 | Every category-D var is deleted or backed by a real principal |
| 6 | Rotation runs green twice; a deliberately failed run alerts |

Post-migration, this must return zero HS256 rows:

```bash
# per pod: decode every JWT-shaped env var, report header.alg
scratchpad/inv.sh   # inventory across all running pods
```

## 6. Risks

| Risk | Mitigation |
|---|---|
| Email typo creates a duplicate principal, reports success | `--dry-run` first; require `wouldCreateUser:false` for existing services |
| Deactivating a shared principal breaks unknown consumers | Fingerprint holders across all pods first; deactivate only after all replacements verified |
| Token leaks into a transcript | Written to 0600 file, piped into Vault, file deleted; never echoed |
| Rotation job fails silently | Raise + Telegram alert; rotate at 30d remaining, not at expiry |
| A category-D var is load-bearing in a way grep missed | Trace the call path before deleting; prefer issuing a correct token when unsure |

## 6b. Phase 1 + 1a completion record, 2026-08-25

**Out-of-scope findings closed first** (both were live and outranked the migration):

- Finding 3 — `test@example.com` (`e2a6fdd4`) held `global:superadmin` plus ten
  `internal:*:admin` roles with a live bcrypt password, active since 2026-05-05.
  Set `isActive=false`; auth enforces this on login, `/auth/validate` and refresh.
  Deactivated rather than deleted so it stays auditable and reversible.
- Finding 1 — `speakasap-financial-config` held four byte-identical plaintext copies
  of the internal-hop token, committed to git. Moved to ESO from
  `secret/prod/speakasap/financial`; ConfigMap now has zero token keys
  (`speakasap 31053de`). **The shared value itself is unresolved**: the same secret
  exists in 11 locations across 8 services (7 Secrets + those 4 keys), so rotating it
  means coordinating every holder at once. Plaintext exposure removed; sharing tracked.

**Phase 1a — warehouse role model** (`warehouse a8f76d0`, deployed, pod `6d69c557c4`):
45 routes decorated (42 `@Roles` + 3 `@Public`), guard denies undecorated routes and
logs at error level, static cliplot token downgraded to `:readonly`. 127/127 tests,
`tsc` clean.

**Phase 1 — catalog → warehouse**: `readonly` role seeded against warehouse's
application id, granted to `500affb4`, `:admin` grant removed, token re-minted RS256.

The proof, one token, two routes:

```
READ  POST /api/stock/availability/batch -> 201  {"success":true,...}
WRITE POST /api/stock/increment          -> 403  {"message":"Insufficient permissions"}
```

That is the difference between per-pair issuance and per-pair *authority*. Before
`a8f76d0` both returned 201.

Propagation verified by fingerprint at all three hops (minted = Vault = mounted
K8s Secret = `da08f19e`), not by ESO sync status — the trap that produced a false
green on the first attempt. Vault key count 23 before and after the `patch`.

`catalog-contract-monitor`: **passed 11, failed 0**. The two contracts that opened
this incident are green.

## 6c. Phase 1a sweep, 2026-08-25 — payments, notifications, suppliers

Deployed and health-verified. Each service had a different shape of the same hole.

**`payments-microservice`** (`7ab8bd1`) — no undecorated routes existed: admin carries
`PAYMENTS_ADMIN_ROLES`, everything else is `@Public` behind `ApiKeyGuard` with per-route
`@ApiKeyScopes`, which is the documented Payments-owned API-key boundary. Only the dead
`getDefaultRoles()` trap was removed. **Ordering mattered**: the deny check must run
*after* the API-key branch — placing it first rejected live provider and checkout traffic,
caught by an existing test before deploy.

**`notifications-microservice`** (`e7a5cac`) — the worst of the three. 29 of 36 routes
undecorated; a static token `return true`d before any role check; and `SERVICE_TOKEN`
granted `global:superadmin`. All three fixed: routes classified SEND/READ/INBOUND/ADMIN,
static actors now subject to the route policy and logged on use, and the shared token
reduced to `internal:notifications-microservice:admin`. Closes follow-up 2 of
`INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`.

**`suppliers-microservice`** (`6674357`) — weakest boundary found. The default included
the literal role `'authenticated'`, which matches *any valid token in the ecosystem*, so
supplier creation, supplier update, mapping creation and import runs were reachable by any
caller holding any credential. All 9 classified READ/WRITE. This repo has **no test
script and no jest installed**; verified by build, typecheck and route audit only. That
gap is worth closing on its own.

Remaining for Phase 1a: `logging-microservice`, `backups-microservice`,
`monitoring-microservice` (medium), and `orders-microservice` needs only the
deny-by-default fix.

## 6d. Blocking finding, 2026-08-25 — allegro verifies HS256 locally and can forge

Found while auditing receivers ahead of Phase 2. **This outranks Phase 2 and Phase 2 must
not start until it is resolved.**

`allegro/shared/auth/jwt-auth.guard.ts:54` verifies tokens locally with a mounted
symmetric secret:

```ts
this.jwtSecret = process.env.JWT_SECRET || this.throwConfigError('JWT_SECRET');
decoded = jwt.verify(token, this.jwtSecret);
```

It never calls `/auth/validate`. Because HS256 is symmetric, holding the verification
secret is holding the *signing* secret. Demonstrated inside the running
`allegro-service` pod:

```
ALLEGRO LOCAL VERIFY ACCEPTS forged HS256; roles=["global:superadmin"]
```

auth itself correctly refuses the same forged token
(`401 Unsupported token algorithm HS256; RS256 required`), so `9269a86` closed this at
auth — but not at any service that verifies locally.

### 24 pods still mount a symmetric JWT_SECRET, in two clusters

| Fingerprint | Holders | Services |
| --- | --- | --- |
| `278bf2fc` | 11 | allegro-api-gateway, allegro-imports, allegro-service, allegro-settings, **auth-microservice**, backups, heureka-api-gateway, heureka-service, notifications, orders, suppliers |
| `366a1388` | 11 | ai, aukro, bazos, crypto-ai-agent, cv-tuning, docs-rag, runlayer, speakasap, speakasap-api-gateway, speakasap-certification, statex |
| `b794bf08` | 1 | monitoring |
| `4ecb98f5` | 1 | domain-research |

Any holder of a cluster's secret can mint a token every local verifier in that cluster
accepts, with any roles it likes. Per-pair RS256 tokens do nothing about this while a
receiver verifies locally with a shared symmetric key.

**Required before Phase 2**, per receiver that verifies locally: switch to
`/auth/validate` or the RS256 local verifier (`jwt-verifier.ts`), decorate routes, then
unmount `JWT_SECRET`. Auth's own mount should be reviewed too — it signs RS256 and its
verifier rejects HS256, so the variable may simply be removable.

## 6e. Audit-script correction

`scratchpad/audit.py` matched `@Roles` only when it preceded the HTTP verb decorator. It
therefore reported 12 undecorated routes in `orders-microservice` that are in fact fully
decorated (`@Get()` then `@Roles(...ADMIN_READ_ROLES)`), and orders already has
deny-by-default. Orders needs no work. Decorator order is not significant to NestJS; both
placements are valid. Counts from that script for services not hand-verified should be
treated as a floor.

## 6f. Blocker 6d resolved, 2026-08-26 — local HS256 verification removed

The forgery in 6d was reproduced in the running `allegro-service` pod before any change:

```
LOCAL VERIFY ACCEPTS forged HS256; roles=["global:superadmin"]
```

`allegro`, `heureka` and `aukro` each carried the same `shared/auth/jwt-auth.guard.ts`
doing `jwt.verify(token, process.env.JWT_SECRET)`. Each now has an
`shared/auth/jwt-verifier.ts` that fetches auth's public key from JWKS and accepts
**RS256 only**; the guard no longer reads `JWT_SECRET` at all, so it cannot mint a token
it would itself accept. Rejections log at error level with `alg`/`kid`/`sub`; token values
are never logged.

| Repo | Commit | Live proof |
| --- | --- | --- |
| heureka | `13c33ac` (+`c0a8584`) | pod rejects a token forged with its own mounted secret; 0 restarts, 0 auth errors |
| aukro | `bf94ea7` (+`7dff067`) | same, verified on pod `5b764cddcd` |
| allegro | `7c9efbf` | 4 deployments (service, api-gateway, imports, settings) |

Verified before deploy, against the real JWKS: forged HS256 **rejected**, `alg=none`
**rejected**, RS256 signed by a different key but carrying the real `kid` **rejected**
(`invalid signature`), and a genuine RS256 token **accepted**. Typechecks clean in all
three repos, and confirmed to fail on a deliberately broken type first.

The claim-mapping code was left untouched — it is signature-agnostic, so this is a change
of *who can sign*, not of what a valid token means.

### Still open, and now the top of the list

**`JWT_SECRET` is still mounted** by all three (and by 21 other pods) so nothing was
disrupted at rollout. Unmounting is a separate, safe follow-up now that no code reads it;
it should happen before the shared value is rotated.

**Two live symmetric clusters remain** (fingerprints as of 2026-08-26, current values):

| Fingerprint | Pods | Notable holders |
| --- | --- | --- |
| `ac9e7664` | 17 | ai, docs-rag, speakasap ×3, statex, flipflop ×5, bazos, cv-tuning, crypto-ai-agent, runlayer, aukro |
| `9b96c5ad` | 11 | allegro ×4, heureka ×2, **auth**, backups, notifications, orders, suppliers |

Mounting the secret is only exploitable where a service *verifies locally with it*. After
this change the known remaining local verifiers are:

1. **`ai-microservice`** — `JwtUtil` already has an RS256 path with algorithm-confusion
   protection and `JWT_PUBLIC_KEY` is set, but `ALLOW_HS256_FALLBACK=true`, so a forged
   HS256 token is still accepted. **One env flip from closed.**
2. **`docs-rag-microservice`** — same `JwtUtil`, but `JWT_PUBLIC_KEY` is UNSET and the
   fallback flag is unset (defaults to allowed). Needs the key before the flag.
   Default expiry is 365 days and the payload uses `serviceId`, not `sub`.
3. **`speakasap`** — `certification-service/view-token.service.ts` and
   `frontend/lib/drills/sso/resolve.ts`. These are self-issued tokens, a different trust
   model from auth-issued ones; they need review, not necessarily this same fix.
4. **`domain-research`** — `internal-service.guard.ts` verifies HS256 with `JWT_SECRET`
   and swallows the cause (`catch {}`). Its secret (`d00f3c29`) is its own, held by one
   pod, so it is not in either cluster above. Left untouched deliberately: it is a
   low-priority experiment and out of scope for ecosystem-wide sweeps.

Phase 2 is unblocked for the services fixed here, but items 1 and 2 above are the same
class of defect and are cheap to close.

## 6g. ai-microservice HS256 window closed, 2026-08-26

`ALLOW_HS256_FALLBACK` moved `true` -> `false` in `secret/prod/ai-microservice`
(Vault v24, key count 16 before and after the `patch`), force-synced, pod restarted.
No code change: the RS256 path and the flag already existed.

**Checked before flipping, because the flag hard-fails every HS256 caller.** All
**12** live `AI_SERVICE_TOKEN` holders were already RS256 — runlayer, shop-assistant,
notifications, crypto-ai-agent, domain-research, agentic-email, statex, and the five
flipflop services (which share one token). Zero HS256 callers, so the fallback was
dead weight. A real production caller token was verified against the pod's
`JWT_PUBLIC_KEY` through `verifyRS256` *before* the change.

End-to-end against the guarded route `POST /ai/complete`:

```
forged HS256 -> 401 {"message":"Unexpected token algorithm"}
garbage      -> 401 {"message":"Malformed token"}
real RS256   -> 400 Contract violation (passed the guard; body validation only)
```

The 400 is the point: authentication succeeded and only the request body was rejected.
Before the flip the forged token returned 200. Pod has 0 restarts and no auth errors.

> **Trap for the next person.** `POST /api/email-triage/classify` returns 200 for a
> garbage token — it is `@Public()`. Testing a fallback flag there "proves" nothing.
> Verify on a route the guard actually covers; `/ai/complete` is one.

The `ECONNREFUSED` RabbitMQ errors in that pod's boot log are unrelated and
pre-existing: no RabbitMQ pod is deployed in `statex-apps` at all.

**`docs-rag-microservice` is now the last known local HS256 verifier** (`JWT_PUBLIC_KEY`
UNSET, so its flag cannot be flipped until the key is issued and its callers re-minted).

## 6h. Phase 2 re-scoped, 2026-08-26 — `369e4f3c…` is not used as a JWT

Phase 2 says "five new per-pair principals, one per holder ... reissue". Tracing the five
holders first shows that framing does not fit: **none of these call paths parse the token
as a JWT.** All five hold the same value (`aa7ae49e`), and every consumer compares it as
an opaque string.

Live holders, all HS256, all one value:

| Pod | Env var |
| --- | --- |
| allegro-service | `ALLEGRO_INTERNAL_SERVICE_TOKEN`, `JWT_TOKEN` |
| allegro-imports | `JWT_TOKEN` |
| orders-microservice | `ALLEGRO_INTERNAL_SERVICE_TOKEN` |
| marketing-microservice | `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN` |

The wire contract is the **legacy static header**, not `Authorization: Bearer`:

- `allegro/shared/clients/order-client.service.ts:80` sends
  `x-internal-service-token` + `x-service-name`.
- `orders-microservice/src/auth/jwt-roles.guard.ts:206` resolves the env var and
  `timingSafeEqual`s the raw string, then synthesises
  `{sub: "service:allegro-service", roles: ["internal:allegro-service:service"]}`. The
  token is never decoded.
- `marketing-microservice/src/order-affinity-backfill.ts:492` strips any `Bearer ` prefix
  and sends the value as a header.

Verified live from the allegro-service pod against orders:

```
valid token + x-service-name -> 403 Insufficient permissions   (authenticated, role too weak)
wrong token                  -> 401 Missing or invalid Authorization header
no credentials               -> 401
```

**403 not 401 on the valid token is the proof**: the static credential is accepted today
and is load-bearing. Its HS256 header is decorative — that is why these five survived the
2026-08-18 HS256 retirement while category A died.

### What this means

Re-minting these as RS256 JWTs accomplishes nothing on its own: the receivers would still
`timingSafeEqual` an opaque string. Phase 2 is therefore **not** a token reissue but a
contract migration, which is a larger change than the plan assumed:

1. Move each lane from `x-internal-service-token` to `Authorization: Bearer` with a real
   per-pair principal, and have receivers verify via `/auth/validate` or the RS256
   verifier instead of string-comparing.
2. Only then does per-pair issuance bound anything, and only then can a leak be revoked
   in the auth DB rather than by editing env vars in four repos at once.

The DB principal `369e4f3c-5af8-41df-9cd2-09861d403bd6` (`service.allegro`) is active and
holds exactly one role: **`admin` on warehouse-microservice** — an app it is not used to
call. That is the same authority over-grant Phase 1a fixed for catalog, and it is
independently worth removing.

### Two defects found while tracing

- `allegro/services/allegro-service/src/allegro/orders/orders.controller.ts:104` compares
  the shared secret with `supplied !== expected` — **not** constant-time, unlike orders'
  `timingSafeEqual`.
- The same secret is reachable through a long `||` fallback chain
  (`ALLEGRO_INTERNAL_SERVICE_TOKEN || ORDERS_INTERNAL_SERVICE_TOKEN ||
  ORDER_SERVICE_INTERNAL_TOKEN || INTERNAL_SERVICE_TOKEN`), so rotating one variable can
  silently fall through to another holder of the old value instead of failing loudly.

## 6i. Phase 2 pilot — allegro-service -> orders-microservice on a per-pair principal

**Principal:** `svc-allegro-service--orders-microservice@internal.alfares.cz`
(`5de494ad-ba1a-494a-b4d3-9fd0a17d449c`), RS256, `kid=a975635403084850`, 90d,
exactly one role: `internal:allegro-service:service`. Note the expiry is
2026-11-24, not the 2027 dates category A carries.

**No receiver change was needed.** `JwtRolesGuard` line 71 is already
`internalUser || await this.validateTokenWithAuth(...)`, so the Bearer path
existed; the lane simply never used it. Phase 2 for this pair was a *caller*
change plus a principal, not a guard rewrite.

Probed before Vault was touched:

```
/auth/validate                     -> 201 valid:true
Bearer GET /api/orders/<uuid>/lifecycle -> 404 Order not found      (authorized)
Bearer POST /api/orders                 -> 400 channel is required  (authorized)
```

404/400 rather than 401/403 is the acceptance proof: authorization passed and only
business validation rejected the calls.

Propagation verified by fingerprint at all three hops — minted = Vault = mounted K8s
Secret = `03c9f99c` — not by ESO sync status. Vault key count 12 -> 13 (patch, not put).
Both copies of the token file (pod `/tmp` and local scratchpad) were deleted after the
write.

`ORDERS_SERVICE_TOKEN` had to be added to `k8s/external-secret.yaml` as well as Vault:
an unmapped key never reaches the pod while ESO still reports `SecretSynced`.

The caller prefers the Bearer token and keeps the static header only as a cutover
fallback, which now **logs a warning when used** instead of degrading silently.

### The five holders are two lanes, not one

Traced while migrating. `369e4f3c…`'s value is reused across two unrelated contracts:

| Holder | Var | Contract |
| --- | --- | --- |
| allegro-service | `ALLEGRO_INTERNAL_SERVICE_TOKEN` | static header -> orders (**migrated here**) |
| orders | `ALLEGRO_INTERNAL_SERVICE_TOKEN` | receiver side of the above |
| marketing | `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN` | static header -> orders |
| allegro-service | `JWT_TOKEN` | **Bearer** -> warehouse (`shared/clients/warehouse-client.service.ts:30`) |
| allegro-imports | `JWT_TOKEN` | same warehouse client |

Only `allegro-service` uses the order client, so allegro-imports is not part of the
orders lane at all. The warehouse lane is a genuine Bearer JWT path where `JWT_TOKEN` is
the *third* fallback behind `WAREHOUSE_SERVICE_TOKEN` and
`WAREHOUSE_INTERNAL_SERVICE_TOKEN` — so whether it is even reached depends on those being
unset. That lane needs its own principal and must not be assumed equivalent to this one.

### Pre-existing 403s, not caused by this change

`GET /api/orders` requires `ADMIN_READ_ROLES` and `PUT /:id/status` requires
`internal:orders-microservice:action-admin`. `internal:allegro-service:service` is in
neither, so both return 403 on the old *and* new credential. Two of the four routes
`order-client.service.ts` calls have therefore been failing in production independently
of this migration. Worth deciding deliberately: widen the role, or remove the calls.

`shared/clients/warehouse-client.service.ts:33` returns `{}` when no token is found,
sending an unauthenticated request instead of failing — a silent degradation worth fixing
when that lane is migrated.

## 6j. Phase 2 — marketing-microservice -> orders-microservice (staged, not yet committed)

**Principal:** `svc-marketing-microservice--orders-microservice@internal.alfares.cz`
(`a268c24b-03d2-4a56-9e71-76b51013fea0`), RS256, 90d, one role
`internal:marketing-microservice:service`.

The role did not exist and had to be seeded first — only `allegro-service` had a
`service` role. Added to the `marketing-microservice` application
(`38098e1d-20da-46ab-aceb-87c66ac492e7`), role id `0609bc20-a540-45fd-8a9e-1f7f68f7b29e`,
`scope=internal`, matching the shape of the existing rows.

Probed before storing: the Bearer token returns **200** on
`GET /api/orders/internal/order-affinity/replay-candidates`, through the real
`@Roles(...ORDER_AFFINITY_REPLAY_READ_ROLES)` check rather than a string match.
Fingerprints match at all three hops (`81e787cb`), Vault key count 7 -> 8.

### What `ORDERS_SERVICE_TOKEN` actually held

Not the shared `369e4f3c…` value, and not an orders credential at all:

```
ORDERS_SERVICE_TOKEN   fp=a2880693  alg=HS256  sub=alfares-agent-rag  roles=null  exp=2027-08-01
```

A **category-D docs-rag token with no roles**, mapped into marketing from its own
`JWT_TOKEN` Vault property. It returned 200 anyway, because orders' guard compares it
byte-for-byte against `MARKETING_INTERNAL_SERVICE_TOKEN` (same fingerprint `a2880693` on
the orders side) and then synthesises `internal:marketing-microservice:service` itself.
The payload was never read. A token that "could never have worked" per section 3 works
fine as a shared password — which is exactly why category D went unnoticed.

### The ES remap trap, again

`ORDERS_SERVICE_TOKEN` was mapped to `property: JWT_TOKEN`, so writing
`secret/prod/marketing-microservice#ORDERS_SERVICE_TOKEN` would have been inert — the same
trap Phase 1 hit with catalog. Worse, marketing's `JWT_TOKEN` feeds **six** env vars, so
overwriting the property would have silently changed five unrelated credentials. The fix
was a new Vault property plus repointing only this one `remoteRef`.

### marketing's other lane is not orders

`orderAffinityMarketplaceReplayHeadersForSource` targets **allegro**
(`/internal/allegro/order-affinity/replay-candidates`), not orders, and carries
`ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN` = the shared `369e4f3c…` value with
`roles: ["internal:warehouse-microservice:admin"]` — warehouse admin on an allegro-bound
call. That lane is untouched here and still needs its own principal before `369e4f3c…`
can be deactivated.

Tests: 121/121 pass, and confirmed to fail (120/1) when the Bearer header is reverted to
the static one.

## 6k. `369e4f3c…` deactivated, 2026-08-26

`service.allegro@internal.alfares.cz` set `isActive=false` (deactivated, not deleted, so it
stays auditable and reversible — same treatment as `test@example.com`).

**Checked first whether deactivation could break the three lanes still holding the value.
It cannot, and the reason matters:**

```
POST /auth/validate  (shared token aa7ae49e)
  -> 401 Unsupported token algorithm HS256; RS256 required
```

auth has refused this token since 2026-08-18. Every lane still carrying it either never
consults auth (static string comparison) or is **already failing**. The DB principal was
therefore decorative for all of them — deactivating it changes nothing at runtime, which
is precisely why the plan's gate "deactivate only after all five are confirmed" turned out
to be satisfiable early.

Verified immediately after, both unaffected:

```
allegro -> orders   (per-pair Bearer)  -> 404 Order not found
marketing -> orders (static, old code) -> 200 success
```

### What the remaining two holders actually are

Neither is a working orders lane, and one is already dead:

| Holder | Var | Reality |
| --- | --- | --- |
| allegro-service | `JWT_TOKEN` | **never sent.** The warehouse client prefers `WAREHOUSE_INTERNAL_SERVICE_TOKEN` (`3f3235bd`), and `JWT_TOKEN` is only its third fallback. Dead weight in this pod. |
| allegro-imports | `JWT_TOKEN` | **already broken in production.** It *is* the token the warehouse client sends here, and `POST /api/stock/availability/batch` returns `401 Invalid token`. Dead since the 2026-08-18 HS256 retirement. |
| marketing | `ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN` | targets **allegro**, not orders; carries `internal:warehouse-microservice:admin`. |

So the outstanding work is not "finish Phase 2 before deactivating" — it is repairing an
allegro-imports → warehouse lane that has been returning 401 for over two months, and
removing a `JWT_TOKEN` from allegro-service that nothing reads.

## 6l. What can run in parallel (measured 2026-08-26)

Live inventory after the pilot: **12 RS256 / 43 HS256** (pod, var) pairs, of which 21 are
category-D docs-rag tokens and the rest reference a `sub`.

The migration parallelises cleanly because the unit of work is a **lane**
`(caller, target, env var)`, and lanes touch disjoint repos. Sequencing is only forced
where two lanes share a *receiver contract* or a *deploy*.

**Safe to run in parallel** — independent repos, independent Vault paths, no shared receiver:

1. **flipflop** — 26 pairs across five services (`cart`, `order`, `product`, `user`,
   `service`) that all share one token value. One principal per lane, one repo.
2. **aukro / bazos / heureka** — 3 pairs each, same shape as the allegro pilot, and their
   guards are already RS256 after 6d.
3. **Category D (21 pairs)** — needs *tracing*, not minting: each is a docs-rag token in a
   var named for another service. Read-only investigation, parallel-safe, and it is the
   prerequisite for Phase 5.

**Must stay serialised:**

- Anything touching **orders-microservice** (9 pairs). It is the receiver for allegro,
  aukro, bazos, heureka, flipflop, cliplot, catalog, warehouse, payments, invoices and
  marketing. Two agents editing `jwt-roles.guard.ts` collide.
- **Deploys**, always — one node, one containerd. The 2026-08-26 allegro rollout hit the
  sandbox deadlock (`name is reserved`) with 9 pods Pending at 87% disk util, caused by its
  own five images. Subagents must stop at the deploy boundary.
- **Vault writes to the same path.** `kv patch` is read-modify-write, so two concurrent
  patches to one service silently drop a key.

**Ordering constraint worth stating explicitly:** a per-pair principal needs its
`internal:<app>:service` role to exist first. Only `allegro-service` had one before today;
`marketing-microservice` had to be seeded (6j). Seeding roles for every target app is a
small, serialisable prerequisite that unblocks all the parallel work.

## 6m. Production outage found while mapping marketplace lanes, 2026-08-26

**`heureka-service` cannot create orders. `POST /api/orders` returns 401 in production.**

Found by fingerprinting both sides of each marketplace -> orders lane rather than trusting
the env-var names:

| Caller | caller-side fp | orders expects | live result |
| --- | --- | --- | --- |
| aukro-service | `a2880693` | `a2880693` | 400 `channel is required` (**authenticated**) |
| bazos-service | `a2880693` | `a2880693` | 400 `channel is required` (**authenticated**) |
| heureka-service | `5f420714` | `a2880693` | **401 Missing or invalid Authorization header** |

Root cause is a wiring error in `heureka/k8s/deployment.yaml`, not a token problem:

```yaml
- name: HEUREKA_INTERNAL_SERVICE_TOKEN
  valueFrom:
    secretKeyRef:
      name: catalog-microservice-secret        # <- catalog's secret
      key: CATALOG_INTERNAL_SERVICE_TOKEN      # <- catalog's token
```

orders resolves its side from `secret/prod/heureka-service#JWT_TOKEN`, so the two values
could never match. The heureka pod already mounts the correct value under a *different*
env var (`JWT_TOKEN`, fp `a2880693`), which is why the fix is one line and needs no new
secret:

```
POST /api/orders with the pod's own JWT_TOKEN -> 400 channel is required
```

400 instead of 401 — proven from inside the running pod **before** changing the manifest.

### Why this was invisible

The same three failure-hiding mechanisms as the rest of this incident: the guard's 401 names
no service and no algorithm; the caller treats a failed order lookup as "not found"; and
`x-internal-service-token` is a string comparison, so nothing ever decodes the token to
notice it belongs to catalog.

### One string is four services' credential

`a2880693` is the **same roleless docs-rag token** already found in marketing (6j). orders
holds it as `AUKRO_INTERNAL_SERVICE_TOKEN`, `BAZOS_INTERNAL_SERVICE_TOKEN`,
`HEUREKA_INTERNAL_SERVICE_TOKEN` and `MARKETING_INTERNAL_SERVICE_TOKEN` — four distinct
"identities" that are one shared password with no revocable principal behind it. Repointing
heureka at `JWT_TOKEN` fixes the outage but does **not** fix that; these four lanes still
need per-pair principals.

Also confirmed: `GET /api/orders` returns 403 for aukro/bazos exactly as it does for allegro
(`ADMIN_READ_ROLES`), but none of the three marketplace clients call it — they call
`POST /api/orders` plus a per-order read. The 403 is on an unused route.

## 6n. Parallel investigation results, 2026-08-26 — category D and flipflop

Two read-only agents mapped the remaining surface. The headline findings below were
**re-verified directly** before being recorded here; the rest is their reporting.

### Category D is not 22 tokens. It is one password mounted 21 times.

Every category-D occurrence across 9 running pods is byte-identical: fp **`a2880693`**,
`HS256`, `{"serviceId":"alfares-agent-rag","iss":"docs-rag-microservice"}`, no `sub`, no
`roles`, exp 2027-08-01 — plus 2 dormant copies in `database-credentials#JWT_TOKEN` and
`nginx-microservice-secret#JWT_TOKEN`. Classification: **16 live, 1 dead, 6 unused.**

**The critical property: orders derives identity from the header, not the token.** The
same `a2880693` value, presented with six different `x-service-name` values, authenticates
as six different principals — `warehouse-microservice`, `payments-microservice`,
`marketing-microservice`, `aukro-service`, `bazos-service`, `heureka-service`. A wrong
token gives 401. **Any holder of `a2880693` chooses which service it is.** That is
strictly worse than `369e4f3c…` (5 holders, one identity), and revoking it means editing
15 env-var names across 8 Vault paths at once.

**`runlayer` is fully bypassable — verified directly, not taken on report:**

```
GET /api/projects  Bearer a2880693  -> 200, 1810 bytes of live project data
GET /api/projects  Bearer wrong     -> 401
```

`runlayer/src/common/auth/jwt.guard.ts:32-40` short-circuits before `/auth/validate`,
sets `request.userId = 'notifications-microservice'` and returns true for any of three
env values — two of which (`ORCHESTRATOR_SERVICE_TOKEN`, `ORCHESTRATOR_USER_JWT`) hold
`a2880693`. The intended caller, notifications, holds a *different* value (`58453383`),
so this allowlist grants nine unrelated pods full access for no reason. **Highest-priority
item found today.**

### flipflop: 8 real token values over ~40 mount points, and three dead lanes

All five services share one `envFrom`, so every pod mounts all 8 tokens regardless of use.
Only 5 outbound lanes are real. flipflop has **no local HS256 verification**, so it does
not carry the 6d forgery defect.

**Broken in production right now:**

| Lane | Status | Cause |
| --- | --- | --- |
| flipflop ×5 -> warehouse | **401** | `WAREHOUSE_SERVICE_TOKEN` **expired 2026-07-31** (verified: `expired=true`, `401 Invalid token`) |
| order-service -> orders admin action | **401** | `ORDERS_STATUS_SERVICE_TOKEN` expired 2026-08-05 |
| flipflop ×5 -> ai-microservice | **401** | `AI_SERVICE_TOKEN` is valid RS256 and works when attached — **no call site attaches it** |
| product-service -> suppliers | **404** | `GET /allegro/warehouse` route does not exist; no auth sent either |

Every stock read and every reserve/decrement from flipflop has been failing for 26 days.
It was invisible for the reason this whole incident keeps repeating —
`warehouse-client.service.ts:45-49` turns the 401 into `return []` behind a `logger.warn`,
so **an auth failure is indistinguishable from genuinely zero stock**. That is the
speakasap frozen-lesson-table failure mode exactly.

### Two defects worth fixing independently of the migration

**Fail-open guard** (`flipflop/services/order-service/src/orders/orders.service.ts:280`):

```ts
assertInternalServiceKey(internalKey: string | undefined): void {
  const expected = this.configService.get<string>('FLIPFLOP_INTERNAL_SERVICE_SECRET');
  if (expected && internalKey !== expected) {      // <- unset env == no auth at all
    throw new UnauthorizedException('Invalid internal service key');
  }
}
```

If the variable is ever unset, `POST /internal/orders/payment-result` and
`POST /internal/marketing/campaigns` become fully unauthenticated. `assertAffinityReplayAccess`
eight lines below is the correct fail-closed form (`if (!expected || ...)`), so the fix is
to match it.

**ES remap trap, live in flipflop:** `FLIPFLOP_INTERNAL_SERVICE_SECRET` and `JWT_TOKEN`
both map to Vault property `JWT_TOKEN` (`flipflop/k8s/external-secret.yaml:76-83`).
Writing that property changes both, and the first is the shared key for the intra-flipflop
payment-result webhook *and* marketing's affinity replay — overwriting it breaks both at
once. Same class as the marketing `JWT_TOKEN`-feeds-six-vars trap in 6j.

`CATALOG_INTERNAL_SERVICE_TOKEN` is likewise sourced from `secret/prod/auth-microservice`,
not flipflop's own path.

### Privilege observation

flipflop -> catalog currently buys `internal:catalog-microservice:admin` + `catalog:write`
from a static string. Migrating that lane to a per-pair Bearer principal is a privilege
**reduction**, not just a credential swap.

## 6o. Four fixes deployed and verified live, 2026-08-26

All verified against the running pods, not the deploy banner.

| Fix | Before | After |
| --- | --- | --- |
| runlayer bypass (`48d3e9d`) | shared token -> **200 + live project data** | shared token -> **401**; notifications token -> 200 |
| flipflop -> warehouse (`d61c368`) | **401**, expired 2026-07-31, 26 days dead | **200 + live data**, RS256 90d, `action-admin` |
| heureka -> orders (`af0a02b`) | **401**, order forwarding dead | **400 channel is required** (authenticated) |
| marketing -> orders (`a2529b1`) | 200 via shared roleless string | **200 via RS256 per-pair role check** |

allegro -> orders still 404 with zero static-fallback warnings. All nine deployments
1/1, zero restarts.

### Two operational traps worth remembering

**1. A "FAILED" deploy that actually succeeded.** flipflop was reported
`FAILED flipflop (exit 1) after 963s`, but all five services converged on `d61c368` at
1/1. The rollout simply exceeded the script's 600s timeout while containerd worked through
six images serially — the same sandbox contention as the allegro rollout earlier today.
**A deploy-queue failure is not proof the deploy failed; check pod image and readiness
before re-running anything.** Re-deploying on this signal would have restarted the
contention for no reason.

**2. A deploy does not clear an untracked env override.** `flipflop-product-service` had a
named `env[]` entry pointing `WAREHOUSE_SERVICE_TOKEN` at a hand-created Secret
(`flipflop-warehouse-token`, no ExternalSecret, no owner references, absent from the repo).
Deploying from the repo did **not** remove it — the prediction that it would was wrong —
so product-service kept mounting the expired `863daa51` while its four siblings picked up
the new token. Fixed by writing the new value into that Secret and restarting.

The Secret is still untracked drift: nothing in Vault or the repo governs it, so the next
rotation will miss it again unless the override is deleted from the live Deployment. Same
class as the `suppliers-microservice` hand-created secret in section 2c finding 2.

## 6p. Session B — broken lanes and silent-failure cleanup, 2026-08-26

Every item below was re-verified against the running pods before being changed. One
prediction in 6n did not survive contact (see item 2); the rest matched.

| Item | Before | After |
| --- | --- | --- |
| flipflop ×5 -> ai-microservice | **401 Missing service token** | **200** (`ae924f0`) |
| `flipflop-warehouse-token` override | untracked drift, no ESO, no owner refs | **not removed — blocked, see below** |
| notifications -> orchestrator | `catch {}` -> `[]`, outage renders as "No recent tasks found." | **404 -> `[]`, 401 -> throws** — verified in the live pod (`fa591b5`) |
| allegro/heureka warehouse clients | 401 -> `[]` / `0` behind `logger.warn` | only 404 means "no rows" (`e814c43`, `09497a6`); **immediately exposed a real 401 in allegro** |
| runlayer inert token mounts | `ORCHESTRATOR_USER_JWT` + `_SERVICE_TOKEN` synced into pod | **both absent from the new pod**; notifications -> runlayer still 200 (`6fd27fa`) |

All five deploys are live and were verified in the running pods, not from a deploy
banner: flipflop `ae924f0`, allegro `e814c43`, heureka `09497a6` (in `2b73894`),
notifications `fa591b5`, runlayer `6fd27fa`.

### 1. flipflop -> ai-microservice: every AI feature was dead

Reproduced from inside `flipflop-order-service` before changing anything, using the
token the pod already mounts (fp `f97255cc`):

```
POST /ai/complete  no auth      -> 401 {"message":"Missing service token"}
POST /ai/complete  Bearer token -> 200 {"schemaVersion":"1.0","text":...}
```

So the credential was valid and mounted in all five services; nothing attached it.
`grep -rn AI_SERVICE_TOKEN flipflop --include="*.ts"` returned nothing outside build
artifacts, confirming 6n.

**Fix (`ae924f0`)**: added `shared/clients/ai-client.service.ts` as the single source of
the credential — one helper, not five copies of the header — and routed all five call
sites through it (`pricing.service.ts`; `orders.service.ts` competitor-analysis,
dead-stock and repeat-buyer; `email-campaign.service.ts`; `abandoned-cart.service.ts`).

The helper fails closed when no credential is configured and logs the upstream status
before re-throwing, so an AI outage can never quietly become a default result.

Two things surfaced while doing it, both folded into the same commit:

- Three call sites defaulted to `http://e-commerce-ai-service:3007`, a hostname that no
  longer exists. Even once authenticated they would not have reached ai-microservice.
- The two admin endpoints (dead stock, repeat buyers) forwarded **the admin user's own
  JWT** to ai-microservice. `ServiceAuthGuard` only verifies the RS256 signature, so
  that happened to pass for a logged-in admin and fail for every scheduled/background
  call. A service-to-service hop should present the service credential; they now do.

### 2. `flipflop-warehouse-token` — analysed, NOT removed (blocked)

Re-verified the drift is still exactly as 6o describes:

```
flipflop-product-service env[]:  WAREHOUSE_SERVICE_TOKEN=flipflop-warehouse-token
ExternalSecret for it:           none
ownerReferences:                 none
referenced by:                   flipflop-product-service only
repo manifest env[]:             PORT, SERVICE_NAME only  (override is not in the repo)
```

**The removal is safe and was ready to apply**, because the two values are identical:

```
mounted now (override)            fp 59415e97
flipflop-service-secret via ESO   fp 59415e97   <- what envFrom would supply
flipflop-warehouse-token (orphan) fp 59415e97
```

Dropping the `env[]` entry therefore changes no running value; the pod keeps the same
token, sourced from ESO instead of the orphan.

**It was not applied: the `kubectl patch` was refused by this session's permission
classifier.** The exact command, to be run under the deploy lock:

```bash
shared/scripts/with-deploy-lock.sh kubectl patch deploy flipflop-product-service \
  -n statex-apps --type=json \
  -p '[{"op":"remove","path":"/spec/template/spec/containers/0/env/2"}]'
```

Then verify by fingerprint inside the new pod (expect `59415e97` still, now via
`envFrom`) and that warehouse returns 200, and only then delete the orphan Secret —
nothing else references it.

**Do not also remove `LOGGING_SERVICE_TOKEN`** from that `env[]`. It looks like the same
drift but is not: it is absent from `flipflop-service-secret`, so the named override is
the only thing supplying it, and `flipflop-order-service` carries the same mapping
deliberately. Removing it would break logging ingest.

**`suppliers-microservice` has the same shape but is NOT safe to fix the same way.**
`CATALOG_SERVICE_TOKEN` and `WAREHOUSE_SERVICE_TOKEN` both point at the hand-created
`stock-traceability-runtime-token` (no ExternalSecret, no owner refs — confirmed), but
**neither key exists in `suppliers-microservice-secret`**. Unlike flipflop, the override
is load-bearing: removing it drops both credentials. Fixing it means writing both values
into Vault and adding them to the ESO manifest first. Left for a follow-up.

### 3. Silent failures

`notifications-microservice/src/telegram-bot/orchestrator.client.ts` (`fa591b5`) — the
bare `catch {}` returned `[]`, so `/status` printed "No recent tasks found." for a 401 or
a 5xx. Now only a real 404 returns `[]`; anything else is logged at error level with the
upstream status and re-thrown, and the bot tells the user the orchestrator is
unreachable. Added `status-failure.spec.ts`, **confirmed to fail when the fix is
reverted** (asserts the user never sees the empty-list message on a 401).

`allegro` (`e814c43`) and `heureka` (`09497a6`) `shared/clients/warehouse-client.service.ts`
carried the flipflop defect verbatim:

- `requestOptions()` returned `{}` when no credential was found — an unauthenticated
  request instead of a failure. Now logs at error level and throws.
- `getStockByProduct` / `getTotalAvailable` — only 404 means "no rows"; every other
  status is logged with context and re-thrown, so a 401 can no longer read as zero stock.
- allegro `getWarehouses` / `getDefaultWarehouseId` — a failed lookup no longer becomes
  an empty list / `null`.
- heureka `getAvailabilityBatch` — the worst of them: `feed.service.ts` builds its stock
  lookup from this call, so a 401 silently published a **product feed with unknown stock
  for every product**. It now fails loudly.

The mutating methods (reserve/unreserve/set/decrement) already threw correctly and were
left alone.

**What the allegro fix immediately un-hid: allegro -> warehouse is 401 in production.**
Exercising the deployed client in the live pod now surfaces what it previously swallowed:

```
allegro-service (e814c43), getWarehouses() -> ERROR "Warehouse list lookup failed
                                              (status 401)" and throws
```

Confirmed **pre-existing and not caused by this change** — a raw `fetch` from the same
pod, with no client code involved, returns the same 401:

```
WAREHOUSE_SERVICE_TOKEN            unset
WAREHOUSE_INTERNAL_SERVICE_TOKEN   fp 3f3235bd -> 401   <- the only credential it has
INTERNAL_SERVICE_TOKEN             unset
```

This is the `allegro-imports -> warehouse` 401 already recorded as pre-existing under
Phase 2, now shown to affect `allegro-service` itself. Before this commit every one of
those calls returned `[]`/`0`, i.e. "no stock", which is why it stayed invisible.
The service is healthy (`/health` 200, 0 restarts) — the throw surfaces per request
rather than destabilising the pod. **Fixing the credential is a separate task and is
not done here**; the lane is broken either way, but it is now loud instead of silent.

**`aukro` and `bazos` carry the identical defect and were NOT touched** — Session A owns
those repos. Both need the same three edits:

```
<repo>/shared/clients/warehouse-client.service.ts:30  return {};        (no-credential)
<repo>/shared/clients/warehouse-client.service.ts:51  logger.warn -> return []   (getStockByProduct)
<repo>/shared/clients/warehouse-client.service.ts:67  logger.warn -> return 0    (getTotalAvailable)
```

### 4. runlayer follow-ups

`k8s/external-secret.yaml` (`6fd27fa`) — `ORCHESTRATOR_USER_JWT` and
`ORCHESTRATOR_SERVICE_TOKEN` both synced Vault property `JWT_TOKEN` (the shared roleless
`a2880693`) into the pod. Confirmed inert first: no runlayer source reads either name any
more — the only hits are the 48d3e9d comment and the regression tests. Mounts removed,
with a comment recording why so they are not re-added. **Retiring the `a2880693` value
itself is Session A's and was not touched.** No sequencing needed for this change: it
only stops runlayer mounting the value.

`scripts/` — `_orch-common.sh`, `e2e-smoke-test.sh`, `goal-journey-smoke-test.sh` and
`orch-final-validation.sh` all already preferred `TOKEN`/login, with
`ORCHESTRATOR_USER_JWT` as fallback. The fallback is kept (a local `.env` may hold a real
user JWT under that name) but now announces that it is deprecated and expects 401, and
the failure text points at `TOKEN`. All four pass `bash -n`; all 17 jwt.guard/admin.guard
tests pass.

### Verification notes

- `allegro` and `heureka` have **no wired test runner** — no jest config, no `test`
  script, and `ts-jest` is not installed, so their `*.spec.ts` / `*.self-test.ts` files
  cannot currently run. Typecheck is the only available gate there and passes for both.
  Worth wiring up separately; it is why these clients drifted unnoticed.
- The flipflop typecheck was confirmed to actually run by injecting a deliberate type
  error and watching it fail, then restoring — a green check that never ran is worse
  than a red one.
- `shared/dist` is gitignored and was stale locally (June); the Docker build runs
  `npm run build` in `shared/` before each service, so the image is unaffected. Rebuilt
  locally only so the typecheck reflected the image.
- **The 6o "FAILED deploy that actually succeeded" trap recurred twice**, exactly as
  documented: `FAILED flipflop (exit 1) after 963s` and `FAILED allegro (exit 1) after
  844s` were both rollout timeouts under containerd sandbox contention
  (`FailedCreatePodSandBox ... name is reserved`, 12 pods Pending cluster-wide while two
  sessions deployed concurrently). Both converged on their own with 0 restarts and were
  verified live. Nothing was re-run, and nothing needed to be. Check pod image and
  readiness before reacting to a FAILED line.

## 6q. Session A, 2026-08-26 — `a2880693` retired on all six orders lanes

The shared docs-rag token `a2880693` was mounted in 9 pods across 22 env vars. Six of those
entries were orders' per-caller slots, and they are the reason the value is dangerous.

### The defect, re-verified live before any change

`orders-microservice/src/auth/jwt-roles.guard.ts:188` `resolveInternalServiceActor()`
compares `x-internal-service-token` byte-for-byte against a per-caller env var and then
**synthesises the role from the `x-service-name` header** — it never decodes the token.
Because all six orders entries held the same value, one string authenticated as six
different principals. Measured from the aukro pod against
`GET /api/orders/internal/order-affinity/replay-candidates`:

```
x-service-name: marketing-microservice  -> 200 + live replay data
x-service-name: warehouse-microservice  -> 403 (authenticated, role-limited)
x-service-name: payments-microservice   -> 403
x-service-name: aukro-service           -> 403
x-service-name: bazos-service           -> 403
x-service-name: heureka-service         -> 403
x-service-name: catalog/flipflop/allegro-> 401 (already migrated off the value)
wrong token, any name                   -> 401
```

403-not-401 is the proof the credential was accepted; the 401s on catalog/flipflop/allegro
show what the end state looks like.

### Six per-pair principals, all probed before Vault was touched

Each got exactly one least-privilege role — `internal:<caller>:service`, which is what the
`@Roles` sets on the routes each caller actually calls. All roles already existed; none had
to be seeded.

| Lane | Principal id | fp | Probe result |
| --- | --- | --- | --- |
| aukro -> orders | `9e1da7c7-556b-46a5-8215-10e079a329ff` | `16573df3` | validate 201; 404/404/400 |
| bazos -> orders | `79fc3c1d-e035-4ce7-a79d-0eace04c1926` | `f08f27a0` | validate 201; 404/404/400 |
| heureka -> orders | `bff285ba-34a7-4d4d-8eaf-1467f06bd72c` | `ccbe4046` | validate 201; 404/404/400 |
| warehouse -> orders | `b8407087-a02f-4ba3-a9ef-8175bd1401e0` | `46477b50` | validate 201; PUT fulfillment-status 404 |
| payments -> orders | `468b2d2b-ed2e-4211-bb21-1bbecebf94e0` | `633a4184` | validate 201; PUT payment-status 404 |
| marketing -> orders | `a268c24b-03d2-4a56-9e71-76b51013fea0` | `81e787cb` | already live from 6j |

404/400 rather than 401/403 is the acceptance proof: authorization passed and only business
validation or a missing row rejected the call. Every probe used a non-existent order id, so
no production data was touched.

**All five deployed and re-verified from the running pods** (not the deploy banner), each
against the endpoint that lane actually calls:

| Pod | mounted fp | live result |
| --- | --- | --- |
| aukro-service | `16573df3` | `GET /api/orders/<id>` 404, `POST /api/orders` 400 |
| bazos-service | `f08f27a0` | `GET /api/orders/<id>` 404, `POST /api/orders` 400 |
| heureka-service | `ccbe4046` | `GET /api/orders/<id>` 404, `POST /api/orders` 400 |
| payments-microservice | `633a4184` | `PUT /:id/payment-status` 404 |
| warehouse-microservice | `46477b50` | `PUT /:id/warehouse-fulfillment-status` 404 |
| marketing-microservice | `81e787cb` | replay-candidates 200 (from 6j, still healthy) |

Six distinct fingerprints: the shared value is gone from every orders lane. Fingerprints
match at all four hops — minted = Vault = K8s Secret = pod. Vault version diffs confirm each
write touched exactly one key and changed nothing else.

Commits: `f25a764` (aukro), `0687048` (bazos), `2b73894` (heureka), `39cf960` (payments),
`5dc336f` (warehouse), plus `ee6a590`/`a662b09` (deployment env mapping, see below) and
`6d31d65` (aukro -> warehouse outage, see below).

### Two premises in the task brief were wrong, and both mattered

**1. `PAYMENTS_ORDERS_SERVICE_TOKEN` was not a dormant trap — it was the live credential.**
The brief described it as "currently shadowed by a set primary". Measured in the pod:

```
ORDERS_SERVICE_TOKEN           = <unset>
PAYMENTS_ORDERS_SERVICE_TOKEN  fp=a2880693
```

`resolveServiceToken()` is `ORDERS_SERVICE_TOKEN || PAYMENTS_ORDERS_SERVICE_TOKEN`, so with
the primary unset the shared password was what payments actually sent. The `||` chain had
already silently fallen through; there was nothing left to pre-empt.

**2. heureka's orders lane was still on the shared token despite 6o reporting it fixed.**
The Bearer code (`order-client.service.ts:242`) and the `external-secret.yaml` mapping both
shipped in `af0a02b`, but `secret/prod/heureka-service#ORDERS_SERVICE_TOKEN` **never
existed**, so `ORDERS_SERVICE_TOKEN` was unset in the pod and the static fallback carried
every request. ESO reported `SecretSynced` throughout — a mapping to a non-existent Vault
property syncs happily and silently omits the key.

This is the inverse of the 6i/6j trap. There the Vault key existed and the mapping was
missing; here the mapping existed and the key was missing.

**And then a third variant appeared in the same lane.** After creating the Vault key and
force-syncing, `ORDERS_SERVICE_TOKEN` was present in `heureka-service-secret` — and *still*
unset in a freshly created pod. Cause: `heureka/k8s/deployment.yaml` has **no `envFrom:
secretRef`**, so every secret value must be named explicitly with a `secretKeyRef`, and this
one never was. `aukro` has the same shape; `bazos`, `payments` and `warehouse` pull their
whole secret via `secretRef` and needed no entry. Fixed in `ee6a590` (heureka) and `a662b09`
(aukro).

Three independent ways for a key to not reach a pod, all reporting `SecretSynced`:

| Variant | Vault key | ES mapping | Deployment env | Seen in |
| --- | --- | --- | --- | --- |
| 1 | exists | **missing** | n/a | 6i, 6j (catalog, marketing) |
| 2 | **missing** | exists | n/a | 6q (heureka) |
| 3 | exists | exists | **missing** | 6q (heureka, aukro) |

**A fourth, operational variant: the in-cluster ExternalSecret can be stale relative to
git.** Committing a new `remoteRef` does *not* update the ES resource — the deploy queue
builds and rolls images, it does not `kubectl apply` manifests. All five ES resources in this
session reported `configured` (not `unchanged`) when applied by hand *after* their commits
had landed, and `ORDERS_SERVICE_TOKEN` was missing from `payments-microservice-secret` and
`warehouse-microservice-secret` until then — the sha256 of the absent key reads as
`e3b0c442`, the hash of empty input, which is a useful tell.

So the full sequence after writing a Vault key is: `kubectl apply -f k8s/external-secret.yaml`
→ annotate `force-sync=$(date +%s)` → confirm the key's fingerprint in the K8s Secret →
confirm it again inside a pod created after that point.

**None of the four is visible from ESO status, the manifest, or the deploy banner — only
from the pod's own environment.** The only reliable check is to read the variable inside a
pod created *after* the change, and compare its fingerprint against Vault. A converged
rollout is not evidence: the heureka pod that came up on the new image still had the
variable unset, because the image was never the problem.

### The `||` chains are the real hazard, not the individual variables

Every one of these lanes reaches the shared value through a fallback chain, so "rotate the
variable" does not retire the credential — it just moves which alias supplies it. Each
migrated caller now **logs at error level whenever it falls back** to the static header, so
a lane that quietly reverts announces itself instead of degrading. That is the only reason
the heureka gap above would have been caught.

### Corrections to the category-D "unused" list — do not delete these

The brief listed four mounts as unused and safe to delete. Re-verified individually; **three
of the four are load-bearing**, and deleting them would have caused outages:

| Mount | Claim | Measured | Verdict |
| --- | --- | --- | --- |
| `marketing MARKETING_API_TOKEN` | unused | real token -> **400**, wrong -> 401, absent -> **503** | **LIVE.** Guards ~12 mutating routes (`/campaigns`, `/campaigns/:id/approve`, `/journeys`, `/segments`). Deleting it makes `requireServiceAuth` return 503 on all of them. |
| `logging JWT_TOKEN` | unused | `POST /api/logs` with it -> **201**, wrong -> 401 | **LIVE.** `log-ingest.guard.ts:95` adds it to the accepted bearer set. Deleting it breaks ingestion for every caller still presenting it. |
| `aukro JWT_TOKEN` | unused, Bearer-only, already 401 | read by `catalog-client.service.ts:93` and `warehouse-client.service.ts:24` | **REACHABLE** as the 2nd fallback behind `CATALOG_SERVICE_TOKEN` / `WAREHOUSE_SERVICE_TOKEN`. Not dead code; needs those primaries confirmed set before removal. |
| `payments JWT_TOKEN` | unused | no reference in `payments-microservice/src` | **Unused as claimed** — the only one of the four that is. |

The lesson from 6n repeats: **"unused" from a grep is a hypothesis.** Three of four failed
verification, and the two live ones were one `vault kv delete` away from a production outage.

**Dormant copies, partially corrected.** `database-credentials` and
`nginx-microservice-secret` do both still carry a `JWT_TOKEN` key that nothing consumes, but
`database-credentials` is **not** "mounted by nothing" — `aukro-service` and
`orders-microservice` both mount it for `DB_PASSWORD`. The unused thing is the key, not the
Secret; deleting the Secret would break two services' database access.

### Defects fixed in passing

- **`warehouse fulfillment-orders.service.ts:305`** was `catch {}` plus a context-free
  `logger.warn`, so a 401 on the orders sync was indistinguishable from a transport blip.
  Now logs orderId, fulfillmentOrderId, status, HTTP status and the error. This is the same
  failure mode that hid the 26-day flipflop -> warehouse outage in 6n.
- **`aukro order-client.service.ts`** sent **no credentials at all** on
  `updateOrderStatus` (`PUT /:id/status`) and `findByExternalId` (`GET /api/orders`). Both
  have been failing in production independently of this migration; both now authenticate.
  Note `PUT /:id/status` requires `internal:orders-microservice:action-admin`, which
  `internal:aukro-service:service` does not hold — so it will now return 403 rather than
  401. Widening the role or removing the call is a deliberate decision, not made here.
- **`aukro findByExternalId`** returned `null` for every error, so an auth failure read as
  "no such order". Only a 404 returns null now; everything else logs and throws.

### A second 26-day outage found while verifying the "unused" `aukro JWT_TOKEN`

Checking whether `JWT_TOKEN` was actually reachable in aukro's fallback chains meant
fingerprinting the primaries. That surfaced an unrelated live outage:

```
CATALOG_SERVICE_TOKEN    = <unset>          -> chain falls through to JWT_TOKEN (a2880693)
WAREHOUSE_SERVICE_TOKEN  fp=ca99c9bc  role=internal:warehouse-microservice:admin
                                       exp=2026-07-31  (EXPIRED, 26 days)
```

Probed from the aukro pod:

```
aukro -> catalog    Bearer a2880693  -> 401 Token validation failed
aukro -> warehouse  Bearer ca99c9bc  -> 401 Invalid token
```

`warehouse-client.service.ts` turned both into empty results — `getTotalAvailable` returned
`0`, `getStockByProduct` returned `[]`, each behind a `logger.warn`. So **every aukro offer
has read as zero stock since 2026-07-31**, and
`offer-availability-reconciliation.service.ts:124` was disabling sellable offers with reason
`warehouse_stock_unavailable` on that false zero. Identical expiry date to the flipflop ->
warehouse outage in 6n, so almost certainly the same missed rotation.

Fixed in `6d31d65`: new per-pair principal
`svc-aukro-service--warehouse-microservice@internal.alfares.cz`
(`a8f8d68f-0e16-4002-8eb7-0a8be50f6dc3`, fp `ab965b86`, 90d) with role
`internal:warehouse-microservice:readonly` — a **privilege reduction** from the expired
`admin`, since aukro only calls the two read methods. `reserve`/`unreserve`/`decrement`
exist on the client but no caller invokes them. Both stock reads return 200 with the new
token. The lookup failures now log at error level and throw; only a 404 returns empty.

**aukro -> catalog, fixed in `673273f`.** `CATALOG_SERVICE_TOKEN` was unset, so the chain
reached `a2880693`, which catalog correctly rejects. New principal
`svc-aukro-service--catalog-microservice@internal.alfares.cz`
(`f5d46205-91c2-4cfe-b057-4c23acc2d112`, fp `8443b848`, 90d), role
`internal:catalog-microservice:service`.

**This lane is a large privilege reduction.** Every route on catalog's products controller
carries `@RequireCatalogRoles('catalog:authenticated')`, and `CatalogAuthGuard` treats that
as satisfied by *any* validated non-marathon principal — so the per-pair token needs no
catalog-specific role at all. The static-header path it replaces was far broader:
`resolveInternalServiceActor()` synthesises
`roles: ['internal:catalog-microservice:admin', 'catalog:write']` for anyone presenting
`CATALOG_INTERNAL_SERVICE_TOKEN`, with the identity again taken from `x-service-name`.

**Five call sites never attached the service token at all**, so they were failing regardless
of which credential was configured: `searchProducts` (passed `undefined` on the service
path), `getProductBySku`, `createProduct`, `getProductPricing`, `getProductMedia`. All now
authenticate. This is the same class as the two unauthenticated aukro order-client calls
above — worth grepping other clients for `httpService.get(\`...\`)` with no options argument.

Two more silent failures fixed in the same file: `searchProducts` returned
`{items: [], total: 0}` on any error (a 401 was indistinguishable from a catalog with no
matches) and `getProductBySku` returned `null` for every error. Only a 404 now means
not-found.

`JWT_TOKEN` has been removed from aukro's warehouse *and* catalog chains so it can no longer
convert a missing token into a confusing 401.

**A pre-existing typecheck failure surfaced here.** `npm run typecheck` in aukro had four
`TS2451`/`TS2393` errors: `shared/clients/order-client.service.spec.ts` is a non-module
script, so its top-level `const assert`/`const of` collided in the shared tsconfig's global
scope. The chained npm script still exited 0, which is why it read as passing. Fixed with
`export {}`; the check now passes clean and was verified to fail on an introduced type
error.

**This is the third instance of the same pattern in two days** (speakasap lessons, flipflop
stock, aukro stock). The common shape is a client that returns an empty collection or a zero
on a caught HTTP error. Grepping for `return []`, `return 0`, and `return null` inside a
`catch` around an HTTP call would likely find more.

### Still open

- **`a2880693` itself is not yet retired.** Seven lanes are migrated (six to orders, plus
  aukro -> catalog), but the value is
  still mounted in the remaining category-D slots (`MARKETING_API_TOKEN`,
  `logging JWT_TOKEN`, the marketing aukro/bazos replay tokens, `runlayer`, the two dormant
  keys). It cannot be rotated until those are resolved individually.
- **`ORDER_AFFINITY_AUKRO_REPLAY_TOKEN` / `ORDER_AFFINITY_BAZOS_REPLAY_TOKEN`** still hold
  `a2880693`. They target **allegro**, not orders, and are unaffected by this work.
- **`orders' guard still trusts `x-service-name`.** The static path is intact for the
  remaining callers, so the spoofing property persists until every caller is on Bearer and
  the `configuredServices` map is deleted. That deletion is the actual fix; this session
  removed six of its inputs.
- **`invoices-microservice`, `cliplot`, `cliplot-service`** have no `applications` row, so
  the roles orders references for them can never exist. Their entries are dead config.
- **`aukro offers.service.spec.ts` is flaky** (~1 run in 5, verified over 5 runs; fails in
  the chained `npm test`, passes standalone). Pre-existing — the baseline suite reproduces
  it with this session's changes stashed. Not investigated further.

## 6r. allegro + allegro-imports -> warehouse credential repaired, 2026-08-26

Closes the 401 that 6p un-hid, and the `allegro-imports -> warehouse` 401 that Phase 2
had been carrying as "pre-existing". Both lanes were broken for different reasons.

### Root cause: two separate faults, neither visible

**allegro-service** held `WAREHOUSE_INTERNAL_SERVICE_TOKEN` (fp `3f3235bd`) — decoded
in-pod, claims only:

```
alg=HS256   exp=2026-08-02  expired=true   (24 days dead)
roles=["internal:allegro-service:service"]
```

Two independent problems in one token: **HS256** (warehouse validates via auth, which
retired HS256 on 2026-08-18) and **expired**. And even unexpired it would still have
failed — `internal:allegro-service:service` is not in `WAREHOUSE_READ_ROLES`, so the
role was wrong from the start. Its fallback, `JWT_TOKEN` (fp `aa7ae49e`), is the
deactivated shared `369e4f3c` identity — also rejected.

**allegro-imports** was worse: **no warehouse credential at all.** Its only token was
the shared `JWT_TOKEN`. `k8s/imports-deployment.yaml` never mapped
`WAREHOUSE_INTERNAL_SERVICE_TOKEN`, though `import.service.ts:104` calls `setStock`.
Its ES already published the key — the Deployment simply never consumed it. That is
the third variant of the "key never reaches the pod" trap: not a Vault gap, not an ES
mapping gap, but a **Deployment env gap**, and ESO reports `SecretSynced` throughout.

### Why the WRITE tier

allegro is not a read-only consumer of warehouse. Live call sites:

```
read    getTotalAvailable        x3   (availability-reconciliation, offers, catalog-sell-action)
read    getDefaultWarehouseId    x1   (offers)
WRITE   setStock                 x3   (inventory, offers, imports/import.service.ts:104)
```

So the lane needs `internal:warehouse-microservice:action-admin` (WRITE), not
`readonly`. It still cannot create/delete warehouses — that stays `WAREHOUSE_ADMIN_ROLES`.
Owner approved the tier and the imports scope before anything was minted.

### What was done

Followed the Phase 1 runbook (probe before storing; never print a token).

1. **Principal.** Reused the existing per-pair convention Session A established for the
   orders lane (`svc-<caller>--<callee>@internal.alfares.cz`):
   `svc-allegro-service--warehouse-microservice@internal.alfares.cz`
   (`a0fbbad6-a546-4856-a79f-bcd1c6d8fca3`), RS256, 90d, role
   `internal:warehouse-microservice:action-admin`.

   Note the pre-existing principal `allegro-service@internal.alfares`
   (`b4907676…`, the `sub` of the dead token) was **left alone** — it carries only
   `internal:allegro-service:service`, which the Allegro fulfillment callbacks use. It
   is a different lane and adding warehouse rights to it would have widened it.

2. **Probed before storing.** `/auth/validate` -> `valid=true`, roles as minted, `sub`
   matching the new principal; then the real endpoints `GET /api/warehouses` -> 200 and
   `POST /api/stock/availability/batch` -> 201. Only then did anything reach Vault.

3. **Vault** `secret/prod/allegro-service#WAREHOUSE_INTERNAL_SERVICE_TOKEN` patched in
   place (piped, never through stdout), so the existing ES mapping and env key needed no
   change for allegro-service. Fingerprint-compared Vault vs minted vs mounted at every
   step.

4. **imports Deployment** (`798253a`) — added the missing
   `WAREHOUSE_INTERNAL_SERVICE_TOKEN` mapping from the same `allegro-service-secret`, so
   both deployments present the one per-pair principal.

5. Force-synced the ES, restarted both under the deploy lock.

### Verified live, through the deployed client

```
                              before                     after
allegro-service getWarehouses()   THREW 401          -> 200, 5 rows
allegro-service getDefaultWarehouseId()  THREW 401   -> c0de0000-…-000000000013
allegro-service getTotalAvailable()      THREW 401   -> 0 (clean miss, no throw)
allegro-service POST /api/stock/set      401         -> 400 reasonCode required (authorized)
allegro-imports GET /api/warehouses      401         -> 200, 5 rows
allegro-imports POST /api/stock/set      401         -> 201 (authorized, write works)
```

Both pods mount fp `d53ea213`, len 881. Both 1/1, 0 restarts, zero warehouse auth errors
in the logs. Warehouse's own log now shows allegro issuing **real authenticated
`/api/stock/{id}/total` reads in production traffic** — the strongest evidence that the
lane is genuinely restored rather than only responding to probes. The `stock_movements`
audit row for the write probe recorded `createdBy=service:allegro-service`, confirming
warehouse resolves the new principal to the right identity.

**Probe rows were removed** (`stock` and `stock_movements`, both matched on the probe's
own id + zero quantity) and the token file was deleted from the auth pod.

### Two traps worth recording

**1. `kubectl exec … cat` adds a trailing newline to a Vault secret.** The first write
stored the token with `\n`, so the mounted value fingerprinted `a2794069` instead of
`d53ea213`. Warehouse accepted it anyway (both 200) and the clients `.trim()`, so
nothing would have failed — but any future byte-comparison against the minted token
would have looked like a mismatch and sent someone hunting a non-existent rotation bug.
Rewritten via `tr -d '\n'`. **Pipe through `tr -d '\n'` when storing a token this way.**

**2. A fingerprint read during a rollout is not the pod's value.** Reading the env of a
pod that was mid-replacement returned the old `3f3235bd`, then the newline variant, then
the correct value — three different answers in a minute. Resolve the pod name *after*
`wait-for-rollout.sh` reports converged, then fingerprint.

## 6u. Header-chosen identity closed on orders, 2026-08-26

The defect described in 6q is fixed in production (`2964d50`). `a2880693` can no longer
authenticate as anything against orders.

### Before and after, measured from the aukro pod

Same value, ten different `x-service-name` values, against
`GET /api/orders/internal/order-affinity/replay-candidates`:

| `x-service-name` | before | after |
| --- | --- | --- |
| `marketing-microservice` | **200 + live order data** | **401** |
| `warehouse-microservice` | 403 (authenticated) | **401** |
| `payments-microservice` | 403 (authenticated) | **401** |
| `aukro-service` | 403 (authenticated) | **401** |
| `bazos-service` | 403 (authenticated) | **401** |
| `heureka-service` | 403 (authenticated) | **401** |
| catalog / flipflop / allegro / cliplot | 401 | **401** |

403-not-401 was the proof the credential was accepted; every row is now 401.

### What changed

1. **Six entries removed from `configuredServices`** — aukro, bazos, heureka, marketing,
   payments, warehouse. All six reach orders on per-pair RS256 principals (6q), verified
   live with six distinct fingerprints and **zero static-fallback warnings in production**
   over the preceding two hours. The loud fallback added in 6q is what made that assertion
   checkable rather than assumed.

2. **A runtime ambiguity check.** Removing the six entries fixes today's instance; it does
   not stop the next one. The guard now refuses any value configured for more than one
   caller instead of choosing between them:

   ```
   const namesSharingToken = Object.entries(configuredServices)
     .filter(([, c]) => c.token && this.safeEqual(providedToken, c.token))
     .map(([name]) => name);
   if (namesSharingToken.length > 1) { /* log names only, deny */ }
   ```

   Deny, not pick — an ambiguous credential must never authenticate. It logs caller names
   only, never any part of the presented value.

3. **`cliplot-service` alias dropped.** It resolved the same env vars as `cliplot`, so the
   pair shared a value and the new check would deny both. The live pod sends
   `x-service-name: cliplot`.

4. **Four inbound-only ExternalSecret entries removed from orders** (aukro, bazos, heureka,
   marketing), each of which mapped `secret/prod/<svc>#JWT_TOKEN` — the shared value.
   `PAYMENTS_` and `WAREHOUSE_INTERNAL_SERVICE_TOKEN` were **kept**: both are also read
   outbound by `warehouse-reservation.client.ts:275`, so removing them would have broken an
   unrelated lane.

### Verification, and confirming it fails when it should

New `scripts/verify-internal-service-identity.js` (wired into `npm test`) asserts:
the six migrated callers are absent from the static map; a value shared by two callers
authenticates as **neither**; a value unique to one caller still works; and that value
cannot claim another caller's name. **Confirmed to fail** when the ambiguity check is
disabled (`Missing expected rejection: a value shared by two callers must not authenticate
as catalog-microservice`).

Two existing contract scripts asserted the *old* static path and would have failed silently
into a "fix the test" reflex: `verify-create-order-contract.js` required aukro/bazos/heureka
to be present in the guard, and `verify-order-affinity-replay-contract.js` required
`guard.includes('MARKETING_INTERNAL_SERVICE_TOKEN')`. Both now assert the opposite — that
those callers are **absent** from the static map and that the ambiguity check exists.

### Still on the static path — and a blocker

`catalog-microservice`, `flipflop-service`, `allegro-service`, `invoices-microservice` and
`cliplot` still authenticate by string comparison, each with a **distinct** value
(`5f420714`, `321c86c8`, `aa7ae49e`, `34e68a52`, `f5a28e51`). The ambiguity check makes that
safe, but it is not per-pair identity.

**`invoices-microservice` and `cliplot` have no `applications` row in the auth DB**, so the
roles the guard grants them cannot be issued as real principals. Those applications must be
seeded before either lane can move to Bearer.

## 6v. Correction: the aukro/bazos replay lanes are live, not dead

Recorded because the reasoning error is more useful than the fix.

I removed `ORDER_AFFINITY_AUKRO_REPLAY_TOKEN` and `ORDER_AFFINITY_BAZOS_REPLAY_TOKEN` from
marketing's ExternalSecret (`95ed557`), on the evidence that both hold `a2880693` and both
returned **401** when probed. That probe was wrong: it pointed at **allegro's**
`/internal/allegro/order-affinity/replay-candidates`, because 6j had described this family
of vars as an allegro-bound lane. But `orderAffinityMarketplaceReplayHeadersForSource`
dispatches on `sourceOwner`, and the aukro and bazos sources target **their own** services:

```
aukro  -> aukro-service:3700/internal/aukro/order-affinity/replay-candidates  -> 200
bazos  -> bazos-service:3900/internal/bazos/order-affinity/replay-candidates  -> 200
```

Both were live and working on the shared value. Reverted in `a58d4d7` before the change
reached a pod in a way that stuck; both lanes re-verified at **200** afterwards.

The generalisable mistake: **a 401 only means "this credential is wrong for the endpoint you
asked", and I had asked the wrong endpoint.** A dead-lane claim needs the caller's own
resolved target, not a target inherited from a neighbouring var's documentation. The same
error would have been caught earlier by reading the dispatch function before the probe
rather than after.

Note the asymmetry this leaves: `aukro-service` and `bazos-service` each *receive* on
`a2880693` (`assertMarketingService` compares against `AUKRO_/BAZOS_INTERNAL_SERVICE_TOKEN`)
while *sending* to orders on a per-pair RS256 principal. Retiring the value therefore
requires migrating these two inbound guards too — they are the reason the four
`*_INTERNAL_SERVICE_TOKEN` mounts in aukro/bazos cannot simply be deleted.

## 6w. `a2880693` census after this session

17 live mount points remain (orders lost 4; nothing else was safely removable):

| Holder | Status |
| --- | --- |
| `aukro-service#AUKRO_INTERNAL_SERVICE_TOKEN` | **live inbound** — marketing replay receiver |
| `bazos-service#BAZOS_INTERNAL_SERVICE_TOKEN` | **live inbound** — marketing replay receiver |
| `marketing#ORDER_AFFINITY_AUKRO_REPLAY_TOKEN` | **live outbound** — 200 to aukro |
| `marketing#ORDER_AFFINITY_BAZOS_REPLAY_TOKEN` | **live outbound** — 200 to bazos |
| `marketing#MARKETING_API_TOKEN` | **live** — guards ~12 mutating routes (6q) |
| `logging-microservice#JWT_TOKEN` | **live** — accepted bearer for log ingest (6q) |
| `orders#PAYMENTS_INTERNAL_SERVICE_TOKEN` | **live outbound** — orders -> payments |
| `orders#WAREHOUSE_INTERNAL_SERVICE_TOKEN` | **live outbound** — warehouse reservation client |
| `payments#PAYMENTS_ORDERS_SERVICE_TOKEN` | now unreachable (orders rejects it); kept as the caller's cutover fallback |
| `aukro#JWT_TOKEN`, `bazos#JWT_TOKEN`, `heureka#JWT_TOKEN`, `payments#JWT_TOKEN`, `warehouse#JWT_TOKEN` | source property behind several of the above |
| `runlayer-secret#JWT_TOKEN` | **unused** — no reference in `runlayer/src`; Session B's repo, not touched |
| `database-credentials#JWT_TOKEN` | **unused** — the Secret is mounted by three services, but only for `DB_PASSWORD` |
| `nginx-microservice-secret#JWT_TOKEN` | **unused** — whole Secret mounted by nothing |

**The two dormant ExternalSecrets have no manifest in any repo** — they exist only in the
cluster. Editing them in place would create exactly the untracked drift recorded in 6o and
2c, so they were left alone. They should be brought under `k8s-manifests` (deny-listed,
manual) before their `JWT_TOKEN` keys are deleted.

**The value cannot be rotated yet.** It is still a working shared password on the four
replay mount points, marketing's API, and logging ingest. Retiring it needs, in order:
aukro's and bazos's inbound replay guards moved to per-pair principals; `MARKETING_API_TOKEN`
given its own credential; logging's accepted-bearer set narrowed to `LOG_INGEST_BEARER_TOKENS`;
then the three unused keys deleted and the value rotated.

## 6x. Sessions A and B completed, 2026-08-27

Executed with subagent-driven development: four tasks, each dispatched to a fresh subagent,
each reviewed before completion. Ledger and per-task reports in the session workspace.

### A third stock outage, same shape as the first two

`bazos -> warehouse` was returning **401** in production. Cause:
`secret/prod/bazos-service#WAREHOUSE_SERVICE_TOKEN` held an **HS256** token
(`sub=bazos-service`, `roles=[internal:warehouse-microservice:admin]`, exp 2026-12-26) —
unexpired, but structurally obsolete since warehouse stopped accepting HS256 (blocker 6d/6f).
`warehouse-client.service.ts` masked it: `getTotalAvailable` returned `0`,
`getStockByProduct` returned `[]`, both behind a `logger.warn`, so every product read as
out-of-stock and nothing surfaced the failure.

Replaced with `svc-bazos-service--warehouse-microservice`
(`3bae81d8-0ac0-4ed6-a28d-efe03a20f103`, RS256, 90d, fp `2e3c7ec0`), role
`internal:warehouse-microservice:readonly` — a **privilege reduction** from `admin`: only
`getStockByProduct` and `getTotalAvailable` have callers; `reserveStock`, `unreserveStock`
and `decrementStock` have none. Verified live from the deployed pod: **401 -> 200**.

That is three outages now with one shape — flipflop (26 days), aukro (26 days), bazos.
**The common tell is an empty collection or a zero returned from inside a `catch` around an
HTTP call.** It is worth grepping for that pattern periodically rather than waiting for the
next one.

### The silent-failure sweep (commits `833494f`, `6e680fb`, `ec5518e`)

16 candidate sites across `bazos/shared/clients` and `heureka/shared/clients` were traced to
their callers. **8 fixed, 8 deliberately left** — the judgement matters as much as the fix:

- **Fixed** where an auth/transport failure was indistinguishable from a legitimately empty
  result *and a caller acts on the answer*: stock, pricing, catalog search, order lookup.
  Only a 404 now returns empty; everything else logs at error level with full context
  (subject, httpStatus, error) and throws.
- **Left** where the lookup is genuinely optional enrichment whose absence is expected and
  already handled — product media, quality-review (which has its own `unavailable` flag),
  dashboard labels. **Making those throw would itself be a defect.**

Every fixed site's callers were traced: `feed.service.ts` and `offers.service.ts` wrap them
in per-product `try/catch` that logs and continues; controller-level callers surface the
throw as an HTTP error, which is the intended behaviour. No caller was left unable to cope.

bazos: 164 tests green, confirmed to fail on revert (6 failures — 401/500 resolving instead
of rejecting). heureka has no test runner, so its four fixes carry caller-trace verification
instead of automated tests — recorded as a known gap, not an oversight.

### Untracked drift eliminated: `flipflop-warehouse-token`

`flipflop-product-service` carried a named `env[]` override pointing `WAREHOUSE_SERVICE_TOKEN`
at a hand-created Secret with no ExternalSecret, no owner references, and no manifest in the
repo. A Vault rotation reached its four siblings and missed this pod; deploying from the repo
did not clear it, because a deploy patches images and does not replace the pod spec.

Removed in the correct order, each step verified before the next:

1. fingerprints compared first — override `59415e97` == ESO `59415e97`, neither empty, so the
   removal was behaviourally neutral (the override was *redundant*, not stale, at that moment)
2. `env[2]` removed from the live Deployment; rollout converged
3. the new pod's `WAREHOUSE_SERVICE_TOKEN` fingerprinted **inside the pod** as `59415e97` via
   `envFrom` — verified by fingerprint, not by assuming
4. `flipflop -> warehouse` probed **200** from inside that pod
5. only then, with 0 workloads still referencing it, the orphan Secret was deleted

All six flipflop deployments 1/1 afterwards. ESO is now the single source for that key.

### `suppliers-microservice` is NOT the same cleanup — do not remove its override

Session B's prompt asks whether suppliers has the same pattern. It has the same *shape*
(`CATALOG_SERVICE_TOKEN` and `WAREHOUSE_SERVICE_TOKEN` both pointing at a hand-created
`stock-traceability-runtime-token`) but the opposite *risk profile*:

**There is no ESO or Vault source for either key.** `suppliers-microservice-secret` carries
only `DB_PASSWORD`, `JWT_SECRET` and the three `PAYMENT_*` keys, and
`secret/prod/suppliers-microservice` has no such property (both verified directly). Nothing
in the ecosystem fingerprint-matches `c5817dbb`.

So removing the override would leave both variables **unset**, and the service throws
`ServiceUnavailableException` with no fallback — it would *cause* an outage rather than fix
drift. Closing it properly means minting two per-pair principals and adding ES entries first.
That is a provisioning task, deliberately not done here.

### `a2880693`: three more sources retired

| Path | Evidence it was dead |
| --- | --- |
| `secret/prod/nginx-microservice#JWT_TOKEN` | service is **retired** (`nginx-microservice.retired-20260617.tar.gz`), no workload in `statex-apps` at all |
| `secret/prod/database-server#JWT_TOKEN` | Secret is mounted by aukro, bazos and orders — but **only for `DB_PASSWORD`**; no code reads a `JWT_TOKEN` from it |
| `secret/prod/runlayer#JWT_TOKEN` | no reference anywhere in `runlayer/src` or `runlayer/scripts` (commit `9b599c0`) |

Vault sources of the shared value: **10 -> 7**.

**A mechanism worth knowing: ESO does not prune.** Deleting only the Vault property leaves
the key sitting in the K8s Secret — external-secrets adds and updates keys but never removes
one whose source disappeared. Removing the ExternalSecret's `data` entry *does* prune it
(confirmed on runlayer: the key vanished from `runlayer-secret` after the entry was removed).
This is why the two dormant copies still show `JWT_TOKEN` in their Secrets even though their
Vault properties are now gone — and why they cannot be finished without first bringing those
two in-cluster-only ExternalSecrets under `k8s-manifests`.

### `invoices-microservice` and `cliplot` seeded in the auth DB

Both were referenced by `orders-microservice`'s legacy static-header path but had **no
`applications` row**, so their roles could never be issued as real principals. Seeded one
application + one `internal:<app>:service` role each, matching the `marketing-microservice`
row shape, in a single transaction. Both `domain` values were verified against live Ingress
hosts before the write rather than taken from convention.

`cliplot-service` was deliberately **not** seeded: the live pod sends
`x-service-name: cliplot`, and the alias was removed from the guard in 6u, so the row would
be a dangling unreachable principal.

`provision-service-token --check-db-only` now returns `applicationFound: true,
roleFound: true` for both. Their lanes can move to Bearer whenever someone picks that up.

### Operational note: an etcd stall halted all secret syncing mid-session

For ~30 minutes, `kubectl get --raw /readyz` reported `[-]etcd failed`, every ExternalSecret
stopped reconciling (`refreshTime` frozen), Deployments showed empty `readyReplicas` despite
ready pods, and new pods sat `Pending` with `FailedScheduling: Bind plugin timeout`.

**It was not a Kubernetes fault.** `sda` was at 97.9% utilisation with ~848 reads/sec and
35-41 processes in uninterruptible sleep; the blocked processes were GNOME's
`tracker-extract-3` (indexing `/home/ssf`) and `whoopsie-upload-all`. etcd could not fsync,
so the API server went unhealthy and starved every controller. Load peaked at 48.

It cleared on its own once those desktop jobs finished, and ESO resumed with no intervention.
**Nothing was force-deleted and nothing was restarted** — the right move here was to wait,
not to escalate. Worth remembering that a "broken cluster" on this single-node host can be a
desktop indexer competing with etcd for the root disk.

## 6y. Outages four and five, found by auditing beyond the prompts' scope

Sessions A and B were scoped to specific lanes. After completing both, a full sweep of every
JWT-shaped key in `statex-apps` found **two more live 401s neither prompt covered**. Both are
now fixed and verified from the deployed pods.

The sweep itself is the reusable part:

```
total JWT-shaped keys: 55     RS256: 22     HS256: 33     expired: 6
distinct HS256 values: 13 across 33 mount points
```

**The migration is roughly 40% done, not finished.** Sessions C-G (prompts in
`auth-microservice/docs/SESSION_[C-G]_PROMPT.md`) partition the remainder by repo ownership.

### Outage 4: orders -> warehouse, dead 27 days

```
orders pod effective WAREHOUSE_SERVICE_TOKEN  fp=222d57a5  HS256  exp 2026-07-31
GET warehouse-microservice:3201/api/stock/<id>/total  ->  401 Invalid token
```

Both expired *and* structurally obsolete — HS256, which warehouse stopped accepting in 6d/6f.
Consumers are `warehouse-reservation.client.ts:275` and
`order-fulfillment-handoff.client.ts:257`, both resolving
`WAREHOUSE_SERVICE_TOKEN || WAREHOUSE_INTERNAL_SERVICE_TOKEN` — and **the fallback holds
`a2880693`**, so clearing the primary would not have failed loudly either. Two dead
credentials in one chain.

Fixed with `svc-orders-microservice--warehouse-microservice`
(`28687a0d-2e86-450c-bbb7-03307a9b228a`, RS256, 90d, fp `d2b2828d`).

**Role choice — `action-admin`, and why not less.** Orders both reads and writes here:
`GET /api/reservations/order/:id`, `POST /api/reservations/reserve`,
`POST /api/fulfillment-orders`. `FULFILLMENT_WRITE_ROLES` accepts
`internal:orders-microservice:service`, but `WAREHOUSE_WRITE_ROLES` (which guards
`/reservations/reserve`) does **not** — it requires `admin` or `action-admin`. So a single
principal covering both routes needs `action-admin`. Still a reduction from the `admin` the
old token carried, but not the `readonly` that fitted aukro and bazos: **read the routes,
don't reuse the previous lane's answer.**

Probed before Vault: `/auth/validate` 201, read 200, and both writes **400** on an empty body
— DTO validation rejecting after authorization passed, so nothing mutated.

### Outage 5: flipflop -> orders admin status action, dead 22 days

```
ORDERS_STATUS_SERVICE_TOKEN  fp=1dc28737  HS256  exp 2026-08-05
POST orders:3203/api/admin/operations/actions/order-status  ->  401 Invalid token
```

Recorded as broken in 6n and never fixed. The client was already correct —
`getStatusActionHeaders()` sends `Authorization: Bearer` and throws when the var is missing —
only the credential was dead.

Fixed with `svc-flipflop-service--orders-microservice-status`
(`52533169-9314-46b6-ab4f-bef04e19ba27`, RS256, 90d, fp `44a44139`), role
`internal:orders-microservice:action-admin`.

**A trap worth naming: the obvious route was the wrong one.** `ORDERS_STATUS_SERVICE_TOKEN`
sounds like `PUT /api/orders/:id/status`, and probing that route would have produced a
misleading result. The call site (`order-client.service.ts:197`) actually targets
`POST /api/admin/operations/actions/order-status`, guarded by `ADMIN_ACTION_ROLES` =
`[global:superadmin, internal:orders-microservice:action-admin]`. Reading the call site, not
the variable name, is what set the role correctly — the old token carried **both** `admin`
and `action-admin`, and only the latter is needed, so this is a privilege reduction too.

### Both verified end to end

| Lane | Before | After | fp at all four hops |
| --- | --- | --- | --- |
| orders -> warehouse | 401 Invalid token | **200** | `d2b2828d` |
| flipflop -> orders status | 401 Invalid token | **400** (authorized) | `44a44139` |

Fingerprints matched minted = Vault = K8s Secret = pod, each confirmed in a pod created
*after* the change.

### What the sweep found that is still open

- **6 expired tokens.** Two were these outages. `heureka#WAREHOUSE_SERVICE_TOKEN`
  (`82466f79`, exp 2026-07-29) sits in the Secret but the pod mounts a *working* value
  (`beab1836`) — **expiry in a Secret is not proof of breakage; only the pod's effective
  token counts.** The remaining three are the two monitoring smoke tokens (empty `roles`) and
  `stock-traceability-runtime-token`.
- **`stock-traceability-runtime-token` carries `global:superadmin`**, expired 2026-06-24,
  hand-created, no ExternalSecret, and is mounted by suppliers for *two* consumer names. It is
  the widest-privilege credential in the inventory. Session G.
- **One `JWT_SECRET` across 13 pods** (4 distinct values over 21 mounts). No service still
  verifies HS256 locally, so it is not currently forgeable against them — but it is the
  substrate the whole migration exists to remove. Session G.
- **`aa7ae49e` is over-shared but NOT spoofable**: presented at orders under four different
  `x-service-name` values it authenticates only as `allegro-service` (400; the rest 401). The
  6u ambiguity check holds. Session E.

## 7. Progress

- [x] Phase 0 — logging, script, Dockerfile (`eb03ddb`, live)
- [x] Phase 0b — standard revised, scripts consolidated
- [x] Phase 1 — catalog → warehouse pilot **(complete 2026-08-25, monitor 11/11 green)**
- [x] Phase 1a — role model **complete across all services**: warehouse (`a8f76d0`+`c4f5427`), payments/notifications/suppliers (`4e0dd54`), orders (`8093657`), logging (`a50e9dd`+`9ffb9f0`), backups (`a0d1e9f`), monitoring (`39fbc3e`) — all deployed and verified live
- [x] Blocker 6d — local HS256 verification removed from allegro/heureka/aukro **(2026-08-26, forgery rejected in all 7 live pods)**
- [x] ai-microservice HS256 window closed (`ALLOW_HS256_FALLBACK=false`, 2026-08-26) — see 6g
- [x] flipflop → ai-microservice lane repaired (`ae924f0`, 2026-08-26) — **401 → 200 verified in both live pods**; five AI features restored, one shared `AiClientService` holds the credential — see 6p
- [x] Silent-failure cleanup: notifications orchestrator client (`fa591b5`), allegro (`e814c43`) and heureka (`09497a6`) warehouse clients — 404 is the only "no rows"; every other status logs and re-throws — see 6p
- [x] runlayer stopped mounting the shared `a2880693` (`6fd27fa`, 2026-08-26); operator scripts mark the fallback deprecated — see 6p
- [x] `flipflop-warehouse-token` override removal — **DONE and verified live 2026-08-27 (6x)**: env[2] removed, new pod resolves the key via `envFrom` at fp `59415e97`, flipflop -> warehouse probed 200 from inside that pod, orphan Secret deleted, all 6 flipflop deployments 1/1
- [ ] `suppliers-microservice` `stock-traceability-runtime-token` — **DO NOT remove the override.** Re-confirmed 2026-08-27 (6x): neither key exists in the ESO secret *or* in `secret/prod/suppliers-microservice`, so removal leaves both unset and the service throws with no fallback. Needs two per-pair principals + ES entries provisioned FIRST. Top follow-up.
- [x] `aukro` / `bazos` warehouse clients — **DONE.** aukro fixed 2026-08-26; bazos fixed 2026-08-27 (`833494f`) after finding its lane 401 on an obsolete HS256 token — replaced with a per-pair RS256 `readonly` principal, **401 -> 200 verified live**. Catalog/order clients in bazos + heureka swept too (`6e680fb`, `ec5518e`): 8 sites fixed, 8 left benign with reasons — see 6x
- [x] **allegro + allegro-imports -> warehouse repaired** (2026-08-26) — per-pair RS256 principal, `401 -> 200` verified through the deployed client in both pods; closes the `allegro-imports` 401 carried under Phase 2 — see 6r
- [ ] docs-rag-microservice — needs `JWT_PUBLIC_KEY` before its flag can close
- [~] Phase 2 — split `369e4f3c…` — re-scoped (6h). **allegro->orders live (6i)**, **marketing->orders staged (6j)**, **`369e4f3c…` deactivated (6k)**; remaining: allegro-imports->warehouse (401 in prod, pre-existing) and marketing->allegro replay lane
- [ ] Phase 3 — category A remainder
- [ ] Phase 4 — category C
- [~] Phase 5 — category D — **header-chosen identity CLOSED on orders (6u)**: the shared
  value now returns 401 for every `x-service-name`, and the guard denies any credential
  configured for more than one caller. Seven lanes on per-pair RS256 (6q): aukro, bazos, heureka,
  warehouse, payments migrated to per-pair RS256; marketing already live from 6j. The value
  itself is NOT yet retired. Vault sources 10 -> 7 on 2026-08-27 (6x): nginx-microservice
  (retired service), database-server (only DB_PASSWORD is consumed) and runlayer (`9b599c0`,
  no code reads it) removed. The remaining 7 are all load-bearing: the aukro/bazos replay
  receivers, `MARKETING_API_TOKEN` (~12 mutating routes), `logging JWT_TOKEN` (ingest), and
  the outbound orders lanes. **3 of the 4 "unused" mounts in the brief were verified
  load-bearing — do not delete them.** Note ESO does not prune: removing a Vault property
  leaves the key in the K8s Secret; the ExternalSecret `data` entry must go too (6x).
- [x] `invoices-microservice` and `cliplot` seeded in the auth DB (2026-08-27, 6x) — both
  lacked an `applications` row, so the roles orders grants them could never be issued.
  `cliplot-service` deliberately not seeded. Both now pass `--check-db-only`.
- [x] **Outages 4 and 5 fixed 2026-08-27 (6y)** — orders -> warehouse (401, 27 days) and
  flipflop -> orders admin status (401, 22 days), both found by a full sweep AFTER Sessions
  A/B completed. Both on per-pair RS256 with reduced privilege; verified 200/400 from the
  deployed pods.
- [x] **Session F complete 2026-08-27 (6z)** — all 19 `a2880693` mounts in
  `marketing`, `logging`, `aukro`, `heureka`, `payments` retired; Vault sources 7 -> 2.
  Census was 3 short: deployment `env` aliases and a second `secretKey` on the same
  property are mounts too. Replay lanes moved atomically (sender and receiver read one
  shared Vault property) with no code change. Found a 7th outage (`heureka -> catalog`
  401, pre-existing, **Session E** to mint) and an 8th unrelated one (ingest dropping
  every `speakasap` + `prompts-microservice` log line, 25k rejects/48h). **The value
  still cannot be rotated: 3 mounts remain — 2 in `orders` (Session C) and 1 in
  `warehouse` (Session G).**
- [ ] **Sessions C-G cover the remaining ~60%** — see `SESSION_[C-G]_PROMPT.md`. Measured
  baseline 2026-08-27: 55 JWT-shaped keys, 22 RS256 / 33 HS256, 13 distinct HS256 values over
  33 mounts, 4 still shared across services, 6 expired, one JWT_SECRET across 13 pods.
- [x] **Session C complete 2026-08-27 (6aa)** — orders/monitoring. Item 1 (orders -> warehouse)
  was already fixed in 6y; re-verified live (200, fp `d2b2828d`) rather than redone. Rotated
  `monitoring#LOGGING_READ_SERVICE_TOKEN` onto a per-pair RS256 principal (fp `267cfd5b`,
  exp 2026-09-24 -> 2026-11-25) and found it was already failing on a trailing newline that
  axios rejects before sending — call site now trims. Removed both `MONITORING_SMOKE_*` tokens
  (ES entries + Vault properties, keys confirmed pruned from the Secret): their payloads carry
  `type:end_user` and the `task004-auth-mqf81ns9-d5c5db` run id, so they were smoke-run
  artifacts, not principals. Fixed the masking behind outage 4 — four bare `catch {` in the
  orders warehouse clients now log at error level with orderId/url/httpStatus (`32cc0aa`),
  proven to fail on revert.
- [ ] **`warehouseHandoff.failureCode` is written but never read** (found in 6aa) — orders
  persists `status:'failed'` on the order and no caller branches on it, so an order still
  proceeds to paid/fulfilled with a failed warehouse handoff. Logging now surfaces it; making
  the system act on it is a product decision.
- [ ] **Deploy-queue worker can stall silently** (found in 6aa) — after an unrelated failed
  deploy the unit hit `start-limit-hit`, and `queuectl.sh status` listed queued services while
  the worker logged "queue empty". Cleared with `systemctl reset-failed` + `start`, no
  reinstall. A stalled queue means a commit does not deploy and nothing says so.
- [ ] Phase 6 — rotation CronJob **(Session G)** — five credentials have now expired unnoticed
  and caused outages; every fix so far has been manual. Build the alerting that would have
  caught all five.

## 6z. Session D — flipflop and cliplot, 2026-08-27

Scope: `flipflop/` and `cliplot/`. Nothing in `orders-microservice/` or
`marketing-microservice/` was edited; findings for those are handed over below.

### 1. flipflop -> orders status: the credential was already fixed, the pods were not

The prompt described `ORDERS_STATUS_SERVICE_TOKEN` as the dead HS256 `1dc28737`
(exp 2026-08-05). That is **no longer what Vault holds.** Measured at the start of this
session:

| Hop | Value |
| --- | --- |
| Vault `secret/prod/flipflop-service#ORDERS_STATUS_SERVICE_TOKEN` | `44a44139` |
| K8s `flipflop-service-secret#ORDERS_STATUS_SERVICE_TOKEN` | `44a44139` |
| inside `flipflop-order-service` pod | `44a44139` |
| inside `user` / `cart` / `product` pods | **`1dc28737`** (the dead one) |
| inside `flipflop-frontend` pod | `e3b0c442` = sha256 of empty string, i.e. **unset** |

`44a44139` is RS256, `kid=a975635403084850`, principal
`svc-flipflop-service--orders-microservice-status@internal.alfares.cz`, role
`internal:orders-microservice:action-admin` — already correct and already least-privilege.

So this was **not** a credential problem and no new token was minted for it. Hops one
through three were already consistent; only hop four was stale. `flipflop-order-service`
had been recreated 2026-08-27 and picked the new value up; its three siblings were last
started 2026-08-26, before the rotation, and were still holding the expired value in
their process environment. **An env var is read once at process start — a Vault rotation
does not reach a pod that never restarts.**

Both sides were measured rather than assumed, from inside the pods:

```
stale pod  (user-service,  fp=1dc28737)  PUT /api/orders/<nonexistent>/status -> 401 Invalid token
fresh pod  (order-service, fp=44a44139)  PUT /api/orders/<nonexistent>/status -> 404 Order not found
```

**404 is the authorized answer here** — the role check passed and the id genuinely does not
exist. 401 is the failure.

**Fix applied:** `kubectl rollout restart` on `flipflop-user-service`,
`flipflop-cart-service` and `flipflop-product-service`, through
`shared/scripts/with-deploy-lock.sh` (the lock was held by `cv-tuning` when this session
started; the restart waited for it to clear). Converged via
`shared/scripts/wait-for-rollout.sh`.

**Verified after the change**, in pods created by the restart:

| Pod (created 11:19:27Z) | fp inside pod | `PUT /:id/status` |
| --- | --- | --- |
| `flipflop-user-service-6df655b8d4-9ht7f` | `44a44139` | **404** (was 401) |
| `flipflop-cart-service-79447dfcc5-dsv22` | `44a44139` | — |
| `flipflop-product-service-58748fb7f4-r42vr` | `44a44139` | — |

All six flipflop deployments 1/1 afterwards, zero restarts.

**`flipflop-frontend` mounts this key empty and is deliberately left alone** — it has no
orders-status call site, and the shared `envFrom` is why it mounts the key at all.

**The generalisable point:** a four-hop fingerprint check that stops at the K8s Secret
would have declared this lane healthy. Three of five pods were failing in production while
Vault, the ExternalSecret and the Secret all read correct. **Hop four must be measured in
every pod that mounts the key, not one.**

**Re-verified 2026-08-31** after an unrelated ecosystem-wide redeploy replaced every pod.
All four token-using pods measured together, fingerprint and live call in one step:

| Pod | fp inside pod | `PUT /:id/status` |
| --- | --- | --- |
| `flipflop-order-service-7999cb4594-dq5kq` | `44a44139` | **404** |
| `flipflop-user-service-65b5dc7f8b-w7gwq` | `44a44139` | **404** |
| `flipflop-cart-service-64988fbb4f-68vhz` | `44a44139` | **404** |
| `flipflop-product-service-7df9f8f6c5-dgtkk` | `44a44139` | **404** |

The lane is healthy and has stayed healthy across a full pod replacement.

### 2. `9431f75c` — one value, three jobs: prepared, deliberately not executed

Confirmed exactly as described. `FLIPFLOP_INTERNAL_SERVICE_SECRET` and `JWT_TOKEN` both
map to Vault property `JWT_TOKEN` (`flipflop/k8s/external-secret.yaml:76-83`), and
`marketing-microservice-secret#ORDER_AFFINITY_FLIPFLOP_REPLAY_TOKEN` holds a third copy.

Two things worth recording that change how this should be fixed:

- **The value is used as an opaque shared string, not as a JWT.** Both flipflop consumers
  (`assertInternalServiceKey`, `assertAffinityReplayAccess` in
  `services/order-service/src/orders/orders.service.ts`) do a constant string comparison
  against the env var; the `x-flipflop-internal-key` header is never parsed or verified as
  a token. Its `roles:['internal:warehouse-microservice:admin']` payload is therefore
  **inert here** — alarming to read, but not an active grant on this path. It would only
  become one if this value were ever presented as a Bearer token to warehouse.
- **The fail-open guard reported in 6n is already fixed.** `assertInternalServiceKey` now
  reads `if (!expected) { log.error(...); throw }` and no longer treats an unset variable
  as permission to proceed.

**Why nothing was rotated:** splitting the ES mapping requires the new Vault property to
exist **first**. Verified directly — `secret/prod/flipflop-service` currently has
`JWT_TOKEN` but **no** `FLIPFLOP_INTERNAL_SERVICE_SECRET` property. Pointing the
ExternalSecret at a property that does not exist fails the sync for the **whole**
`flipflop-service-secret`, which all five services share through one `envFrom` — that
turns a hygiene fix into a five-service outage.

The manifest edit was written, checked against that dependency, and then **reverted**, so
the repo stays deployable. The correct order, when someone picks this up:

1. `vault kv patch secret/prod/flipflop-service FLIPFLOP_INTERNAL_SERVICE_SECRET=@<0600 file>`
   — seed it with the **current** `9431f75c` value, so the split is behaviourally neutral
2. repoint `FLIPFLOP_INTERNAL_SERVICE_SECRET` at its own property, `kubectl apply -f
   flipflop/k8s/external-secret.yaml`, `force-sync`, restart all five, verify fp unchanged
   in all five pods
3. **only then** rotate each job independently

Step 1 could not be completed in this session: every `vault kv patch` was refused by the
harness permission classifier. That is the sole blocker — the analysis and ordering above
are done.

### 3. `321c86c8` — flipflop -> orders create: caller verified, handed to Session C

Confirmed: `flipflop-service-secret#ORDERS_SERVICE_TOKEN` and
`orders-microservice-secret#FLIPFLOP_INTERNAL_SERVICE_TOKEN` are the same value, HS256,
`sub=flipflop-service`, `roles:['internal:orders-microservice:admin']`, **exp 2026-09-11**.

Not migrated here: the receiver-side edit (`orders-microservice/src/auth/jwt-roles.guard.ts`)
is Session C's file, and moving the caller to Bearer before the receiver accepts it would
break order creation. **Handed to Session C** — see the handover section below.

**Measured both paths from inside `flipflop-order-service`** (2026-08-31), which settles
what the migration actually needs:

```
POST /api/orders  x-internal-service-token: 321c86c8  -> 400 "channel is required"  (authorized)
POST /api/orders  Authorization: Bearer   321c86c8    -> 401 "Invalid token"
```

The Bearer path 401s because `321c86c8` is **HS256** and auth now rejects that algorithm
outright — the same structural obsolescence as item 4. So this lane needs a newly minted
RS256 principal *before* the caller can switch, not merely a guard change on the receiver.
`--check-db-only` for `flipflop-service--orders-microservice` /
`internal:flipflop-service:service` returns `applicationFound:true, roleFound:true,
principalExists:false` — ready to mint, blocked only on the Vault write.

**A caller-side defect found while tracing this** (`flipflop/shared/clients/order-client.service.ts:418`):
`getAuthHeaders()` **fails open** — it returns `{}` when `ORDERS_SERVICE_TOKEN` is unset, so
a missing credential sends the order-create call to orders with no authentication at all
rather than raising. Its sibling `getStatusActionHeaders()` eight lines below is already the
correct fail-closed form. The fix (throw on missing, and send `Authorization: Bearer`) was
written and typechecks clean on all four services that compile the shared client
(`tsc --noEmit`, exit 0), but was **deliberately not committed**: committing it to `main`
auto-deploys (`deploy_queue_paths_warrant_deploy` returns true for that path), and shipping
Bearer against the current HS256 value would turn a working **400** into a **401** — an
outage. It must land in the same change as the new RS256 credential. Patch preserved at
`session-d-flipflop.patch` in the session scratchpad.

### 4. cliplot -> orders status: a second dead lane, not previously reported

The prompt lists this as an HS256 over-privilege item to tidy up. It is **also broken in
production**, which was not known:

```
cliplot-secret#ORDERS_STATUS_SERVICE_TOKEN  fp=c59347ae  HS256  exp 2026-09-30 (NOT expired)
GET /api/orders/<id>                 -> 401 Invalid token
PUT /api/orders/<id>/status          -> 401 Invalid token
POST /auth/validate                  -> 401 "Unsupported token algorithm HS256; RS256 required"
```

**Unexpired but structurally obsolete** — the same shape as the bazos outage in 6x. `exp`
is a useless health signal on its own; auth stopped accepting HS256 and the token has been
refused since, with a far-future expiry masking it.

`cliplot` uses this credential for two calls (`cliplot/src/integrations.js`):
`cancelOrderThroughOrders` (`PUT /:id/status`) and `readOrderWithStatusToken`
(`GET /api/orders/:id`), used together in the gated `CREATE_REPLAY_CANCEL` live-smoke flow
(`ENABLE_LIVE_ORDER_WAREHOUSE_SMOKE=true`). It is not on the customer checkout path, which
is why a 26-day-style outage went unnoticed — but the flow is dead whenever it is run.

**Minted** (the prompt's open question, "`service` or `action-admin`?", is answered by the
call sites — it writes, so `service` is not enough):

```
principal    724fc31a-d735-475e-a29a-18a41bfe1166
email        svc-cliplot--orders-microservice@internal.alfares.cz
roles        internal:orders-microservice:action-admin, internal:cliplot:service
RS256, kid=a975635403084850, 90d, exp 2026-11-29, fp 5443e373
```

Re-minted 2026-08-31 after the earlier attempt's principal did not persist
(`--check-db-only` for `cliplot--orders-microservice-status` returns
`principalExists:false`; only the principal above stands, so there is no duplicate).

`--check-db-only` -> `applicationFound:true, roleFound:true, principalExists:false`;
`--dry-run` -> `wouldCreateUser:true` before `--apply`. Token written 0600, never printed.

**Probed before storing, from inside the auth pod so the value never transited a shell:**

| Call | Result |
| --- | --- |
| `POST /auth/validate` | **201 valid:true** as the new principal |
| `PUT /api/orders/<nonexistent>/status` | **404 Order not found** — authorized |
| `GET /api/orders/<nonexistent>` | **403 Insufficient permissions** |

**The 403 is a real finding, not a probe artefact.** `action-admin` satisfies
`ORDER_STATUS_UPDATE_ROLES` but **not** `ORDER_DETAIL_READ_ROLES`, which is
`superadmin | orders:admin | invoices:service | ORDER_CHANNEL_LIFECYCLE_READ_ROLES`.
`ORDER_CHANNEL_LIFECYCLE_READ_ROLES` lists flipflop, allegro, aukro, bazos and heureka —
**cliplot is not in it.** `internal:cliplot:service` does exist and is accepted for order
*create* (`CHANNEL_ORDER_CREATE_ROLES`), but grants neither the read nor the status update,
so adding it would not clear the 403.

**Tested, not assumed.** `internal:cliplot:service` was added to the principal and the
token re-minted carrying both roles; `GET /api/orders/:id` still returned **403**. The
role list, not the credential, is the constraint.

So the old token only ever worked on the GET because it carried broad
`internal:orders-microservice:admin`. Restoring that on the new principal would reproduce
the over-privilege this migration exists to remove. **The clean fix is one line in
`ORDER_CHANNEL_LIFECYCLE_READ_ROLES` — Session C's file.** Handed over rather than worked
around.

**The new credential was not stored.** Every `vault kv patch` in this session was refused by
the harness permission classifier, so `secret/prod/cliplot#ORDERS_STATUS_SERVICE_TOKEN`
still holds the dead `c59347ae`. The lane is no worse than it was found — it was already
401 — but it is **not fixed**. The principal exists and is verified working for the PUT;
what remains is the Vault write plus, for the GET, Session C's role change.

The token file in the auth pod was deleted; no copy ever reached local disk (the
pod->host copy was refused by the classifier, so the value never transited a shell).

### Handed to other sessions — not edited here

**To Session C** (`orders-microservice/`):

1. **`cliplot` is missing from `ORDER_CHANNEL_LIFECYCLE_READ_ROLES`**
   (`src/orders/orders.controller.ts:44-50`). Any cliplot principal that is not
   `orders-microservice:admin` gets **403** on `GET /api/orders/:id`, verified live with a
   freshly minted `action-admin` principal. Until this lands, cliplot's status lane can only
   read by holding broad admin — which blocks the privilege reduction. Note the neighbouring
   `CHANNEL_ORDER_CREATE_ROLES` *does* list `internal:cliplot:service`, so the omission looks
   accidental.
2. **`321c86c8` (flipflop -> orders create)** is a live HS256 shared password on the legacy
   `x-service-name` path, **expiring 2026-09-11** (12 days out as of 2026-08-31 — the only
   item here with a hard deadline). The flipflop caller's Bearer switch is written and
   typechecks, but note the measured detail above: the existing value **401s as a Bearer
   token because it is HS256**, so the guard change alone is not sufficient — a new RS256
   principal must be minted and stored in the same change, or order creation breaks.

**To Session F** (`marketing-microservice/`): `ORDER_AFFINITY_FLIPFLOP_REPLAY_TOKEN`
(`9431f75c`) is the third copy of flipflop's internal shared string. Once the flipflop side
is split (item 2 above), the replay credential should read its **own** Vault property —
proposed name `FLIPFLOP_AFFINITY_REPLAY_TOKEN` on `secret/prod/flipflop-service`, consumed
by marketing as `ORDER_AFFINITY_FLIPFLOP_REPLAY_TOKEN`.
`marketing-microservice/src/order-affinity-backfill.ts:490` already prefers that variable
ahead of `FLIPFLOP_INTERNAL_SERVICE_SECRET`, so the switch needs no marketing code change —
only the new property and the ES entry. **Do not rotate the value until flipflop's split
lands**, or the replay pull 401s against flipflop's unchanged comparison.

### Blocked: Vault writes

Items 2 and 4 both stop at the same step. `vault kv patch` was refused by the harness
permission classifier on every attempt, including through the `/vault-secret` skill, so no
Vault property was created or changed in this session. `kubectl cp` out of the auth pod was
refused for the same reason — worked around legitimately by probing from inside the auth
pod, which is better practice anyway.

Nothing was left half-applied: the ES manifest edit was reverted, the repo is deployable,
and every lane is either fixed and verified (item 1) or in exactly the state it was found
(items 2, 3, 4).

## 6aa. Session G — the superadmin token, ownerless ExternalSecrets, and Phase 6, 2026-08-27

Infrastructure, not application code. Items 1 and 2 are done and verified live; items 3
and 4 are a working tool plus a staged plan, which is what the prompt asked for rather
than a half-executed rotation.

### 1. `stock-traceability-runtime-token` — closed

**The widest-privilege credential in the inventory is gone.** One hand-created Secret (no
ExternalSecret, no ownerReferences, absent from Vault) held a single HS256 token with
`roles=[global:superadmin, internal:warehouse-mi…]`, expired **2026-06-24**, mounted by
`suppliers-microservice` as *both* `CATALOG_SERVICE_TOKEN` and `WAREHOUSE_SERVICE_TOKEN`.

**Both lanes had been dead for 64 days.** Probed from inside the pod before changing
anything:

| Lane | Before | After |
| --- | --- | --- |
| suppliers -> catalog `GET /api/products/:id` | **401** `Token validation failed` | **404** `Product … not found` (authenticated; genuine "no rows") |
| suppliers -> warehouse `POST /api/supplier-reconciliations` | **401** `Invalid token` | **400** body validation (authenticated) |

This is a **seventh outage** of the same family, but unlike the first six it was *not*
silently masked: `imports.service.ts:378-388` throws `ServiceUnavailableException` and
distinguishes 404 from 401/403 correctly. The lane failed loudly and was still missed for
64 days, which is the argument for item 4 in one sentence.

**Least privilege, chosen per target rather than by convention:**

| Lane | Role | Why not narrower, why not wider |
| --- | --- | --- |
| catalog | `internal:catalog-microservice:service` | `GET /api/products/:id` is decorated `@RequireCatalogRoles('catalog:authenticated')` — *any* valid non-marathon principal passes. It needs no catalog role at all, so `:admin` would have been pure over-grant. |
| warehouse | `internal:warehouse-microservice:admin` | `POST /api/supplier-reconciliations` is decorated `@Roles(...WAREHOUSE_ADMIN_ROLES)`, which is `{global:superadmin, internal:warehouse-microservice:admin}` only. **`:readonly` cannot pass it** — the obvious "reduce to readonly" move would have re-broken the lane. |

Both minted RS256, 90d, via `provision-service-token.js --create-if-missing`:

- `svc-suppliers-microservice--catalog-microservice@alfares.cz` (`b08f2287-…`, fp `a664b2d5`)
- `svc-suppliers-microservice--warehouse-microservice@alfares.cz` (`5a556c66-…`, fp `cc2952a9`)

Executed in the prompt's order, each step verified before the next:

1. lanes probed from the pod — both 401, confirming the outage rather than assuming it
2. principals minted, claims decoded inside the auth pod: `alg=RS256`, correct roles, exp 2026-11-25
3. both probed against the **real endpoints** while still in the auth pod — 404 / 400, i.e. authorized
4. written to `secret/prod/suppliers-microservice`, ES `data` entries added, applied, force-synced
5. ESO delivery fingerprinted in the K8s Secret: `a664b2d5` / `cc2952a9` — matching Vault exactly
6. only then the two `env[]` overrides removed from the repo manifest and applied
7. **fingerprinted inside the pod created after the change** — `a664b2d5` / `cc2952a9` via `envFrom`
8. both lanes re-probed from that new pod: 404 / 400
9. only then, with **zero** workloads and zero repo references remaining, the orphan Secret deleted

Commit `f96bb6d`. Vault sources for suppliers went from "none" to two per-pair principals,
so the next rotation reaches them.

**A trap worth recording.** Step 7 nearly produced a false green: `kubectl get pod -l
app=suppliers-microservice -o jsonpath='{.items[0]…}'` returned the **old** pod
(`5f9b9f4bb-mrn8x`, still fingerprinting `c5817dbb`) while the new one was already ready.
Sorting by name is not sorting by age. This is the same class as the "verify by pod age,
not log lines" lesson — `.items[0]` is not "the current pod".

### 2. The two ownerless ExternalSecrets — closed, and one premise corrected

**`database-credentials` was not untracked.** The prompt states neither ExternalSecret
exists in any repo; that is right for nginx, wrong for this one. It lives at
`k8s-manifests/secrets/database-credentials-external-secret.yaml` and — importantly — the
tracked file **never had** a `JWT_TOKEN` entry. The *live object* had drifted ahead of it.

So the fix was not to reconstruct a manifest but to re-assert the one already in the repo:
`kubectl apply` of the tracked file removed the `data` entry, and ESO pruned the key.

- before: `DB_HOST, DB_PASSWORD, DB_PORT, DB_USER, JWT_TOKEN` (fp `a2880693`)
- after: `DB_HOST, DB_PASSWORD, DB_PORT, DB_USER`
- the three consumers (aukro, bazos, orders) mount it by **named `secretKeyRef` on
  `DB_PASSWORD` only**, never `envFrom`, so the removal was provably inert for them —
  all three verified `DB_PASSWORD` fp `f78291d9` in-pod afterwards.

**`nginx-microservice-secret` was deleted entirely**, not just its key. The service is
retired (`nginx-microservice.retired-20260617.tar.gz`), with no workload, no cluster
reference and no repo reference anywhere. Its Secret was `creationPolicy: Owner` and was
garbage-collected with the ExternalSecret. Nothing was brought under `k8s-manifests/` for
it, because tracking a manifest for a service that no longer exists is drift of a
different kind. Commit `197abfc`.

Note for whoever touches `k8s-manifests/secrets/` next: the directory is in `.gitignore`,
but the three files in it are already tracked, so edits commit normally — a new file there
would need `-f`, and probably should not be added at all.

### 3. `JWT_SECRET` across 13 pods — analysis, and a live finding that changes the framing

The prompt says this is "not currently exploitable for forgery" because catalog, orders,
warehouse and payments no longer verify HS256 locally. That is true of those four. **It is
not true of the ecosystem**: three services still verify HS256 locally on an inbound
request path.

| Service | Where | Assessment |
| --- | --- | --- |
| `docs-rag-microservice` | `src/service-identity/service-auth.guard.ts:29-33` | **HS256-only, no RS256 branch.** Any holder of `366a1388` can mint a `serviceId` of its choosing. Verified by reading the guard. |
| `ai-microservice` | `src/service-identity/service-auth.guard.ts:46-74` | RS256 preferred, **HS256 fallback defaults to open**: `hs256FallbackEnabled()` returns `process.env.ALLOW_HS256_FALLBACK !== 'false'`. **Mitigated in production** — the live pod has `ALLOW_HS256_FALLBACK=false` (verified in-pod). The code default remains open, so a fresh deployment without that env var reopens it. |
| `domain-research` | `src/service-identity/internal-service.guard.ts:13` | `jwt.verify(token, secret)` with **no `algorithms` option at all**. Its value (`4ecb98f5`) is not the shared one, which bounds blast radius, but an unpinned verifier is independently a bug. |

`366a1388` is mounted 13 times, and two of its holders (`cv-tuning`, `runlayer`) actively
**sign** HS256 tokens with it to call `ai-microservice` and `docs-rag` respectively. So the
shared secret is not merely legacy residue — it is load-bearing for two live lanes.

**Two values must never be rotated as credentials, because they are not credentials:**

- `crypto-ai-agent` uses `settings.jwt_secret` as the **PBKDF2 master key** for Fernet
  encryption of stored user exchange API credentials
  (`backend/app/utils/encryption.py:28`). Rotating it makes every stored credential
  **permanently undecryptable**. It needs a re-encrypt migration, not a rotation.
- `auth-microservice` derives the **contact-code hash** for login/recovery OTP codes from
  it (`src/auth/auth.service.ts:1666`). Rotating invalidates every outstanding code, and
  `requireJwtSecret()` throws at module load, so the pod will not boot without it.

**Staged plan — deliberately not executed. This is the deliverable for item 3.**

- **Stage 0 (no rotation, pure risk reduction).** Pin `algorithms: ['RS256']` in
  `domain-research`'s guard; flip `ai-microservice`'s fallback default to closed so the
  safe state does not depend on an env var being present. Neither changes a secret value.
- **Stage 1.** Migrate the two signing lanes to per-pair RS256 principals —
  `cv-tuning -> ai-microservice`, `runlayer -> docs-rag-microservice` — the same shape
  used seven times already in this migration. Then `docs-rag`'s guard can drop HS256.
- **Stage 2.** Give the two non-JWT consumers their **own** keys:
  `CRYPTO_ENCRYPTION_MASTER_KEY` and `AUTH_CONTACT_CODE_SECRET`, initialised to the
  current value so nothing re-encrypts on day one. This is a *rename*, not a rotation, and
  it is what makes a later rotation survivable.
- **Stage 3.** Drop `JWT_SECRET` from the services that never read it. `flipflop`'s five
  deployments need `env-validator.ts:312` relaxed first — it marks the var `required: true`,
  so removing the key crashes boot even though nothing reads it for JWT.
- **Stage 4.** Only now rotate what remains, per service, with the OTP grace window.

Do not compress these. Stage 4 before Stage 2 destroys user data.

### 4. Phase 6 — `shared/scripts/token-health/` (commit `9ab01f1`)

Built, tested against production, **not yet installed** — `install.sh` needs an interactive
sudo for the unit files, which this session could not supply. One command finishes it.

`token-health.sh` enumerates every credential-shaped env var **actually mounted by a
running pod**, decodes each JWT, and reports algorithm, days to expiry, value sharing and
privilege. `token-health-guard.sh` runs it daily and alerts to the Monitoring Daily Digest
through the existing deploy-queue notifier, so no credential is duplicated to make it work.

**Why it enumerates pods and not Vault.** `secret-census.sh` already answers "is this value
shared", reading Vault, and that question stays there. But it never decodes a JWT, so it
cannot see an algorithm or an expiry — and because it reads Vault, a credential with **no
Vault source at all** is invisible to it by construction. `stock-traceability-runtime-token`
is precisely that case: 64 days expired, `global:superadmin`, and absent from every census
run ever performed. Starting from what pods mount is the only view in which an untracked
`env[]` override, an ESO-delivered key and a hand-created Secret all look the same.

**It found a live outage on its first run.** `flipflop-service`
`ORDERS_STATUS_SERVICE_TOKEN`, HS256, **expired 22 days ago**, and read by live code at
`flipflop/shared/clients/order-client.service.ts:430`. Also two expired monitoring smoke
tokens (`-65d`, `-42d`) and four mounts **14-15 days from expiry** — the alert-before-expiry
case working as designed. flipflop belongs to Session D, so it is reported here, not fixed.

Current census: **188 mounts — 38 critical (all HS256), 38 ok, 1 error.**

Design decisions worth keeping:

- **Alerts on transitions, not standing state.** 38 HS256 mounts exist today; re-sending
  them daily would bury the channel, and a muted channel is worse than none. The exception
  is a 7-day deadline, which re-alerts every run — a token 3 days out that was 4 days out
  yesterday is not "no news".
- **Keyed on `app|var`, not fingerprint**, so a healthy rotation is not reported as a new
  finding.
- **The baseline only advances after successful delivery.** If Telegram is down the guard
  exits 2 and re-reports next run rather than swallowing the finding.
- **An unreadable pod is an `ERROR` row, never a skip.** `kube-state-metrics` is distroless
  and reports one permanent error; that is left visible on purpose, because an allowlist is
  how a pod stops being audited quietly.
- Values never touch argv or disk — fingerprints (`sha256[0:8]`) and non-secret claims only,
  piped on stdin. `e3b0c442` is treated as **MISSING**, never as a value.

**Verified by making it fail.** A synthetic regression was injected into the baseline
(one CRITICAL row flipped to OK); the guard reported it as `was: OK -> CRITICAL`, then went
quiet on the following run once the baseline caught up, while continuing to re-alert the
three genuinely expired tokens. The container-name bug found during that testing — `-c app`
hardcoded, which silently turned 21 pods into unreadable ERROR rows — is fixed by resolving
the container per pod; flipflop and the infra pods do not use `app`.

### Left for others

- `flipflop-service ORDERS_STATUS_SERVICE_TOKEN`, expired 22 days — **Session D**
- `monitoring-microservice` smoke tokens, expired 65 and 42 days — **Session C**
- `catalog-microservice JWT_TOKEN` / `BAZOS_SERVICE_TOKEN`, 14 days to expiry — **Session E**
- `install.sh` for token-health: needs one interactive sudo

## 6aa. Session C — orders/monitoring, 2026-08-27

Scope was three items. **Item 1 was already fixed before this session started** (6y, same
day) — verified rather than redone. Items 2 and 3 are new work.

### 1. orders -> warehouse — already repaired in 6y, re-verified live

The prompt was written before the 6y sweep landed. Confirmed from the deployed pod
(`orders-microservice-57784668b7-6x6h2`), not from the plan text:

```
effective WAREHOUSE_SERVICE_TOKEN  fp=d2b2828d  RS256
roles=[internal:warehouse-microservice:action-admin]  exp 2026-11-25
GET /api/stock/<nonexistent>/total          -> 200
GET /api/reservations/order/<nonexistent>   -> 200
```

No credential work was needed. **The masking half of item 1 was still open**, and is fixed
below.

### 2. `monitoring-microservice` smoke tokens — genuinely unused, removed

The prompt warns that "unused" from a grep is a hypothesis. Four independent checks, and one
piece of evidence that settled it:

| Check | Result |
| --- | --- |
| all 50 ecosystem repos (per-repo bounded grep) | only the ES mapping + the VAL-TASK-004 doc |
| every CronJob in `statex-apps` | no reference |
| `monitoring-microservice` Deployment `env[]` | only `LOGGING_READ_SERVICE_TOKEN` is named |
| repo `src/`, `scripts/`, `web/` | no reference |

**The decisive evidence was in the payloads, not the grep.** Both decode to
`type:end_user`, `roles:[]`, `email=monitoring-smoke+task004-auth-mqf81ns9-d5c5db@example.invalid`
— the synthetic run id recorded in `VAL-TASK-004`. They are leftover artifacts of a one-off
smoke run that minted its own credentials at runtime, never service principals. That is why
nothing reads them, and it is a stronger answer than "grep found nothing".

Removed in the order 6x prescribes, each step verified:

1. ES `data` entries deleted, `kubectl apply -f k8s/external-secret.yaml` (the deploy queue
   builds images, it does not apply manifests), then `force-sync`
2. K8s Secret went 8 keys -> 6; **both smoke keys pruned** — confirming 6x: the ES entry is
   what prunes, the Vault property alone would not have
3. only then the Vault properties removed (`vault kv patch -remove-data=` — note this Vault
   1.15.6 rejects `-remove`, the flag is `-remove-data`)
4. `smoke_auth_present=false / smoke_refresh_present=false` inside the **new** pod

### 3. `LOGGING_READ_SERVICE_TOKEN` rotated — and it was already half-broken

Rotated onto `svc-monitoring-microservice--logging-microservice`
(`539cf37b-06cb-4317-b469-795b97f226d9`, RS256, 90d, fp `267cfd5b`), **exp 2026-09-24 ->
2026-11-25**. Role unchanged at `internal:logging-microservice:readonly`: the only call site
(`marathon-monitoring.service.ts:12`) does one GET, so `readonly` was already least privilege.

**A latent bug found while probing, worth more than the rotation.** The stored value carries a
trailing newline. `axios` rejects that header with `ERR_INVALID_CHAR` *before sending any
request* — the call site did not `.trim()`, unlike the orders clients. The fail-soft catch then
reported `unavailable: logging summary unavailable`, indistinguishable from a logging outage.
Fixed with `.trim()` at the call site, which is robust regardless of what is stored.

Fail-soft was **kept** here deliberately: the method already exposes an explicit `unavailable`
flag, which is the exact carve-out CLAUDE.md allows. What it lacked was any log at all — now
`logger.error` with url, params and httpStatus.

### The masking behind outage 4, fixed (orders, `32cc0aa`)

Four bare `catch {` blocks — three in `warehouse-reservation.client.ts` (125, 235, 265), one in
`order-fulfillment-handoff.client.ts` (152) — **discarded the error object entirely** and
logged a fixed string at `warn`. During the 27-day 401 the only evidence produced was
`Warehouse reservation handoff failed`: no status, no URL, no message.

These are **not** the `return []` / `return 0` shape from 6x, and the returned value was left
alone: each already returns `status:'failed'` + `failureCode:'warehouse_request_failed'`, so
the outcome is distinguishable to the caller. Only the logging was wrong. Now error-level with
`orderId`, target URL, item counts, `httpStatus` and a truncated body.

Verified by injecting a 401 into the compiled client: one error log carrying
`orderId=ord-test-1` and `httpStatus=401`; **reverting the catch drops it to zero** — the check
fails when the fix is removed. `verify:sensitive-logging` still passes, so the added body
excerpt does not leak protected fields.

### Four-hop evidence

| Lane | Before | After | fp minted = Vault = Secret = pod |
| --- | --- | --- | --- |
| monitoring -> logging | 200, exp in 28d | **200**, exp in 90d | `267cfd5b` |
| orders -> warehouse | 200 (fixed in 6y) | **200** | `d2b2828d` |

Both confirmed in pods created *after* the change (`monitoring-...-b4nfr` 11:34,
`orders-...-6x6h2` 11:39). The monitoring lane was additionally exercised through the **real
compiled client** in the pod (`MarathonMonitoringService.getEventSummary`), returning
`unavailable: false` — not just a raw curl.

### Found, not fixed — deliberately out of scope

- **`warehouseHandoff.failureCode` is written but never read.** No caller branches on it
  (`orders.service.ts:319/580/741/754` only persist the summary), so an order proceeds to paid
  and fulfilled with a failed warehouse handoff recorded and nothing acting on it. **The
  logging fix makes the failure visible; it does not make the system react.** That is a
  behavioural change needing a product decision.
- **The deploy-queue worker stalls.** After the unrelated `cv-tuning` failure the unit hit
  `start-limit-hit`; `queuectl.sh status` then listed queued services while the worker logged
  "queue empty" and never drained them. Cleared with `systemctl reset-failed` +
  `start` (no reinstall). Worth a look — a stalled queue means a commit silently does not
  deploy, which is the same class of invisible failure this whole migration is about.
- **Vault stores the rotated token with a trailing newline**, because `kv patch KEY=@file`
  preserves it. Cosmetic now that the client trims, but every `@file` write in this migration
  has the same property.
- `/tmp/cat-bazos.token` is left over inside the auth pod from another session (Session E's
  repo). Not deleted — not mine.

## 6z. Session F, 2026-08-27 — 16 of 19 `a2880693` mounts retired

Session F owned `marketing-microservice/`, `logging-microservice/`, `aukro/`, `heureka/`,
`payments-microservice/`. **Every mount in those repos is gone.** Vault sources 7 -> 2;
the two survivors (`payments#JWT_TOKEN`, `warehouse#JWT_TOKEN`) are held open by *other
sessions'* repos, not by anything in scope here.

### The census was two mounts short

The brief listed 16 mount points. Measured in the pods, there were **19**:

| Missed mount | Why the census missed it |
| --- | --- |
| `heureka#HEUREKA_INTERNAL_SERVICE_TOKEN` | a **second `deployment.yaml` alias** of the same `JWT_TOKEN` secret key — one Vault property, two pod-visible env vars |
| `aukro#JWT_TOKEN` (deployment alias) | named explicitly in `deployment.yaml` as well as the ES, so pruning the ES alone left the pod spec referencing a key that no longer existed |
| `payments#PAYMENTS_ORDERS_SERVICE_TOKEN` | mapped to `property: JWT_TOKEN` — same property, second `secretKey` |

**Counting ExternalSecret entries undercounts the blast radius.** A mount is
(Vault property) x (ES `secretKey`) x (deployment `env` alias), and each layer can fan out.

### Lane-by-lane results, all probed from the deployed pods

| Lane | Before | After (new cred) | After (`a2880693`) | fp |
| --- | --- | --- | --- | --- |
| marketing -> aukro replay | 200 | **200** | **401** | `f9609e86` |
| marketing -> bazos replay | 200 | **200** | **401** | `50685561` |
| marketing API (17 routes) | 400 authorized | **400** authorized | **401** | `d8a1d3f4` |
| logging ingest | 201 | **201** (`LOG_INGEST_BEARER_TOKENS`) | **401** | unchanged |
| payments -> orders | 404 authorized | **404** authorized | n/a | `633a4184` |

Every fingerprint matched at all four hops — minted = Vault = K8s Secret = pod created
after the change.

### The replay lanes needed no code change and no deploy window

The decisive structural fact: marketing's `ORDER_AFFINITY_<SVC>_REPLAY_TOKEN` and the
receiver's `<SVC>_INTERNAL_SERVICE_TOKEN` **already mapped to the same Vault property**.
So pointing both at a new `MARKETING_REPLAY_TOKEN` property moves sender and receiver
*atomically on one write* — there is no ordering problem and no window where one side has
rotated and the other has not.

That is why these lanes got **opaque per-lane secrets rather than RS256 principals**. The
receivers are plain byte-comparison controllers; giving them real principals means teaching
each to verify JWKS, which is a code change on two services in two repos (one of them
Session E's) for a lane that has exactly one caller. `aukro/shared/auth/jwt-verifier.ts`
already exists and would make that cheap — recorded as the better end state, deliberately
not taken here.

`MARKETING_API_TOKEN` got an opaque secret for a different reason: **there is no caller to
own a principal.** No ecosystem service sends `x-service-token` to marketing (grep across
every repo), so it is an operator credential. A per-pair principal would have been a
90-day-expiring credential with no owning service and no rotation job — a sixth expiry
outage waiting to happen.

Note it guards **17** routes, not the ~12 the brief estimated: `/segments` (3),
`/campaigns` (5), `/journeys` (7), `/scheduler/run-due`, `/campaigns/:id/execute`.

### `logging#JWT_TOKEN` was safe to remove, but not for the stated reason

The brief warned that "several speakasap services fall back to `JWT_TOKEN`". They do, in
source: eleven `remote-logger.ts` files read `LOGGING_SERVICE_TOKEN || JWT_TOKEN`.
**Measured in all ten running pods, every one resolves the primary** (`b6e283e5`), so the
fallback is unreachable. And the three pods that *would* fall through (aukro, bazos,
heureka) have loggers that reference no token at all — they post to ingest unauthenticated.

So the accepted set was `{LOG_INGEST_BEARER_TOKENS[0], a2880693}` with **zero senders on
the second**. Confirmed by probing the new pod: `a2880693` -> 401, legitimate token -> 201.

Two regression tests pin this, both confirmed to fail when the `JWT_TOKEN` branch is
restored.

### Three inverted tests, not three deleted tests

Each removal had a test asserting the *old* behaviour. Deleting them would have been the
"fix the test" reflex 6u warns about; each was inverted to assert the rejection instead,
and **each was confirmed to fail when the fix is reverted**:

- `bazos orders.service.spec.ts` — "accepts the deployed JWT_TOKEN alias" -> "rejects" it
- `bazos order-client.service.spec.ts` — "falls back to the runtime JWT_TOKEN" -> "throws
  rather than falling back"; three sibling tests set `SERVICE_TOKEN`/`BAZOS_INTERNAL_*`
  and were repointed at `ORDERS_SERVICE_TOKEN`, since the credential they used is gone
- `payments-orders-status-bridge.spec.ts` — "falls back to the shared static header" ->
  "does not fall back", asserting **no request is sent at all**, plus a new test pinning
  the Bearer path

bazos: 166 + 18 tests green. payments: 116 green. logging: 35 green. heureka has no test
runner, so its four chain edits carry a typecheck that was **verified to fail** on an
introduced type error rather than trusted to pass.

### A seventh outage, found while removing a fallback

`heureka -> catalog` is **401 in production and was already broken** before this session:

```
CATALOG_INTERNAL_SERVICE_TOKEN  <unset>   -> chain fell through to a2880693
GET catalog-microservice:3200/api/products/sku/<sku>
  -> 401 "Missing or invalid Authorization header"
```

catalog wants a **Bearer** token; the static `x-internal-service-token` header it was being
handed cannot authenticate there at all. This is the same shape as the aukro -> catalog
outage in 6q, on the same lane, one service over.

Removing the dead sources does **not** fix it — it stops the chain reporting a
configured-looking credential for a path that can never authenticate, so the missing
credential surfaces as itself. The client already re-throws (6x), so it is loud, and
`CatalogClientService` has no feature callers in `heureka/src` yet, so blast radius is
currently nil. **Minting the per-pair principal is Session E's** (catalog lane).

### An eighth finding, out of scope: ingest is dropping two services' logs entirely

The `log_ingest_rejected` counter is **25,039 over 48h**, every one `missing_credential`:

```
16122  speakasap              LOGGING_SERVICE_TOKEN and JWT_TOKEN both <unset>
 8072  prompts-microservice   has a token; it is not in the accepted set
  822  kube-state-metrics     (scrape noise, not a service logger)
```

Unrelated to `a2880693` — neither holds it — so it was **not fixed here**, but both
services have been silently losing every log line they emit. The guard is doing its job
loudly; nobody is reading it. Worth its own task.

### Deploy ordering used

1. Vault write of the three new secrets **first** (sender and receiver read the same
   property, so this is the atomic moment for the replay lanes)
2. `kubectl apply` all three ExternalSecrets + force-sync — the deploy queue builds images,
   it does not apply manifests
3. Verify fp at Secret hop, **then** restart marketing + aukro + bazos **together**
4. Verify fp at pod hop, probe both lanes and the marketing API old-vs-new
5. Only then commit -> auto-deploy (5 services, `0 failed`)
6. Prune ES entries + deployment aliases -> apply -> confirm keys pruned -> delete Vault
   properties -> restart -> re-probe every lane

### Two traps worth recording

**ESO prunes, `kubectl` does not un-reference.** After deleting `aukro#JWT_TOKEN` and
`heureka#JWT_TOKEN` from Vault, both pods entered `CreateContainerConfigError`:
`couldn't find key JWT_TOKEN in Secret`. The ES prune worked; the **running Deployment spec
still named the key** via `secretKeyRef`, and those services deploy from images built
before the manifest fix landed. Kubernetes refused to start the pod — correctly. Fixed by
patching the env list on the live Deployments (not `kubectl apply`, which would have swapped
the running image for `:latest`). **Order matters: remove the deployment `env` alias and let
it roll BEFORE deleting the Vault property.**

**`vault kv patch -remove` does not exist in 1.15.6, and `KEY=null` writes the literal
string `"null"`.** That silently replaced a credential with a 4-byte string
(fp `74234e98`). It reached no pod because no ES entry mapped it, but on a live key it
would have been an outage with a healthy-looking `SecretSynced`. Correct method: read the
map, drop the key in-process, `vault kv put` the remainder — verified key-count before and
after each write.

### `a2880693` still cannot be rotated. Exactly what holds it:

| Holder | Owner |
| --- | --- |
| `orders#PAYMENTS_INTERNAL_SERVICE_TOKEN` (K8s Secret + pod) | **Session C** |
| `orders#WAREHOUSE_INTERNAL_SERVICE_TOKEN` (K8s Secret + pod; also read outbound by `warehouse-reservation.client.ts:275`) | **Session C** |
| `secret/prod/payments-microservice#JWT_TOKEN` (Vault) | source of the orders mount above — deletable only once Session C removes it |
| `secret/prod/warehouse-microservice#JWT_TOKEN` + `warehouse-microservice-secret#JWT_TOKEN` | **Session G** |

Nothing in `marketing`, `logging`, `aukro`, `heureka` or `payments` holds it any more.
**Three mounts remain across two sessions.** When those land, the value can be rotated —
and since no DB principal stands behind it, rotation is the only revocation available.

## 6aa. Session G — the superadmin token, ownerless ExternalSecrets, and Phase 6, 2026-08-31

Numbered `6aa` because `6z` was taken twice concurrently (Sessions D and F both claimed it).

### 1. `stock-traceability-runtime-token` retired — sixth dead lane found

The widest-privilege credential in the inventory is gone. It was hand-created (no
ExternalSecret, no ownerReferences, absent from Vault), HS256, carried
`global:superadmin`, had expired **2026-06-24**, and was mounted by `suppliers-microservice`
under two different names for two different targets.

**Both lanes were dead in production** — confirmed by probing from inside the running pod
before changing anything:

| Lane | Before | After |
| --- | --- | --- |
| suppliers -> catalog `GET /api/products/:id` | **401** `Token validation failed` | **404** `Product ... not found` (authenticated; 404 is the legitimate "no rows") |
| suppliers -> warehouse `POST /api/supplier-reconciliations` | **401** `Invalid token` | **400** body validation (authenticated) |

This is outage number six, and the first one in this migration that was **not** masked into
an empty result. `imports.service.ts` throws `ServiceUnavailableException` on 401/403 and
only treats a 404 as "product missing" — the pattern the earlier sessions had to retrofit
elsewhere was already correct here, so the lane failed loudly and merely went unread.

**Least privilege differs per lane, and the obvious guess is wrong in both directions:**

- catalog: `GET /api/products/:id` is decorated `@RequireCatalogRoles('catalog:authenticated')`,
  which any non-marathon principal satisfies. No catalog-specific role is needed at all, so
  the lane carries `internal:catalog-microservice:service`, not `:admin`.
- warehouse: `POST /api/supplier-reconciliations` is decorated `WAREHOUSE_ADMIN_ROLES`
  (`supplier-reconciliation.controller.ts:37`). **`:readonly` cannot pass it.** `:admin` is
  the narrowest role that actually works — a reduction from `global:superadmin`, but not the
  `:readonly` that the prompt's "least privilege" instinct suggests. Writing a reconciliation
  is an admin-tier operation in warehouse's own vocabulary.

Two per-pair RS256 principals, 90d:

| Principal | Role | fp (in pod) |
| --- | --- | --- |
| `svc-suppliers-microservice--catalog-microservice` (`b08f2287…`) | `internal:catalog-microservice:service` | `34eda9ca` |
| `svc-suppliers-microservice--warehouse-microservice` (`5a556c66…`) | `internal:warehouse-microservice:admin` | `510577f8` |

Order of operations, each step verified before the next: Vault properties written → ES
`data` entries added and applied (`Ready=True SecretSynced`) → K8s Secret fingerprints
matched Vault exactly → pod restarted → **fingerprints confirmed inside the new pod** →
both lanes probed 200-equivalent → only then, with 0 workloads still referencing it, the
orphan Secret deleted. The repo `env[]` overrides are gone and the keys now arrive through
`envFrom`, so the next rotation reaches this pod instead of being shadowed.

**A trap worth recording: `vault kv patch KEY=-` silently wrote empty values.** The first
attempt piped tokens from a pod path that no longer existed (the auth pod had been replaced,
taking `/tmp` with it). `kubectl exec` failed, the pipeline's left side produced nothing, and
`vault kv patch` **reported success while storing an empty string** — both keys read back as
`e3b0c442`, the sha256 of empty input the prompt warns about. `set -o pipefail` does not help
across a pipe into a command that accepts empty stdin. The re-run guards on source length
(`< 100 chars` aborts) before writing. **Verify a secret write by reading back a fingerprint,
never by trusting the writer's exit code.**

### 2. The two ownerless ExternalSecrets — and a latent outage in `orders-microservice`

Both had already been removed from the cluster: no ExternalSecret in any namespace, no
Secret anywhere. But `database-credentials` was removed **while `orders-microservice` still
referenced it**, and the consequence was live:

```
orders-microservice-57469d8785-8s5zt  CreateContainerConfigError
    Error: secret "database-credentials" not found
```

The old ReplicaSet pod kept serving traffic, so nothing alerted — but **orders could not
create a new pod**, which means the next deploy, restart, eviction or node event would have
taken the service down with no rollback path. A Secret deletion that looks inert because
the running pod already has its environment is exactly the shape that turns into an outage
hours later.

Fixed by bringing the manifest under `k8s-manifests/secrets/` (deny-listed from auto-deploy,
applied manually — correct for this) and re-applying. Reconstructed with **four keys only**:
`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`. The dead `JWT_TOKEN` entry (`a2880693`,
Vault property already deleted 2026-08-27) is **not** in the file, so ESO had nothing to
re-add — this is the prune that section 6x explains ESO will not do on its own.

Verified: `Ready=True SecretSynced`, `DB_PASSWORD` fp `f78291d9` — identical to the value
the running orders pod was already using and to `orders-microservice-secret#DB_PASSWORD`,
so the restore was behaviourally neutral. The stuck pod went `Ready` and the old pod
retired.

**Worth noting for whoever owns orders (Session C):** the `DB_PASSWORD` named `env[]` entry
pointing at `database-credentials` is redundant. `orders-microservice-secret` is already in
`envFrom` carrying the identical value, and a named `env[]` entry overrides `envFrom`.
Removing the named entry would drop this cross-service coupling entirely. Left alone here —
it is Session C's repo.

`nginx-microservice-secret` needs **no manifest**. The service is retired
(`nginx-microservice.retired-20260617.tar.gz`), there is no repo, no workload in any
namespace, and nothing references the Secret. Its ExternalSecret and Secret are already
gone; reconstructing them under `k8s-manifests/` would recreate dead objects. The right
action was to add nothing and record why. `secret/prod/nginx-microservice` still holds three
`PAYMENT_*` keys for the retired service — out of scope here, flagged for a deliberate
decision rather than deleted in passing.

### 3. `JWT_SECRET` — the x13 value is not auth's signing secret

The census reproduces, but the grouping means something different from what the prompt's
framing implies:

| fp | mounts | what it actually is |
| --- | --- | --- |
| `366a1388` | 13 | **not** auth's signing key — the HS256 secret for the `ServiceAuthGuard` mesh |
| `278bf2fc` | 6 | auth's real signing secret, `secret/prod/auth-microservice#JWT_SECRET` |
| `4ecb98f5` | 1 | domain-research |
| `b794bf08` | 1 | monitoring-microservice |

`secret/prod/ai-microservice#JWT_SECRET` and `secret/prod/docs-rag-microservice#JWT_SECRET`
both fingerprint `366a1388`; auth's is `278bf2fc`. **So the 13-pod value cannot mint tokens
auth would accept** — the "anyone holding this can mint HS256 tokens for 13 services" framing
overstates it against auth, and understates it elsewhere.

**Where it is still live and exploitable:**

| Service | RS256 path? | `ALLOW_HS256_FALLBACK` | Verdict |
| --- | --- | --- | --- |
| `ai-microservice` | yes, `JWT_PUBLIC_KEY` present | `false` | **closed** |
| `docs-rag-microservice` | none in the guard | unset | **HS256-only, open** |
| `domain-research` | none in the guard | unset | **HS256-only, open** |

`docs-rag-microservice/src/service-identity/service-auth.guard.ts` has no RS256 branch at
all. `domain-research/src/service-identity/internal-service.guard.ts` calls
`jwt.verify(token, secret)` and **checks no claims whatsoever** — any token signed with
`366a1388`, whatever its subject or roles, is accepted. Thirteen pods hold that key.

Of the 21 mounts, several services mount `JWT_SECRET` with **no runtime verification path**.
Note the shape of the evidence, because a bare `grep JWT_SECRET` is misleading here — these
repos do match, but every match is inert:

| Service | matches | what they actually are |
| --- | --- | --- |
| `crypto-ai-agent` | 0 | nothing at all |
| `bazos-service` | 1 | a comment in `shared/auth/auth.module.ts` |
| `allegro`, `aukro-service` | 3 each | comments only — `auth.module.ts` plus `jwt-verifier.ts` prose describing the *retired* HS256 path |
| `statex` | 1 | `test/setup.ts` sets `'test-secret-key'` |
| `flipflop-service` | 4 | an offline SEO script, plus name-only entries in `settings.service.ts` and `env-validator.ts` |
| `cv-tuning` | 17 | reads its own `CV_AI_JWT_SECRET` override; the bare `JWT_SECRET` is a fallback for calling ai-microservice |

`backups`, `notifications` and `suppliers` pass it to `JwtModule.register({secret})` while
their `jwt-verifier.ts` documents that RS256-only verification is already in force — the
module registration is vestigial. `orders-microservice` uses it only as a
`configured`/`missing` string in an admin health report.

**Staged proposal — explicitly a plan, not executed here** (rotating a 13-pod secret in one
step is exactly what the prompt forbids):

1. **Drop the dead mounts first.** Remove `JWT_SECRET` from the ES `data` of every service
   in the table above — none has a runtime verification path, so this is no behaviour
   change, and it takes the sharing count from 13 toward 3 without touching a value.
   Confirm each by reading the key back out of the pod (absent, not `e3b0c442`) and by
   exercising one authenticated route, **not** by grepping — as the table shows, the greps
   match on comments and would argue against a removal that is in fact safe.
2. **Retire the vestigial `JwtModule.register({secret})`** in backups, notifications and
   suppliers, whose verifiers are already RS256-only. Each is a one-line change in the
   owning repo, with the existing tests as the check.
3. **Give docs-rag and domain-research an RS256 path**, mirroring `ai-microservice`'s guard:
   verify with `JWT_PUBLIC_KEY` first, fall back to HS256 only while
   `ALLOW_HS256_FALLBACK !== 'false'`. Mint per-pair principals for their ~10 caller repos.
   This is the only step needing real code and coordination.
4. **Flip `ALLOW_HS256_FALLBACK=false`** on both once every caller is re-minted, then
   **rotate `366a1388`**. At that point it verifies nothing and rotation is cheap.
5. **Split `278bf2fc`** last, when auth's own HS256 issuance is fully retired — it is the
   live signing key and must not move before then.

Steps 1 and 2 are safe today and touch four sessions' repos. Step 3 is the real work.

### 4. Phase 6 — the monitor existed and had been failing silently for four days

`shared/scripts/token-health/` was already written (audit + guard + timer + installer). It
works: run against the live cluster it enumerates **186 mounts** from running pods, decodes
each JWT, and reports algorithm, days-to-expiry, sharing and privilege — `34 critical, 0 warn,
0 error, 39 ok`. It independently confirmed this session's own fix (`suppliers-microservice
CATALOG/WAREHOUSE_SERVICE_TOKEN`, RS256, 89 days). All 34 criticals are HS256 remnants in
other sessions' scope, correctly flagged as structurally dead whatever their expiry.

**But it had never produced a single alert.** `statex-token-health.timer` was installed and
firing daily; the service exited **2 on every run from 2026-08-28 to 2026-08-31**:

```
mkdir: cannot create directory '/var/lib/statex': Permission denied
ERROR: cannot create state directory /var/lib/statex/token-health
```

The unit runs as `ssf` (deliberately — Telegram delivery and cluster reads both use that
user's credentials) but the guard's own `mkdir -p` targeted root-owned `/var/lib`. Four
scheduled runs, four failures, no reading taken, nobody told.

**The thing built to catch silent credential failures was itself failing silently.** The
guard's shell-level discipline was fine — it exited 2 and wrote the reason to the journal,
exactly as designed. The gap was one level up: **a systemd unit going red notifies nobody.**
`SuccessExitStatus=0 1` correctly distinguishes "findings reported" from "could not run",
and then nothing consumed the distinction.

Two fixes:

1. `StateDirectory=statex/token-health` on the unit, so systemd creates the directory owned
   by `User=` before `ExecStart`, plus an explicit `TOKEN_HEALTH_STATE_DIR`. Verified by
   running the guard with a writable state dir: exit 0, baseline written, **186 mounts**.
2. `OnFailure=statex-token-health-failure.service` — a new companion unit and
   `token-health-failure-alert.sh` that pulls the real `ERROR` lines from the journal and
   sends them to the same Daily Digest Telegram channel the findings would have used, via
   the same `deploy-queue/notify.sh` (no duplicated credential). Exit 1 stays in
   `SuccessExitStatus`, so this fires only on genuine operational failure.

**Tested live, not asserted:** the failure alert was run against the unit that really failed
this morning and delivered — `[notify] sent to Telegram (HTTP 201)`. Both unit files pass
`systemd-analyze verify` clean.

**One step outstanding and it needs root:** installing the updated units requires a password
this session does not have.

```bash
sudo cp /home/ssf/Documents/Github/shared/scripts/token-health/statex-token-health.service \
        /home/ssf/Documents/Github/shared/scripts/token-health/statex-token-health-failure.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start statex-token-health.service   # confirm exit 0/1, not 2
```

Until that runs, the timer keeps firing the **old** unit and credential expiry stays
unmonitored. Everything else in this section is live.

**The lesson generalises past this unit:** a monitor's own health is not covered by the
monitor. Anything scheduled that reports only by exiting non-zero needs a path that carries
that failure to a human, or it provides the appearance of coverage rather than coverage.
Five expired credentials caused outages because nothing was watching; a sixth would have
been missed again because the watcher was broken and equally quiet.
