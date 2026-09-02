# Service Credential Prober — Plan

Date: 2026-09-02
Status: Phase 1 implemented (receiver side); consumer adoption outstanding
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

**The watcher is inert in production.** Its `INTERNAL_SERVICE_TOKEN` was never
wired into the monitoring pod, so no sweep can run — Task E.

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

### Sequencing

```
E (watcher credential) ──> B (classify duplicates) ──┐
                                                     ├──> A (reporters) ──> one week baseline ──> Phase 2
                           D (contract field)     ───┘
C (mismatches) ── independent, any time
```

E comes first and blocks everything: until the watcher can read the inventory,
no sweep runs, so B cannot be checked against live data and A's reporters have
nowhere to land. B and D then precede A: B decides which principals deserve a
reporter at all, and D settles the payload shape so reporters are written once.
C is independent.

### When it will be done

Estimates are working days of focused effort, excluding review and the
deliberate baseline wait.

| Task | Effort | Notes |
|---|---|---|
| E — watcher credential | 0.5 day (option 1) / 1.5 days (option 2) | Blocks everything else. Option 2 adds a second accepted auth path on the inventory route. |
| B — classify duplicates | 1 day | Mostly determining what is live; may hand retirements to the RS256 plan. |
| D — contract `expiresAt` field | 0.5 day | Contract edit plus receiver field; no consumer work yet. |
| A — shared reporter module | 1 day | Written and tested once. |
| A — vendor into repos | 3–4 days | 14 known repos, plus whatever Task B assigns from the 18 unowned principals. Deploy-serialized, so these do not parallelize freely. |
| C — mismatch decisions | 0.5 day | Documentation, no code. |
| **Implementation total** | **6.5–8.5 days** | Range depends on the Task E option chosen. |
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
