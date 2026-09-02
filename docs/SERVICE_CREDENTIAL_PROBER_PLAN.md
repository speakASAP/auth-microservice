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

**Exit criteria not yet met.** The plan requires one week of clean runs with all
principals accepted or explained. No consumer reports yet, so every principal
reconciles as `silent` — a truthful reading of the current state: nothing is
checking these credentials. The remaining Phase 1 work is consumer adoption
across ~20 repos, per the contract document.
