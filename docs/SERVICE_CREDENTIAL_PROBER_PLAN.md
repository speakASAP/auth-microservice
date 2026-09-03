# Service Credential Prober — Plan

Date: 2026-09-02 (last updated 2026-09-03)
Status: Phase 1 receiver shipped. Phase 1b: C, D, E done 2026-09-02; A (consumer
reporters) in progress — Wave 1 (suppliers) shipped 2026-09-03, 13 repos remain;
B depends on A
Owner decisions recorded 2026-09-02 — see "Decisions and corrections"

## Context

Service-to-service auth across the ecosystem works until a credential silently
stops working, and then it is discovered by a user-visible failure. Three
incidents in the last three weeks share one shape: **the credential looked
healthy and was not.**

- **2026-08-18** — auth retired HS256. 41 tokens, several with `exp` in 2027,
  became unverifiable everywhere at once. An `exp`-based check would have called
  every one of them healthy.
- **2026-09-01** — `~/.claude/logging-admin-token` expired, and the rotation job
  that should have replaced it had been failing since 2026-08-25 because it logs
  in as an account this migration deactivated. `logs_health` still reported the
  token file present, so the failure read as a logging outage.
- **2026-09-02** — `catalog-contract-monitor` had `JWT_TOKEN: value: ""`
  hardcoded in its CronJob. Every scheduled smoke run authenticated with no
  credential at all and 401'd. The real token was in Vault and synced into the
  secret the whole time.

None of these were detected by monitoring. The third was found by reading a pod
list while verifying an unrelated deploy.

The common failure is that **nothing asks the receiving service whether a
credential is actually accepted.** `shared/scripts/rotate-logging-admin-token.sh`
already got this right — its `token_accepted()` asks logging-microservice rather
than trusting `exp` — but it covers exactly one credential, and its mint path is
now dead (see `RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` 6az).

### Goal

Every issued service credential is probed on a schedule against the service that
consumes it. A rejection alerts before it becomes a production failure.

### Non-goal

This does not change how credentials are issued, rotated, or stored, and does not
migrate remaining static tokens to per-pair principals. It observes what exists.
Rotation is a separate follow-up that this work makes safe to automate, because
after this there is a signal to prove a rotation worked.

## Current state

**23 active per-pair principals**, `svc-<caller>--<target>@internal.alfares.cz`,
RS256, 90-day. Issued by `auth-microservice/scripts/provision-service-token.js`.
Roles enforced by receivers via `POST /auth/validate` or a local RS256 verifier.

Alongside them, two other shapes still exist:

- Vault-synced static strings, consumed as `*_SERVICE_TOKEN` env vars and
  compared by string equality (`InternalServiceGuard`).
- At least one literal in a manifest — the empty `JWT_TOKEN` above.

Nothing tracks when any of them was issued or when it expires.

## Design

A `CredentialWatcher` in `monitoring-microservice`, a sibling of the existing
`src/alerts/health-watcher.ts`. That file is the template on purpose: it already
solves scheduling, per-item error isolation, and — most importantly — the
alert-noise problem, having caused three false-outage incidents before it learned
to distinguish a config fault from a real one.

### Where each piece comes from

| Need | Reuse |
|---|---|
| schedule | `@Cron`, as `HealthWatcher.scheduledCheck` |
| fire / clear lifecycle | `AlertsService.fire()` (fingerprint dedup) and `.resolve()` |
| delivery | `AlertNotifier` + `NotificationsClient` |
| structured logging | `LoggingService` |
| inventory source | auth DB `users` + `user_roles` |

No new alerting, storage, or delivery path.

### Probe semantics

For each principal, ask the **receiving** service whether the credential is
accepted, and classify the answer three ways. This distinction is the whole
design — collapsing it is what makes a prober noisy enough to be muted:

| Result | Meaning | Action |
|---|---|---|
| `2xx` | accepted | clear any active alert |
| `401` / `403` | **rejected** — expired, revoked, wrong alg, wrong role | fire |
| anything else | indeterminate — receiver down, network, DNS | **do not fire**, do not clear |

A receiver being down is a *health* problem that `HealthWatcher` already owns.
Firing a credential alert for it would double-report one incident and train the
channel to ignore both. This mirrors `token_accepted()`'s existing return codes
(`0` accepted, `1` rejected, `2` indeterminate).

### Inventory

Enumerate from the auth DB rather than a hand-maintained list — a list drifts,
and drift is the failure being fixed:

```sql
SELECT u.id, u.email, r.scope, a.name AS target, r.name AS role
FROM users u
JOIN user_roles ur ON ur."userId" = u.id
JOIN roles r  ON r.id = ur."roleId"
JOIN applications a ON a.id = ur."applicationId"
WHERE u.email LIKE 'svc-%@internal.alfares.cz'
  AND u."isActive" = true;
```

The `svc-<caller>--<target>` convention names the target, so the probe endpoint
is derivable from the principal. Principals whose target cannot be resolved are
**reported as unprobeable**, never silently skipped — a credential nobody can
probe is exactly the one that fails quietly.

### Expiry horizon

Probing catches a credential that has *already* failed. To catch one before it
does, decode `exp` and warn at **14 days** remaining (90-day lifetime, so this
leaves several rotation attempts).

`exp` is a **secondary** signal and never a substitute for the probe — 2026-08-18
is the proof, where every token had a valid `exp` and none worked.

### Static tokens

Per-pair principals are enumerable and probeable. The static `*_SERVICE_TOKEN`
strings are not: they carry no identity, so there is nothing to enumerate and no
way to attribute a rejection.

Phase 3 covers them from the other direction — assert that each expected env var
is **non-empty and structurally a JWT** where one is expected. That alone would
have caught the empty `JWT_TOKEN`. It is a weaker check than a probe, and the
right long-term answer is migrating those lanes to per-pair principals, which
`RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` already tracks.

## Phases

Each phase ships independently and is useful alone.

### Phase 1 — read-only reporter

`CredentialWatcher` enumerates principals, probes each, logs a structured result.
**Fires no alerts.** Adds an admin endpoint returning the current matrix.

Deliberately silent: it establishes the real rejection rate first. Wiring alerts
before knowing the baseline is how a channel gets muted on day one.

- `monitoring-microservice/src/alerts/credential-watcher.ts`
- `credential-watcher.spec.ts` — 2xx clears, 401/403 fires, 5xx/timeout does
  neither, unresolvable target is reported not skipped
