# Session F — Retire `a2880693`: the last 16 mounts

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6q**, **6u**, **6v** and **6w** first — they are the measured inventory, the
header-spoofing fix, and a recorded reasoning error you must not repeat. Do not read the whole
file, it is long.

**Session F owns:** `marketing-microservice/`, `logging-microservice/`, `aukro/`, `heureka/`,
`payments-microservice/`.
Sessions C/D/E/G own other repos — see "Boundaries".

---

## What is left of `a2880693`

One HS256 string, `{"serviceId":"alfares-agent-rag","iss":"docs-rag-microservice"}`, **no
`sub`, no `roles`**, exp 2027-08-01. It cannot be revoked — there is no DB principal behind
it — only rotated everywhere at once. **16 mount points remain**, down from 22:

```
aukro-service-secret         AUKRO_INTERNAL_SERVICE_TOKEN, JWT_TOKEN
bazos-service-secret         BAZOS_INTERNAL_SERVICE_TOKEN, JWT_TOKEN
heureka-service-secret       JWT_TOKEN
logging-microservice-secret  JWT_TOKEN
marketing-microservice-secret MARKETING_API_TOKEN,
                             ORDER_AFFINITY_AUKRO_REPLAY_TOKEN,
                             ORDER_AFFINITY_BAZOS_REPLAY_TOKEN
orders-microservice-secret   PAYMENTS_INTERNAL_SERVICE_TOKEN, WAREHOUSE_INTERNAL_SERVICE_TOKEN
payments-microservice-secret JWT_TOKEN, PAYMENTS_ORDERS_SERVICE_TOKEN
warehouse-microservice-secret JWT_TOKEN
database-credentials         JWT_TOKEN   (Session G)
nginx-microservice-secret    JWT_TOKEN   (Session G)
```

**The orders header-spoofing defect is already fixed** (6u): presented at orders with any
`x-service-name`, this value now returns 401. You are not fixing a live escalation — you are
removing the last uses so the value can finally be rotated.

## Three lanes are LIVE on this value — do not just delete them

Verified 2026-08-27. Deleting any of these causes an outage:

| Lane | Evidence |
| --- | --- |
| marketing → **aukro** replay | `ORDER_AFFINITY_AUKRO_REPLAY_TOKEN` → `aukro-service:3700/internal/aukro/order-affinity/replay-candidates` → **200** |
| marketing → **bazos** replay | `ORDER_AFFINITY_BAZOS_REPLAY_TOKEN` → `bazos-service:3900/internal/bazos/order-affinity/replay-candidates` → **200** |
| logging ingest | `POST logging-microservice:3367/api/logs` with it → **201**; wrong token → 401 |
| marketing API | `POST marketing:4600/campaigns` with `MARKETING_API_TOKEN` → **400** (authorized); wrong → 401; absent → **503** on ~12 mutating routes |

**Read section 6v before probing anything.** An earlier attempt called the aukro/bazos replay
lanes dead on a 401 probe that pointed at *allegro's* endpoint instead of each source's own,
and removed two working credentials. **A 401 only proves the credential is wrong for the
endpoint you asked.** Resolve the caller's own target from
`marketing-microservice/src/order-affinity-backfill.ts` →
`orderAffinityMarketplaceReplayHeadersForSource` before declaring anything dead.

## The asymmetry that blocks rotation

`aukro-service` and `bazos-service` **receive** on this value —
`assertMarketingService()` in each of their `orders.controller.ts` compares against
`AUKRO_/BAZOS_INTERNAL_SERVICE_TOKEN` — while **sending** to orders on per-pair RS256
principals. So the receiver side is what keeps the value alive.

**The work, in order:**

1. Give each replay lane its own credential: mint a per-pair principal for
   marketing → aukro and marketing → bazos, change **both** the marketing sender and the
   aukro/bazos receiver guard to use it, deploy them together, verify 200 both sides.
   Keep the old value accepted until the new lane is verified, then remove it.
2. `MARKETING_API_TOKEN` — its own credential. It guards ~12 mutating routes
   (`/campaigns`, `/campaigns/:id/approve`, `/journeys`, `/segments`) via
   `requireServiceAuth` in `marketing-microservice/src/api-contracts.ts`. No ecosystem
   service sends `x-service-token` to marketing, so establish who actually calls these
   before choosing the shape.
