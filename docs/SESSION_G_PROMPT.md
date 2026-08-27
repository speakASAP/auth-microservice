# Session G — Untracked drift, the superadmin token, and rotation that does not rot

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6x** (the migration pattern and the suppliers finding) and **6o** (the untracked
override that survived a deploy) first. Do not read the whole file, it is long.

**Session G owns:** `suppliers-microservice/`, `k8s-manifests/`, the two ownerless
ExternalSecrets, and Phase 6 (rotation). Sessions C/D/E/F own the service repos — see
"Boundaries". **Your work is mostly infrastructure, not application code.**

---

## 1. `stock-traceability-runtime-token` — expired, hand-created, and `global:superadmin`

```
stock-traceability-runtime-token#JWT_TOKEN   fp=c5817dbb  HS256
    exp 2026-06-24 (64 days ago)
    sub=codex-runtime-smoke…
    roles=['global:superadmin', 'internal:warehouse-mi…']
```

**This is the widest-privilege credential in the inventory** and it is mounted by
`suppliers-microservice` for *two* different consumer names:

```
suppliers-microservice/k8s/deployment.yaml:37-46
  CATALOG_SERVICE_TOKEN   -> stock-traceability-runtime-token#JWT_TOKEN
  WAREHOUSE_SERVICE_TOKEN -> stock-traceability-runtime-token#JWT_TOKEN
```

The Secret is hand-created: **no ExternalSecret, no ownerReferences, absent from Vault.**

**Verified 2026-08-27, and this is why the obvious fix is wrong:**
`suppliers-microservice-secret` contains only `DB_PASSWORD`, `JWT_SECRET` and three
`PAYMENT_*` keys, and `secret/prod/suppliers-microservice` has no `CATALOG_`/`WAREHOUSE_`
property either. **There is no ESO value to fall back to.** Removing the override leaves both
vars unset and `imports.service.ts` throws `ServiceUnavailableException` with no fallback —
it would *cause* an outage, not fix drift.

**Do, in this order:**
1. Establish whether the lanes even work today (the token expired 64 days ago — check from
   the pod, and check whether the client masks the failure into an empty result).
2. Mint two per-pair RS256 principals: suppliers → catalog and suppliers → warehouse. Read
   `imports.service.ts:297,354` for the fallback chains and pick **least privilege** —
   `global:superadmin` is certainly not it.
3. Add real ExternalSecret entries, `kubectl apply` them, verify by fingerprint in the pod.
4. Only then remove the `env[]` overrides from the repo manifest and delete the orphan Secret.
5. Confirm the two lanes work end to end afterwards.

## 2. Two ownerless ExternalSecrets with no manifest anywhere

```
database-credentials#JWT_TOKEN         fp=a2880693   (Vault property already deleted)
nginx-microservice-secret#JWT_TOKEN    fp=a2880693   (Vault property already deleted)
```

Both keys are **dead**: `database-credentials` is mounted by aukro, bazos and orders but only
for `DB_PASSWORD`; `nginx-microservice` is a **retired service**
(`nginx-microservice.retired-20260617.tar.gz`, no workload in `statex-apps`).

Their Vault properties were removed on 2026-08-27, but the keys persist in the K8s Secrets
because **ESO does not prune** — it adds and updates, never removes a key whose source
vanished. Removing them needs the ExternalSecret's `data` entry deleted.

**The blocker is that neither ExternalSecret exists in any repo** — they live only in the
cluster (they carry a `last-applied-configuration`, so they were applied from a file once,
but that file is gone). Editing them in place would recreate exactly the untracked drift this
whole effort is removing.

**Do:** bring both under `k8s-manifests/` (it is deny-listed from auto-deploy, so it is manual
and that is correct), reconstruct the manifests from the live objects, then remove the
`JWT_TOKEN` entries and apply. For `nginx-microservice-secret`, consider whether the entire
Secret and ExternalSecret should be deleted along with the retired service.

## 3. `JWT_SECRET` is one value across 13 pods

```
distinct JWT_SECRET values: 4, mounted 21 times
  366a1388  x13     <-- anyone holding this can mint HS256 tokens for 13 services
  278bf2fc  x6
  4ecb98f5  x1
  b794bf08  x1
```

No service still verifies HS256 locally (checked in catalog, orders, warehouse, payments —
that was blocker 6d, closed 2026-08-26), so this is **not** currently exploitable for forgery
against those. But a shared symmetric secret across 13 services is the substrate the whole
RS256 migration exists to remove.

**Do:** map which services still *need* `JWT_SECRET` at all versus which only kept it for
legacy verification, and produce a plan (not a big-bang change) for splitting or retiring it.
This is analysis plus a staged proposal — do not rotate a 13-pod secret in one step.

## 4. Phase 6 — rotation that does not rot

Five credentials expired unnoticed and caused four separate production outages, each masked
by a client turning the failure into an empty result. Every fix so far has been manual.

**Do:** build the missing automation. At minimum a scheduled job that reports, per token
mount: algorithm, days to expiry, whether the value is shared across services, and whether it
resolves against its target. Alert **before** expiry, not after. `shared/scripts/` and the
existing CronJob patterns in the cluster are the place to look; Telegram alerting already
exists (the Daily Digest channel). Failing loudly is the entire lesson of this migration —
build the thing that would have caught all five.

---

## Boundaries — do not touch these

- `orders-microservice/`, `monitoring-microservice/` — **Session C**
- `flipflop/`, `cliplot/` — **Session D**
- `catalog-microservice/`, `bazos/`, `allegro/` — **Session E**
- `marketing-microservice/`, `logging-microservice/`, `aukro/`, `heureka/` — **Session F**
- `flipflop-warehouse-token` is **already removed** (2026-08-27). Do not recreate it.
- You may *read* any repo to trace a lane; you may only *edit* yours.

## Hard constraints

- **`k8s-manifests` is deny-listed from auto-deploy** — changes there are applied manually and
  deliberately. That is a feature, not an obstacle.
- **Deploys are serialised.** Check `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Any
  container-creating command goes through `shared/scripts/with-deploy-lock.sh <cmd>`.
- **Deleting a Secret or removing a live `env[]` override is destructive.** Verify by
  fingerprint what the pod would fall back to *before* removing anything, and remove only
  after the replacement is confirmed in a pod created after the change. Never delete a Secret
  that any workload still references — check first.
- **Never log, echo, print or commit a token value.** Fingerprints only, first 8 chars.
- **Never let `kubectl` emit a Secret's `.data` wholesale.** Key names only. Note the sha256
  of empty input is `e3b0c442` — that is what an absent key hashes to through a
  `base64 -d | sha256sum` pipeline, so treat it as "missing", not as a value.
- No silent failures: every catch re-throws or logs at error level with full context.
  **A 404 legitimately means "no rows"; 401/403/5xx do not.**
- If the cluster looks broken — `/readyz` reporting `etcd failed`, ExternalSecrets frozen,
  pods `Pending` with bind timeouts — check `iostat -x 1 2` for disk saturation first. A
  desktop file indexer starving etcd has caused exactly this; it clears on its own. Do not
  restart k3s and do not force-delete pods for that.
- If you add a test, confirm it **fails** when you revert the fix.

## Report

Per item: what you found, what you changed, the fingerprint evidence, and how you verified
live. For the `JWT_SECRET` split and Phase 6, a concrete staged plan is an acceptable
deliverable — say so plainly rather than half-executing it. Add a numbered section to
`auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` (check the highest existing
`## 6<letter>` first — several sessions append concurrently).