- endpoint alongside `alerts.controller.ts`

**Exit criteria:** one week of clean runs, every one of the 23 principals either
consistently accepted or explained.

### Phase 2 — alerting

Wire to `AlertsService.fire()` / `.resolve()` with a per-principal fingerprint so
a persistent failure is one alert, not one per run. Add the 14-day expiry warning
at a lower severity than a rejection.

**Exit criteria:** a deliberately revoked test principal fires within one cycle
and clears within one cycle of being restored.

### Phase 3 — config assertions

Assert that every deployment expected to hold a service credential has one that
is non-empty and structurally a JWT. Catches the empty-literal class directly.

**Exit criteria:** reproduces the `catalog-contract-monitor` finding from a clean
checkout of the pre-fix manifest.

## Verification

Phase 1 is verified against **known-bad** credentials, not only healthy ones — a
prober that has never seen a rejection is untested:

1. **Known-good** — all 23 active principals return accepted.
2. **Known-bad, expired** — mint a principal with `--expires-in=1s`, confirm the
   probe classifies `rejected` and not `indeterminate`.
3. **Known-bad, deactivated** — deactivate a scratch principal, confirm
   `rejected`; reactivate, confirm it clears.
4. **Indeterminate** — point a probe at an unreachable port, confirm it neither
   fires nor clears.
5. **Regression against history** — confirm the checker would have caught:
   - the empty `JWT_TOKEN` (Phase 3 assertion),
   - the expired logging token (Phase 1 probe),
   - an HS256-signed token post-cutover (Phase 1 probe, `rejected`).

Test principals are created with `provision-service-token.js --dry-run` first and
deactivated afterwards. No production credential is used as a test fixture.

## Risks

- **Probe traffic is authentication load.** 23 principals × every 15 min is
  small, but it hits `/auth/validate` on the hot path. Start at 30 min; make the
  interval configurable, as `HEALTH_WATCH_CRON` already is.
- **A probe endpoint with side effects.** Probe a read-only endpoint per target
  and never infer liveness from a write. Where no safe read exists, report the
  principal unprobeable rather than inventing a call.
- **Alert fatigue.** The three-way classification and fingerprint dedup exist for
  this. If Phase 1 shows a noisy baseline, fix the cause before enabling Phase 2.
- **The prober needs its own credential**, which can itself expire — the failure
  this exists to prevent. It must alert through `AlertNotifier` on its own auth
  failure, and that path must not depend on the credential being probed.

## Open questions for the owner

1. **Alert delivery** — same channel as `HealthWatcher`, or separate? Credential
   expiry is lower-urgency than an outage and may deserve its own route.
2. **Auth DB access from monitoring** — read the inventory directly, or expose a
   read-only endpoint on auth? An endpoint is cleaner but is new public surface
   on the most sensitive service. Recommend the endpoint, scoped to an internal
   role.
3. **Scope of Phase 3** — every deployment, or only those with a known credential
   contract? Recommend the latter first, to avoid asserting on env vars whose
   emptiness is legitimate.

## Decisions and corrections (2026-09-02)

Owner decisions: inventory via a read-only endpoint on auth; alerts share the
`HealthWatcher` channel; Phase 3 asserts only on deployments with a known
credential contract; Phase 1 only this session.

Implementation surfaced four facts that contradict the plan above. The code
follows the facts; this section records where the plan was wrong so it is not
re-derived later.

### 1. The inventory query missed a third of the fleet

The plan selects on `email LIKE 'svc-%@internal.alfares.cz'`. Production holds
**45 service principals, 42 active**. Of the 42 active, **18 do not match** the
address convention the plan filters on. They are equally real — several on unroutable domains (`@internal.invalid`,
`@internal.alfares`, `@alfares.local`), and two missing the convention by one
domain segment (`svc-suppliers-microservice--catalog-microservice@alfares.cz`).

Selecting by address would have dropped nearly half the fleet silently, which is
the same class of failure the prober exists to catch. The implementation selects
on `userType = 'service'` and reports the convention as metadata.

### 2. The address does not name the probe target

The plan states "the `svc-<caller>--<target>` convention names the target, so the
probe endpoint is derivable from the principal." It is not. Many principals hold
a role on the *caller*, not the target:

- `svc-allegro-service--orders-microservice` → role application `allegro-service`
- `svc-catalog-microservice--bazos-service` → role application `bazos-service`
- `svc-warehouse-microservice--orders-microservice` → role application `warehouse-microservice`

This is not an edge case: **14 of the 42 active principals** have an address
naming a service that none of their grants match. The role grant's application is
what the receiver enforces, so probing the address-derived target would query the
wrong service for a third of the fleet and read its answer as a verdict on this
credential. One principal holds grants across several applications, so the target
is not even one-to-one.

The endpoint returns grants and flags `targetMismatch` rather than pretending a
single derivable target exists.

### 3. The plan's SQL used an inner JOIN on a nullable column

`user_roles.applicationId` is nullable (global roles). The plan's
`JOIN applications` would drop those grants entirely — silently skipping
principals, which the plan elsewhere forbids. The implementation uses LEFT JOINs
throughout and keeps null-application grants visible.

### 4. Central probing was replaced by consumer self-reporting

The plan never says where the prober gets each credential's token. Auth does not
store issued JWTs; they live in Vault and sync into each consumer's own secret.
A central prober would therefore need read access to every service token, making
monitoring-microservice able to impersonate the whole ecosystem in order to watch
it — a worse exposure than the failures being prevented.

Decision: each consumer probes its own credential and posts the verdict. No
secret leaves its owner, and the verdict reflects the genuinely deployed
credential. Contract:
`monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md`.

Consequence: **silence becomes the primary signal.** A broken credential usually
stops reporting rather than reporting failure, so `silent` (exists in auth, never
reported) and `stale` (past TTL) are first-class statuses alongside the plan's
three.

### Blocker for Phase 2

The 14-day expiry horizon has **no data source**. All 44 active service role
grants have `user_roles."expiresAt" IS NULL`, and auth stores no issued token, so
neither the DB nor the inventory endpoint can supply `exp`. The expiry warning
needs either a token-issuance record in auth or the `exp` decoded by each
consumer and included in its self-report. Unresolved.

## Phase 1 — as built

