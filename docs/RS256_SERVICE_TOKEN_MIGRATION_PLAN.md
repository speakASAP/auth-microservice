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
no production data was touched. Fingerprints match minted = Vault on all five new keys.

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

**aukro -> catalog is still 401** and is not fixed here: `CATALOG_SERVICE_TOKEN` is unset,
so the chain reached `a2880693`, which catalog correctly rejects. That lane needs its own
principal. `JWT_TOKEN` has been removed from aukro's warehouse chain so it can no longer
convert a missing token into a confusing 401.

**This is the third instance of the same pattern in two days** (speakasap lessons, flipflop
stock, aukro stock). The common shape is a client that returns an empty collection or a zero
on a caught HTTP error. Grepping for `return []`, `return 0`, and `return null` inside a
`catch` around an HTTP call would likely find more.

### Still open

- **`a2880693` itself is not yet retired.** Six orders lanes are migrated, but the value is
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
- [ ] `flipflop-warehouse-token` override removal — **analysed and safe (all three fingerprints `59415e97`), blocked on a permission denial**; exact command in 6p
- [ ] `suppliers-microservice` `stock-traceability-runtime-token` — orphan confirmed, but **load-bearing** (neither key is in the ESO secret); needs Vault + ESO work first — see 6p
- [ ] `aukro` / `bazos` warehouse clients — identical silent-failure defect, left for Session A; exact lines in 6p
- [ ] **allegro-service -> warehouse is 401** — un-hidden by `e814c43`, confirmed pre-existing by raw fetch (only credential is `WAREHOUSE_INTERNAL_SERVICE_TOKEN` fp `3f3235bd`); same lane as the `allegro-imports` 401 under Phase 2 — see 6p
- [ ] docs-rag-microservice — needs `JWT_PUBLIC_KEY` before its flag can close
- [~] Phase 2 — split `369e4f3c…` — re-scoped (6h). **allegro->orders live (6i)**, **marketing->orders staged (6j)**, **`369e4f3c…` deactivated (6k)**; remaining: allegro-imports->warehouse (401 in prod, pre-existing) and marketing->allegro replay lane
- [ ] Phase 3 — category A remainder
- [ ] Phase 4 — category C
- [~] Phase 5 — category D — **six orders lanes off `a2880693` (6q)**: aukro, bazos, heureka,
  warehouse, payments migrated to per-pair RS256; marketing already live from 6j. The value
  itself is NOT yet retired — still mounted in `MARKETING_API_TOKEN`, `logging JWT_TOKEN`,
  the marketing aukro/bazos replay tokens, runlayer, and 2 dormant keys. **3 of the 4
  "unused" mounts in the brief were verified load-bearing — do not delete them.**
- [ ] Phase 6 — rotation CronJob