3. `logging-microservice#JWT_TOKEN` — `log-ingest.guard.ts:95` adds it to the accepted
   bearer set alongside `LOG_INGEST_BEARER_TOKENS`. Narrow ingest to the explicit list, then
   drop this. Callers use `LOGGING_SERVICE_TOKEN`; several speakasap services fall back to
   `JWT_TOKEN`, so check those before removing.
4. `aukro`/`bazos`/`heureka`/`payments`/`warehouse` `JWT_TOKEN` and the
   `*_INTERNAL_SERVICE_TOKEN` copies — remove once nothing reaches them. **Grep first, then
   verify:** three of four "unused" claims in this migration failed verification.
   `orders#WAREHOUSE_INTERNAL_SERVICE_TOKEN` and `orders#PAYMENTS_INTERNAL_SERVICE_TOKEN`
   are **Session C's** — hand them over, do not edit orders.
5. `payments-microservice#JWT_TOKEN` and `#PAYMENTS_ORDERS_SERVICE_TOKEN` are now **inert
   cutover fallbacks**: payments' only lane is -> orders, already on a per-pair RS256
   principal (`ORDERS_SERVICE_TOKEN`, fp `633a4184`), and orders no longer accepts
   `a2880693` from anyone. `orders-payment-status.client.ts` logs at error level whenever it
   falls back, and production shows zero such warnings. Confirm that from the logs, then
   remove both — sender-side only; the matching `orders#PAYMENTS_INTERNAL_SERVICE_TOKEN` is
   Session C's.
6. Only when every lane is migrated: rotate the value itself.

## Mechanism you will need

**ESO does not prune.** Deleting a Vault property leaves the key in the K8s Secret forever;
removing the ExternalSecret's `data` entry is what removes it. Full order: remove the ES
entry → commit → **`kubectl apply -f k8s/external-secret.yaml`** (the deploy queue builds
images, it does not apply manifests) → confirm the key is gone from the Secret → delete the
Vault property → **restart the pod** (`envFrom` changes do not reach a running container).

---

## Boundaries — do not touch these

- `orders-microservice/`, `monitoring-microservice/` — **Session C**
- `flipflop/`, `cliplot/` — **Session D**
- `catalog-microservice/`, `bazos/`, `allegro/` — **Session E** (you own aukro/heureka *credentials*; bazos belongs to E)
- `suppliers-microservice/`, `k8s-manifests/`, `database-credentials`,
  `nginx-microservice-secret` — **Session G**
- `aukro/shared/clients/*` and `bazos/shared/clients/*` were swept for silent failures on
  2026-08-27 — **do not re-sweep them.** You own those repos for *credentials*, not for
  another client rewrite.

## The migration pattern (proven four times)

Mint (`--check-db-only` → `--dry-run` → `--apply`, `wouldCreateUser:true` for a new pair,
least privilege from what the caller actually calls) → **probe before storing**
(`/auth/validate` + the real endpoint; **401/403 = fail, 200/404/400 = authorized**;
non-existent ids only) → `vault kv patch` (never put) → map + `kubectl apply` + force-sync →
**verify four hops** (minted = Vault = Secret = inside a pod created after the change) →
commit, push, re-probe from the deployed pod → delete both token files.

## Hard constraints

- **Deploys are serialised.** Check `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Committing to `main`
  auto-deploys. **A `FAILED` line after ~600s is usually a rollout timeout** — check pod image
  and readiness before re-running.
- Any container-creating command goes through `shared/scripts/with-deploy-lock.sh <cmd>`.
- **A sender and its receiver must deploy together**, or you break the lane between them.
  Plan the ordering and say what it was in your report.
- **Never log, echo, print or commit a token value.** Fingerprints only, first 8 chars.
- **Never let `kubectl` emit a Secret's `.data` wholesale.** Key names only.
- Reproduce the original call from inside the **deployed pod** before claiming a fix.
- No silent failures: every catch re-throws or logs at error level with full context.
  **A 404 legitimately means "no rows"; 401/403/5xx do not.**
- If you add a test, confirm it **fails** when you revert the fix.

## Report

Per lane: before/after HTTP status on **both** sender and receiver, what you changed, four-hop
fingerprint evidence, and the deploy ordering you used. State plainly whether `a2880693` can
now be rotated, and if not, exactly what still holds it. Add a numbered section to
`auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` (check the highest existing
`## 6<letter>` first — several sessions append concurrently).