Auth (`auth-microservice`):
- `src/users/service-principals.service.ts` — inventory, convention and mismatch detection
- `src/users/internal-service-principals.controller.ts` — `GET /internal/service-principals`, `InternalServiceGuard`
- `src/users/service-principals.service.spec.ts` — 8 tests

Monitoring (`monitoring-microservice`):
- `src/alerts/credential-watcher.ts` — reconciler, fires no alerts
- `src/alerts/credentials.controller.ts` — `POST /api/credentials/report`, `GET /api/credentials`
- `src/alerts/dto/credential-report.dto.ts`
- `src/alerts/credential-watcher.spec.ts` — 9 tests
- `docs/CREDENTIAL_SELF_REPORT_CONTRACT.md`

Validation: auth 229/229 tests, monitoring 63/63, both `nest build` clean.

Deployed 2026-09-02: auth `01c6cb1`, monitoring `ab27a7a`, both ready with zero
restarts. `GET /internal/service-principals` is live and returns 401
unauthenticated, so the guard is enforcing.

~~**The watcher is inert in production.** Its `INTERNAL_SERVICE_TOKEN` was never
wired into the monitoring pod, so no sweep can run — Task E.~~

**Resolved 2026-09-02 by Task E.** The watcher now authenticates with its own
per-pair RS256 principal rather than the shared static string, and sweeps
complete against production. See Task E.

**Exit criteria not yet met.** The plan requires one week of clean runs with all
principals accepted or explained. No consumer reports yet, so every principal
reconciles as `silent` — a truthful reading of the current state: nothing is
checking these credentials. The remaining Phase 1 work is consumer adoption
across ~20 repos, per the contract document.

## Phase 1b — closing the four findings

Written 2026-09-02, after the Phase 1 receiver shipped (auth `01c6cb1`,
monitoring `ab27a7a`).

Findings 1, 2 and 3 are already corrected **in the receiver's own code**: it
enumerates by `userType`, resolves targets from role grants, and LEFT JOINs
throughout. What none of them is yet corrected in is *the fleet* — the receiver
now reports the mess accurately instead of hiding it, and this phase acts on
what it reports. Finding 4's consequence, consumer adoption, is the bulk of the
work.

Phase 1b is what actually satisfies Phase 1's original exit criteria: "one week
of clean runs, every one of the principals either consistently accepted or
explained." Today every principal reads `silent`, so that criterion is not close
to met.

### Task A — consumer reporters (finding 4)

Each service probes its own credential and posts the verdict, per
`monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md`.

Ownership is only partly derivable. For the 24 principals following
`svc-<caller>--<target>`, the address names the caller and therefore the repo
that must implement the reporter. Note the repo name differs from the service
name for every marketplace connector — the principal says `allegro-service`, the
repo is `allegro/`:

| Repo | Service name |
|---|---|
| `allegro` | allegro-service |
| `aukro` | aukro-service |
| `bazos` | bazos-service |
| `heureka` | heureka-service |
| `flipflop` | flipflop-service |
| `cliplot` | cliplot |
| `catalog-microservice` | catalog-microservice |
| `warehouse-microservice` | warehouse-microservice |
| `orders-microservice` | orders-microservice |
| `payments-microservice` | payments-microservice |
| `invoices-microservice` | invoices-microservice |
| `marketing-microservice` | marketing-microservice |
| `suppliers-microservice` | suppliers-microservice |
| `monitoring-microservice` | monitoring-microservice |

All fourteen repos exist locally and are deploy-eligible.

For the remaining 18 off-convention principals the caller is **not** derivable
from the address: `orders-action-admin`, `payments-admin-smoke`,
`catalog-warehouse-service` and similar name a role or a service pair, not a
caller. Assigning these is part of Task B, not an input to it — several are
expected to be dead rather than unowned, and guessing an owner for a dead
principal creates work that should not exist.

The exact per-repo principal counts therefore follow Task B, not this table.

A shared reporter module is written once and vendored, rather than hand-written
fourteen times: fourteen independent implementations of the accepted/rejected/
indeterminate rule will not classify identically, and a reporter that calls a
timeout `rejected` produces exactly the false alert Phase 2 must not fire.

**Exit criteria:** every active principal reports at least once; `silent` count
reaches zero or each remainder has a written reason.

#### Shared module and pilot, 2026-09-02

`shared/packages/credential-reporter` (`3140b7a`, CJS fix `e3dee65`), vendored
by `shared/scripts/sync-credential-reporter.sh` following `sync-consent.sh`.
16 tests, zero dependencies. Pilot adoption in `monitoring-microservice`
(`87990a8`), verified in production: `{"verdict":"accepted","posted":true,
"status":201}`, reconciling to `accepted` with `daysUntilExpiry: 90`.

**Finding: a probeable read is rarer than the plan assumed, and this is the
constraint that will shape the rollout.**

monitoring was chosen as pilot because auth's `GET /internal/service-principals`
enforces `internal:auth-microservice:readonly` — exactly the role its credential
holds — so 200 proves the credential and 401/403 disproves it.
`warehouse-microservice`, examined first, has no such route:

- `internal:warehouse-microservice:service` appears on **exactly one** orders
  route, `PUT /:id/warehouse-fulfillment-status`. The contract forbids probing
  with a write, and a probe every 30 minutes that mutates state is a scheduled
  corruption job.
- `GET /api/orders` returns **403** — the credential authenticates but lacks
  that role. Probing it would report `rejected` for a healthy credential.
- `GET /health` returns **200 with no credential at all** (verified
  unauthenticated). Probing it would report `accepted` for a service holding an
  empty token — the `catalog-contract-monitor` failure exactly, reproduced by
  the tool built to detect it.

So warehouse→orders is **unprobeable** and must stay `silent`, which is true,
rather than be given a probe that cannot fail. Before writing each remaining
reporter, check that a read-only route genuinely enforcing that principal's role
exists. Where none does, the honest options are to add one to the receiver, or
record the principal as unprobeable — never to point the probe at `/health`.

This also revises the estimate: the 3–4 day vendoring figure assumed each repo
needed a copy and a config. Repos needing a *new receiver endpoint* first are
larger, and how many there are is not yet known.

**Two implementation notes for the next adopter:**

- The module is **CommonJS**, not ESM like `shared/packages/consent`. That
  package is browser-served; this one is imported by NestJS compiled to CJS,
  where `export` fails at `require()` with `Unexpected token 'export'`.
