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

## 7. Progress

- [x] Phase 0 — logging, script, Dockerfile (`eb03ddb`, live)
- [x] Phase 0b — standard revised, scripts consolidated
- [ ] Phase 1 — catalog → warehouse pilot
- [ ] Phase 2 — split `369e4f3c…`
- [ ] Phase 3 — category A remainder
- [ ] Phase 4 — category C
- [ ] Phase 5 — category D
- [ ] Phase 6 — rotation CronJob
