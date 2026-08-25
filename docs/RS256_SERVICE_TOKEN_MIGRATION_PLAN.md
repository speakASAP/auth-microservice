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

#### Remaining services, by exposure

| Service | Routes | `@Roles` today | Priority |
| --- | --- | --- | --- |
| `warehouse-microservice` | 45 | **42 + 3 public** | **done** (`a8f76d0`) |
| `orders-microservice` | — | 19 / 13 distinct | reference; only needs the deny-by-default fix |
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

## 7. Progress

- [x] Phase 0 — logging, script, Dockerfile (`eb03ddb`, live)
- [x] Phase 0b — standard revised, scripts consolidated
- [x] Phase 1 — catalog → warehouse pilot **(complete 2026-08-25, monitor 11/11 green)**
- [~] Phase 1a — role model (warehouse **deployed and verified** `a8f76d0` + `c4f5427`; readonly role row not yet seeded; other services not started)
- [ ] Phase 2 — split `369e4f3c…`
- [ ] Phase 3 — category A remainder
- [ ] Phase 4 — category C
- [ ] Phase 5 — category D
- [ ] Phase 6 — rotation CronJob