- The vendored `.js` must be registered as a **nest-cli asset**, or it is absent
  from `dist/` and the service throws `MODULE_NOT_FOUND` at boot. Tests pass
  either way, because ts-jest resolves from source — this only appears in a
  running pod. Verify by requiring the built file directly, not by running the
  suite.

#### Wave 1 shipped 2026-09-03 — suppliers-microservice

`suppliers-microservice` `87ec2f8`. One reporter, not two, and the reason the
count is one is the finding worth keeping.

| Principal | Grant | Outcome |
|---|---|---|
| `svc-suppliers-microservice--warehouse-microservice@alfares.cz` | `warehouse-microservice:admin` | reporter — probes `GET /api/stock/:productId` |
| `svc-suppliers-microservice--catalog-microservice@alfares.cz` | `catalog-microservice:service` | **unprobeable**, stays `silent` |

**catalog is unprobeable, and this generalises beyond suppliers.**
`catalog-microservice/src/auth/catalog-auth.guard.ts` derives a caller's grants
from the `SERVICE_NAME` **header**, not from the JWT's role, and falls back to
read access for any unlisted name (`grants[source] ?? READ`). A catalog GET
therefore returns 200 for a credential that has been revoked, expired, or is the
wrong algorithm entirely. Probing it would report `accepted` for a credential
nobody is enforcing — the `catalog-contract-monitor` failure of 2026-09-02
reproduced inside the tool built to detect it.

This is a **live authorization gap in catalog**, not merely a probing
inconvenience, and it applies equally to
`svc-aukro-service--catalog-microservice`. Both stay `silent` until catalog grows
a read-only route that enforces the token's own role. That route is the
prerequisite for any catalog reporter and is not scheduled here.

`/api/health` was rejected as a probe target for the mirror-image reason: it
answers 200 with no credential at all, so it can never fail.

**Probeability is better than Task A's first note implied.** That note
generalised from warehouse→orders. Checking every active pair against the
receivers' real role constants, most convention principals do have a genuine
read-only target: `ORDER_CHANNEL_LIFECYCLE_READ_ROLES`, `ORDER_DETAIL_READ_ROLES`,
`PRODUCT_SALES_STATISTICS_READ_ROLES` and `ORDER_AFFINITY_REPLAY_READ_ROLES` on
orders, `WAREHOUSE_READ_ROLES` on warehouse, and `LogReadRoleGuard` on logging
cover roughly 20 of the 24. warehouse→orders is the exception, not the rule.

**The 14 repos are three populations, and the estimate was priced for one.**
Only `suppliers-microservice` was already Nest + `@nestjs/schedule`. Five Nest
repos (orders, warehouse, payments, invoices, catalog) have no scheduler and need
`@nestjs/schedule` plus `ScheduleModule.forRoot()`. Seven are not NestJS at all
(allegro, aukro, bazos, heureka, flipflop, cliplot, marketing), so the
`@Injectable`/`@Cron` wrapper does not transfer — the vendored module is portable
CJS, but each needs its own host. The "3–4 days, a copy and a config" figure holds
only for the first group.

**A prerequisite that will recur.** `NOTIFICATION_SERVICE_TOKEN` was absent from
the suppliers pod, so the reporter would have probed correctly and then failed to
deliver. Added to Vault (`secret/prod/suppliers-microservice` v19, other 9 keys
preserved) and the ExternalSecret, with `MONITORING_URL` in the ConfigMap. **Vault
value first, manifest second** — ESO fails an ExternalSecret whose remote property
is missing and then stops refreshing every key for that service. Expect the same
two entries in each remaining repo.

This repo has no jest toolchain, so verification follows its existing
`scripts/verify-*.js` convention (`npm run verify:credential-self-report`, 10
checks) rather than introducing one. The check that matters is that the vendored
module reached `dist/`: a missing nest-cli asset entry throws `MODULE_NOT_FOUND`
at pod boot while a source-resolving suite passes either way.

**Result.** The 05:00Z sweep logged
`43 principal(s): 1 accepted, 0 rejected, 0 indeterminate, 42 silent, 0 stale`
— the first non-silent principal in the fleet, and the first end-to-end exercise
of the receiver Task D shipped.

**A trap worth recording: `NOTIFICATION_SERVICE_TOKEN` is not the key name in
Vault.** The first report probed correctly and came back
`{"verdict":"accepted","posted":false,"status":403}` — the verdict was right and
the delivery was refused, so the principal would have stayed `silent` with
nothing obviously broken.

Cause: monitoring's ExternalSecret maps env `NOTIFICATION_SERVICE_TOKEN` from
Vault property **`NOTIFICATIONS_SERVICE_TOKEN`** (plural, `external-secret.yaml`
line 37-40). Both keys exist in `secret/prod/monitoring-microservice` with
different values, and the singular one is stale. `MonitoringIngestGuard` compares
against monitoring's own running value, so copying the singular key produced a
token that no guard accepts.

Copy the **plural** `NOTIFICATIONS_SERVICE_TOKEN` when wiring each remaining
reporter (suppliers is on v20). Verify by fingerprint — `sha256 | cut -c1-12` of
the value in the consumer pod against the same in monitoring's pod — never by
reading either value. A length match proves nothing here: both are 64 chars.

Note also that a pod holds the env value it booted with. ESO refreshing the
Secret does not update a running container, so a token change needs a restart —
the same trap Task E recorded for the watcher's own credential.

**Negative verification, run against the live receiver** (no scratch principal
minted, no production credential used as a fixture):

| Case | Result |
|---|---|
| garbage token | `rejected` (401) — not indeterminate |
| empty token | `rejected` before any request is sent |
| unreachable port | `indeterminate` — a receiver outage fires no credential alert |

The empty-token case is the `catalog-contract-monitor` failure of 2026-09-02
exactly, and the module refuses to call it `accepted`.

#### Wave 2 shipped 2026-09-03 — orders, catalog, invoices

`orders-microservice` `eb40afe`, `catalog-microservice` `22262e8`,
`invoices-microservice` `be968f6`. Three reporters from five repos, and the gap
between those numbers is the finding.

All five needed `@nestjs/schedule` — **v4, not v6**: these run NestJS 10 while
suppliers runs 11, so the version that works in the Wave 1 template is wrong here.

**Two of the five get no reporter at all.** Wave 2 was scoped as five repos; the
probe-target audit removed two:

| Repo | Principal | Outcome |
|---|---|---|
| orders | `svc-orders-microservice--warehouse-microservice` (`warehouse:action-admin`) | reporter — `GET /api/stock/:id` |
| catalog | `svc-catalog--warehouse` (`warehouse:readonly`) | reporter — `GET /api/stock/:id` |
| invoices | `svc-invoices-microservice--orders-microservice` (`invoices:service`) | reporter — see the caveat below |
| **payments** | `svc-payments-microservice--orders-microservice` (`payments:service`) | **unprobeable** — role appears only on `PUT /:id/payment-status`, a write |
| **warehouse** | `svc-warehouse-microservice--orders-microservice` (`warehouse:service`) | **unprobeable** — role appears only on `PUT /:id/warehouse-fulfillment-status` |

Two further principals in these repos are unprobeable for different reasons:

- `svc-catalog-microservice--orders-microservice` — **no credential is deployed
  for it.** catalog's pod holds `WAREHOUSE_SERVICE_TOKEN` and
  `BAZOS_SERVICE_TOKEN` and no orders token at all, so there is nothing to probe
  with. A principal that exists in auth with no deployed credential is a Task B
  finding, not a reporter gap.
- `svc-catalog-microservice--bazos-service` — bazos enforces no roles anywhere.
  Its controllers carry `@Get` with no `@Roles` decorator, so any GET returns 200
  regardless of credential: the `/health` problem across a whole service.

**A probe can be valid-credential-scoped rather than role-scoped, and that is
worth recording rather than hiding.** invoices' credential is scoped to
`ORDER_DETAIL_READ_ROLES` (`GET /api/orders/:id`), which could not be used:
`ParseUUIDPipe` plus a nonexistent id returns 404 → `indeterminate`, and probing
a real order id would tie a credential check to specific rows surviving in the
database. `GET /api/orders/customer/lifecycle` is used instead, but its role set
includes `'authenticated:user'`, so it accepts any valid principal.

That probe catches expiry, revocation, wrong algorithm and the empty-token case —
the failure classes this plan was written about — but would not catch this
principal losing only its `invoices-microservice:service` grant. It is weaker
than a role-scoped probe and much stronger than `/health`. The reporter says so
in its own comment, so nobody reads a green row as more than it is.

**The ingest credential is now sourced cross-path, not copied.** Wave 1 copied
monitoring's token into suppliers' Vault path, which works but can drift. These
three reference `secret/prod/monitoring-microservice` property
`NOTIFICATIONS_SERVICE_TOKEN` directly from their own ExternalSecrets — the
established cross-path pattern in these manifests — so there is one source of
truth and no copy to re-sync when it rotates. All three synced `SecretSynced`
with the fingerprint matching monitoring's running pod.

**The nest-cli asset trap fired anyway, and the check that was supposed to catch
it passed.** invoices crashlooped on boot with
`Cannot find module './vendor/credential-reporter.js'` (6 restarts), and the
deploy worker then reported FAILED because that rollout never went ready — one
fault, two alarming symptoms.

The asset entry was present. The problem was *where it landed*: invoices has no
`rootDir`, so tsc infers it from the widest include and emits to `dist/src/...`,
while nest-cli resolves an asset `include` against `sourceRoot` and dropped the
file at `dist/common/vendor`. Both paths existed; only one was where the
compiled code looks. Fixed with `outDir: dist/src` on the asset entry
(`38b1adb`).

The verify script was the real defect. It asserted a **hardcoded** dist path, so
it confirmed a file that nothing loads and passed while the pod died. It now
locates the compiled reporter wherever it landed and looks for
`./vendor/credential-reporter.js` relative to that — the resolution Node
actually performs — and was confirmed to fail when the file is removed, because
a check that has never failed is untested. Propagated to orders, catalog and
suppliers (`f219504`, `5aacc75`, `683d63a`), whose layouts happen to match the
old hardcoded path today.

**Generalise before the next wave: do not assume `dist/<module>/vendor`.** Check
where each repo's build actually emits, and let the check derive the path rather
than restate it.

**The fix then deadlocked against the deploy runner's own safety check, which is
worth knowing before it happens again.** `deploy.sh` preflight refuses to deploy
a service that already has unhealthy pods — correct in general, and here it
rejected the very commit that would clear the crashloop, failing in 1 second
rather than the 654 the first attempt took. A one-second failure is a
precondition, not a build.

Breaking the deadlock: `kubectl rollout undo` to the last good revision (25)
removed the crashlooping ReplicaSet, after which preflight passed and the fix
deployed OK in 81s with the queue logging `RESOLVED — clear event sent`.
Throughout, the previous good pod kept serving, so there was no outage — the
failed rollout never took traffic.

Sequence to reuse: roll back first, then redeploy the fix. Deploying the fix on
top of a crashloop cannot work by design.

**Running total: 5 reporters deployed** — the monitoring pilot, suppliers
(Wave 1), and orders, catalog, invoices (Wave 2). **Six principals are confirmed
unprobeable with written reasons**: warehouse→orders, payments→orders (write-only
roles), suppliers→catalog, aukro→catalog (header-derived grants),
catalog→orders (no credential deployed), catalog→bazos (receiver enforces no
roles).

### Task B — reconcile the duplicate principals (finding 1)

Enumerating by `userType` surfaced principals the address convention was hiding,
and several are visibly redundant pairs:

- `allegro-service@alfares.local` and `allegro-service@internal.alfares`
- `aukro-service@internal.alfares.invalid` and `aukro-service@internal.invalid`
- `svc-monitoring--logging` and `svc-monitoring-microservice--logging-microservice`
- `svc-catalog--warehouse` and `svc-catalog-microservice--warehouse-microservice`

Several sit on domains that do not resolve (`@internal.invalid`,
`@internal.alfares`, `@alfares.local`). These look like the pre-standard/standard
pairs `RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` has been retiring.

Each must be classified as live, redundant, or already-dead. **A redundant
principal that still validates is a finding, not bookkeeping** — it is an
unrotated credential nobody is watching, which is this plan's subject.

Do not write a reporter for a principal in this set until it is classified;
that is how dead credentials acquire maintenance.

**Exit criteria:** every duplicate is retired or documented as intentionally
distinct. Retirement goes through the RS256 migration plan's process, not this
one.

#### Live data, 2026-09-02 — and the blocker it exposed

The first sweep after Task E gives the real numbers: **46 principals, 43
active**. Normalising each address (drop the domain, the `svc-` prefix and the
`-microservice`/`-service` suffixes) collapses them into **7 duplicate groups
covering 15 principals**:

| Group | Members | Grants |
|---|---|---|
| allegro | `allegro-service@alfares.local`, `allegro-service@internal.alfares` | both `allegro-service:service` |
| aukro | `aukro-service@internal.alfares.invalid`, `aukro-service@internal.invalid` | both `warehouse-microservice:admin` |
| catalog→warehouse | `catalog-warehouse-service@alfares.cz`, `svc-catalog--warehouse@internal.alfares.cz` | **`admin` vs `readonly`** |
| orders→warehouse | `orders-warehouse-service@internal.alfares.cz` (inactive), `…@internal.alfares.local`, `svc-orders-microservice--warehouse-microservice@…` | `admin`, `admin`, **`action-admin`** |
| suppliers→catalog | `suppliers-catalog-service@alfares.cz`, `svc-suppliers-microservice--catalog-microservice@alfares.cz` | both `catalog-microservice:service` |
| suppliers→warehouse | `suppliers-warehouse-service@alfares.cz`, `svc-suppliers-microservice--warehouse-microservice@alfares.cz` | both `warehouse-microservice:admin` |
| monitoring→logging | `svc-monitoring--logging@…`, `svc-monitoring-microservice--logging-microservice@…` | both `logging-microservice:readonly` |

Two groups are **not** clean duplicates and must not be retired as such: the
catalog→warehouse pair differs `admin` vs `readonly`, and orders→warehouse
spans `admin` and `action-admin`. Retiring the wrong member of either silently
removes authority a caller may depend on. The plan listed both as redundant
pairs; they are not.

The creation dates confirm the pre-standard/standard reading. Every
off-convention principal was created 2026-06-29 → 2026-07-06; every
`svc-<caller>--<target>` one from 2026-08-25 onward, when
`provision-service-token.js` became the single path. 18 of the 43 active sit on
a non-standard domain, six of them on `@internal.invalid`, which does not
resolve.

**Blocker: there is no liveness signal.** `users.lastActivity` reads `NEVER` for
all 46 principals — including `svc-monitoring-microservice--auth-microservice`,
created this session and used successfully against the inventory route minutes
before the query. All four writes to that column live in contact-based human
registration flows (`auth.service.ts`); nothing in service-token validation
touches it. `NEVER` therefore means *not instrumented*, not *unused*, and the
column cannot distinguish a live principal from a dead one.

So Task B cannot be completed from the auth DB as it stands. Classifying by
address shape alone would be exactly the guess this plan forbids — the
`@internal.invalid` group looks dead and would be *assumed* dead, which is how a
credential that still validates gets retired out from under a running caller.

Three ways forward, in preference order:

1. **Let Task A's reporters answer it.** A principal whose consumer reports is
   live by demonstration; one that stays `silent` after every repo has adopted
   the reporter is the candidate set for retirement. This needs no new write
   surface on auth and is the signal the whole plan is built on — but it
   inverts the stated sequencing, since B was meant to precede A.
2. **Instrument `lastActivity` on service-token validation.** One write in the
   validation path makes the column mean what its name implies. Cheap, but it
   is a write on auth's hot path and answers nothing about the past — every
   principal reads `NEVER` until each one is next used.
3. **Read it from outside auth.** Receiver access logs already record which
   principal presented a token. Authoritative and retrospective, but the query
   spans services and log retention bounds how far back it can see.

Recommend 1, with 2 alongside if the write is acceptable, because 2 makes the
question permanently answerable while 1 only answers it once. Either way **B is
now downstream of A, not upstream**, and the sequencing below is wrong as
written.

### Task C — resolve the address/grant mismatches (finding 2)

14 of 42 active principals have an address naming a service their role grants do
not match. The receiver flags these as `targetMismatch`.

The reporter makes this self-correcting in practice — a consumer knows which
receiver it actually calls, so it reports the true target regardless of what its
address claims. But the mismatch stays a latent trap for anyone reading the
inventory, and the address is what a human greps for during an incident.

Decide per principal: rename to match the grant, or record why the address is
misleading-but-correct. No code depends on the outcome; this is legibility.

**Exit criteria:** `targetMismatch` is zero, or each remaining case is
documented.

#### Resolved 2026-09-02 — documented, not renamed

All 14 active mismatches, read against live grants, fall into three classes.
None is a misconfiguration:

**Class 1 — caller-scoped `service` role (10 principals).** Every one of
`svc-<caller>--orders-microservice` holding `<caller>:service`:
allegro, aukro, bazos, catalog, flipflop, heureka, invoices, marketing,
payments, warehouse.

The address is right and the mismatch flag is a false positive. These callers
hold a role scoped to *themselves* — the `service` role on their own
application — and present it to orders-microservice, which enforces it. The
address names the pair correctly; `targetMismatch` only detects that the grant's
application is not the address's target segment, which for a caller-scoped role
it never will be. **No action.**

**Class 2 — abbreviated target (2 principals).** `svc-catalog--warehouse`
(grant `warehouse-microservice:readonly`) and `svc-monitoring--logging` (grant
`logging-microservice:readonly`). The target is correct but abbreviated, so
string equality against `warehouse-microservice` fails. Both are also members of
duplicate groups in Task B and are the *older* half of each pair; retiring them
there removes these two mismatches as a side effect. **Defer to B.**

**Class 3 — endpoint suffix in the address (2 principals).**
`svc-flipflop-service--orders-microservice-status` (grant
`orders-microservice:action-admin`) and `svc-cliplot--orders-microservice-create`
(grant `cliplot:service`). The address encodes a target *plus an operation*,
which the convention has no room for. The first is genuinely
orders-microservice-scoped and reads as a mismatch only because of the `-status`
suffix; the second is caller-scoped like class 1, with `-create` appended.

**Conclusion: no renames.** Renaming a principal changes the `sub` of every
issued token and forces a reissue across the fleet, to make a metadata flag
read zero. The flag is doing its job — it says "the address does not name the
enforced application", which is true and worth knowing during an incident. What
was wrong is the plan's assumption that a nonzero count means a defect.

`targetMismatch` will not reach zero and should not be expected to. Class 1
makes 10 of 14 permanent by construction: any caller-scoped role produces one.
The receiver already returns grants alongside the flag, so anyone reading the
inventory sees the enforced application directly and the flag is legible rather
than misleading. Task B's retirements will take the count from 14 to 12.

### Task D — unblock the expiry horizon (Phase 2 blocker)

All 44 active role grants have `expiresAt IS NULL` and auth stores no issued
token, so the plan's 14-day warning has no data source in any form.

Two options, and the self-report design makes the second nearly free:

1. Record token issuance in auth (`provision-service-token.js` writes an
   issuance row). Authoritative, but new write surface on the most sensitive
   service and it cannot see tokens minted before it existed.
2. **Have each reporter decode its own token's `exp` and include it in the
   self-report.** The reporter already holds the token, so this is one extra
   field on a payload being sent anyway, and it reports the credential genuinely
   deployed rather than what was issued.

Recommend option 2, added to the contract as an optional `expiresAt` field so
reporters can adopt it without a second round of changes. `exp` stays a
**secondary** signal: 2026-08-18 is the proof, where every token had a valid
`exp` and none worked.

**Exit criteria:** expiry is available for every reporting principal, so Phase 2
can warn at 14 days.

#### Done 2026-09-02 — option 2, receiver side

`monitoring-microservice` `b9f063c`. The contract gains an optional `expiresAt`,
and the receiver an `expiringSoon` / `daysUntilExpiry` annotation on every
reconciled row. `CREDENTIAL_EXPIRY_HORIZON_DAYS` defaults to 14 and is
configurable, because the fleet is not uniformly 90-day.

Three decisions worth keeping:

- **`expiringSoon` is not a sixth status.** It sits beside the status rather
  than replacing it, so a credential can be both `rejected` and expiring. Expiry
  never modifies a verdict — 2026-08-18 is why, where 41 tokens carried
  far-future `exp` values and none verified.
- **Absent means absent, not imminent.** An unset or unparseable `expiresAt`
  yields `expiringSoon: false` and no day count. Phase 2 alerts on that flag, so
  defaulting it true would fire on every reporter that has not yet adopted the
  field.
- **Reporters decode without verifying.** The receiver's verdict establishes
  validity; a reporter verifying its own token would be grading its own
  homework. The contract says to omit the field rather than send a guess.

8 new tests cover the horizon boundary, already-expired, absent and unparseable
input, and that a `rejected` verdict survives a healthy-looking expiry. 72/72
pass, `nest build` clean.

**Exit criteria are half met, and the remainder belongs to Task A.** The
receiver accepts and surfaces expiry; no reporter sends it yet, because no
reporter exists. Expiry becomes available per principal exactly as each consumer
adopts the reporter — the same adoption curve that resolves `silent`, and now
Task B as well.

### Task E — wire the watcher's own credential (found in production 2026-09-02)

`CredentialWatcher` shipped and runs, but `INTERNAL_SERVICE_TOKEN` is **absent
from the monitoring pod** — not empty, never wired. Only auth's manifests
reference that variable; monitoring's `k8s/external-secret.yaml` has no entry for
it. Every sweep therefore refuses to run and logs
`credential_watch_inventory_failed`, and the credential matrix stays empty.

This is the plan's own subject reproduced in the tool built to detect it: a
service authenticating with a credential that is not there, exactly the
`catalog-contract-monitor` shape from 2026-09-02. It failed loudly rather than
silently only because the watcher refuses to sweep without a token; a prober that
had treated a missing token as "nothing to report" would have shown a clean
matrix forever.

The risk section already anticipated this — "the prober needs its own credential,
which can itself expire — the failure this exists to prevent." It was missing
from the start rather than expiring.

**The decision this needs, which is why it belongs beside Task B and D rather
than as a quick fix:** `INTERNAL_SERVICE_TOKEN` is auth's shared static string,
compared by string equality in `InternalServiceGuard` and held by every service
that calls auth's internal routes. Adding it here would reverse the direction
this repo already moved in — see the `TASK-KEY-F2` note in its ExternalSecret,
where a shared 6-holder `SERVICE_TOKEN` was replaced by this service's own
delivery-scoped token.

Two options:

1. **Add `INTERNAL_SERVICE_TOKEN` to monitoring's ExternalSecret.** One manifest
   entry; `envFrom: secretRef` means no deployment.yaml change. Fastest, and
   consistent with how every other caller of auth's internal routes works today.
   Cost: one more holder of a shared static secret, and a credential that by
   construction cannot be probed — it carries no identity, so a rejection cannot
   be attributed. The watcher would be watching the fleet with the one credential
   shape the watcher cannot watch.

2. **Give the inventory route a per-pair principal**
   (`svc-monitoring-microservice--auth-microservice`) and have monitoring
   authenticate with RS256 like the fleet it observes. The watcher's own
   credential then appears in its own matrix and is probed like any other. Cost:
   auth's internal routes accept the static guard today, so this needs a second
   accepted auth path on `/internal/service-principals`.

Recommend option 2, and option 1 only as an explicitly temporary unblock with a
follow-up recorded. A watcher whose own credential is invisible to it is the
blind spot this plan was written about.

**Decision: option 2**, implemented 2026-09-02.

`InternalServiceOrRoleGuard` accepts either a per-pair RS256 principal holding
`internal:auth-microservice:readonly` or the existing shared static token, RS256
first. The static path stays because every current caller of auth's internal
routes uses it; removing it would break them. Two properties are deliberate and
tested: roles are read from the database rather than the token's own claim, so a
revoked role stops working at revocation instead of at expiry; and a failed
bearer token does not fall back to the static path, which would otherwise accept
a junk bearer plus a stolen shared secret as an anonymous holder.

A prerequisite surfaced during implementation: **`auth-microservice` has no
internal roles at all.** `seed-rbac.ts` creates them only for `INTERNAL`-typed
applications and auth is typed `INFRASTRUCTURE`. Widening that loop would create
`admin` and `action-admin` across every infrastructure application as a side
effect, so `scripts/seed-auth-readonly-role.js` creates the one role instead,
idempotently. `readonly` rather than `admin` because listing identities is a
read; it is already the established shape on logging, backups and warehouse.

Ordering matters and is not obvious. The Vault value must exist **before** the
monitoring manifest referencing it deploys: ESO fails an ExternalSecret whose
remote property is missing, which would stop refreshing all of that service's
keys rather than just the new one. So auth ships first (its guard still accepts
the static path, and nothing uses RS256 yet), then role, principal and Vault, and
the monitoring manifest last.

**Exit criteria:** a sweep completes against production and returns all 42
principals, with the watcher's own credential appearing in its own matrix.

**Met 2026-09-02.** The 15:30Z scheduled sweep logged
`43 principal(s): 0 accepted, 0 rejected, 0 indeterminate, 43 silent, 0 stale`
— 43 rather than 42 because provisioning the watcher's own principal added one.
Every prior sweep died on `INTERNAL_SERVICE_TOKEN is empty`.

Shipped in the order the section requires, Vault before the manifest:

| Step | Result |
|---|---|
| auth guard + seed script | `565b32d`, already deployed |
| `internal:auth-microservice:readonly` | `970d8d47-32ad-465b-bd9b-0cc762f04bcb`; re-running the seed reports `roleExists: true` and mutates nothing |
| `svc-monitoring-microservice--auth-microservice@internal.alfares.cz` | `fd504bb0-ca7c-4760-8360-04253bfa0f21`, RS256, kid `a975635403084850` |
| Vault `AUTH_SERVICE_TOKEN` | `secret/prod/monitoring-microservice` v17; the other 8 keys preserved |
| monitoring watcher + ExternalSecret | `68a237d`; ESO `SecretSynced`, pod 0 restarts |

`GET /internal/service-principals` returns 200 to the RS256 bearer, and the
watcher's own credential appears in its own matrix — `onConvention: true`,
`targetMismatch: false`, one `readonly` grant on `auth-microservice`. The blind
spot this task existed to close is closed.

`43 silent` is the correct reading, not a regression: no consumer reporters
exist yet, so nothing is checking these credentials. That is Task A. The watcher
now says so instead of failing to run.

**The watcher's credential expires 2026-12-01.** It was first issued at
`provision-service-token.js`'s `30d` default — not the 90-day lifetime this plan
assumes elsewhere — and reissued the same day at `--expires-in=90d` against the
same principal (`fd504bb0-ca7c-4760-8360-04253bfa0f21`, no new user), Vault
`secret/prod/monitoring-microservice` v18. The pod was restarted to pick it up:
ESO refreshes the Secret, but env vars are read at container start, so a running
pod holds the old value indefinitely. Verified 200 against the inventory route
afterwards.

That reissue buys time; it does not close the gap. **Task D is still open, so
nothing will warn before 2026-12-01** — the watcher would simply stop sweeping,
this plan's own subject reproduced in the tool built to detect it. Finish D, or
put the date in a calendar.

Live `targetMismatch` count is 14, matching finding 2.

### Sequencing

```
E (watcher credential) ──> B (classify duplicates) ──┐
      [DONE 2026-09-02]                              ├──> A (reporters) ──> one week baseline ──> Phase 2
                           D (contract field)     ───┘
C (mismatches) ── independent, any time
```

E comes first and blocks everything: until the watcher can read the inventory,
no sweep runs, so B cannot be checked against live data and A's reporters have
nowhere to land. B and D then precede A: B decides which principals deserve a
reporter at all, and D settles the payload shape so reporters are written once.
C is independent.

**E is done (2026-09-02), so B, C and D are all unblocked.** Sweeps run and the
matrix is populated, so B can now be checked against live data.

**That check has since been run, and it reverses B and A.** The auth DB has no
liveness signal — `lastActivity` is `NEVER` for every principal because nothing
in service-token validation writes it — so B cannot decide which principals are
dead before A's reporters demonstrate which are live. B's own section records
the evidence and the options. The revised order is:

```
E [DONE] ──> D [DONE] ──> A (reporters) ──> B (retire what stayed silent)
C [DONE]
```

Only **Task A** remains before the baseline week. It now carries three payloads
at once: it moves principals off `silent`, supplies the expiry Task D made room
for, and produces the liveness evidence Task B needs.

The original ordering assumed B could be answered from the inventory alone. It
cannot, and the plan's own rule against guessing forbids the shortcut: a
principal on `@internal.invalid` *looks* dead, and retiring it on that basis is
how a credential that still validates gets removed from under a running caller.

D has acquired a deadline it did not have when written: the watcher's own
credential expires **2026-12-01** (reissued at 90d; it was 2026-10-02 at the
script's 30d default) and no expiry signal exists to warn about it.

### When it will be done

Estimates are working days of focused effort, excluding review and the
deliberate baseline wait.

| Task | Effort | Notes |
|---|---|---|
| ~~E — watcher credential~~ | **done 2026-09-02** | Option 2, as recommended. Estimated 1.5 days; the code was already written, so what remained was the ordered production sequence. |
| B — classify duplicates | 1 day, **after A** | 7 duplicate groups / 15 principals identified 2026-09-02. Blocked on a liveness signal the auth DB does not have, so it now follows A rather than preceding it. |
| ~~D — contract `expiresAt` field~~ | **done 2026-09-02** | Receiver accepts and surfaces expiry. Reporters supply it as they adopt, so the rest lands with A. |
| A — shared reporter module | 1 day | Written and tested once. |
| A — vendor into repos | 3–4 days | 14 known repos, plus whatever Task B assigns from the 18 unowned principals. Deploy-serialized, so these do not parallelize freely. |
| ~~C — mismatch decisions~~ | **done 2026-09-02** | All 14 classified; no renames warranted. 10 are false positives by construction. |
| **Implementation remaining** | **6–7 days** | Was 6.5–8.5 including E. |
| Baseline observation | +7 calendar days | Phase 1's own exit criterion; cannot be compressed. |
| **Phase 1 complete** | **~3–3.5 working weeks** | Then Phase 2 may be wired. |

The largest line is vendoring the reporter into consumer repos, and it is large
because deploys are serialized — one rollout at a time. Batching several repos
per deploy window is the only real compression available.

The 3–4 day figure covers the 14 identified repos. It is the estimate most
likely to move, in either direction, once Task B says how many of the 18
unowned principals are live rather than dead.

### What would change these estimates

- Task B is the main source of variance. If most off-convention principals are
  dead, Task A stays near 3 days; if they are live and belong to repos not yet
  listed, it grows.
- If any consumer has no safe read-only endpoint to probe, that principal cannot
  self-report; it stays `unprobeable` by construction and needs a decision rather
  than an estimate.
- The baseline week is a hard floor. Wiring Phase 2 before it is what the
  original plan warns produces a muted channel on day one.
