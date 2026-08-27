# Session D — flipflop and cliplot: a dead status lane and three shared HS256 values

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6x** (the migration pattern, worked four times) and **6n** (flipflop's measured
token map) first. Do not read the whole file, it is long.

**Session D owns:** `flipflop/` and `cliplot/`. Sessions C/E/F/G own other repos — see
"Boundaries".

---

## The pattern you are applying (already proven four times)

Every fix here is the same shape. Do not invent a new one:

1. **Trace** the caller's effective token — read the `||` fallback chain and fingerprint what
   the *pod* actually resolves. A var can be mounted but never reached.
2. **Reproduce the failure** from inside the caller's pod before changing anything.
3. **Mint** a per-pair RS256 principal in the auth pod, never printing the token:
   ```
   kubectl exec -n statex-apps <auth-pod> -c app -- sh -c 'umask 077
     node scripts/provision-service-token.js \
       --email=svc-<caller>--<target>@internal.alfares.cz \
       --service-name=<caller>--<target> \
       --role=internal:<target>:<least-privilege> \
       --expires-in=90d --create-if-missing --apply \
       --confirm-db-mutation=SERVICE_PRINCIPAL --confirm-token-issuance=SERVICE_JWT \
       --token-output=/tmp/x.token'
   ```
   `--check-db-only` then `--dry-run` first; require `wouldCreateUser:true` for a new pair.
   **Pick least privilege from what the caller actually calls** — every token below grants
   `admin`, and most callers only read.
4. **Probe before storing.** `/auth/validate` plus the real target endpoint.
   **401/403 = fail. 200/404/400 = authorized.** Use a non-existent id so nothing mutates.
5. **Store**: `vault kv patch secret/prod/<svc> <KEY>=@<0600 file>` — patch, never put.
6. **Map it**, then **`kubectl apply -f k8s/external-secret.yaml`** — the deploy queue builds
   images, it does **not** apply manifests. Then annotate `force-sync=$(date +%s)`.
7. **Verify four hops**: minted = Vault = K8s Secret = **inside a pod created after the change**.
8. Commit, push, re-probe from the deployed pod. Delete both token files.

---

## 1. flipflop → orders status is DEAD (401)

Verified 2026-08-27 from `flipflop-order-service`:

```
ORDERS_STATUS_SERVICE_TOKEN  fp=1dc28737  HS256  exp 2026-08-05 (22 days ago)
PUT orders-microservice:3203/api/orders/<id>/status  ->  401 Invalid token
```

Named as broken in plan section 6n and never fixed. `getStatusActionHeaders()`
(`flipflop/shared/clients/order-client.service.ts:~430`) already sends `Authorization: Bearer`
and **already throws when the var is missing** — so the client is correct; only the credential
is dead. `PUT /:id/status` requires `internal:orders-microservice:action-admin`
(`ORDER_STATUS_UPDATE_ROLES` in `orders-microservice/src/orders/orders.controller.ts`), so
that is the role to mint.

## 2. `9431f75c` is one value doing three different jobs

```
flipflop-service-secret#FLIPFLOP_INTERNAL_SERVICE_SECRET   fp=9431f75c
flipflop-service-secret#JWT_TOKEN                          fp=9431f75c
marketing-microservice-secret#ORDER_AFFINITY_FLIPFLOP_REPLAY_TOKEN  fp=9431f75c
```

HS256, `sub=flipflop-service`, `roles:['internal:warehouse-microservice:admin']` — warehouse
admin on a key used for an intra-flipflop webhook and for marketing's replay pull.

**Both flipflop vars map to the same Vault property `JWT_TOKEN`**
(`flipflop/k8s/external-secret.yaml:76-83`), so writing that property changes both at once —
and one of them is the shared key for the payment-result webhook. **Give each job its own
Vault property before rotating anything**, or you will break the webhook while fixing the
replay lane.

The marketing side of this is **Session F's**. Coordinate: create the flipflop-side
credential and tell Session F the property name; do not edit `marketing-microservice/`.

## 3. `321c86c8` — flipflop → orders create

```
flipflop-service-secret#ORDERS_SERVICE_TOKEN        fp=321c86c8  (caller)
orders-microservice-secret#FLIPFLOP_INTERNAL_SERVICE_TOKEN  fp=321c86c8  (receiver)
```

A matched caller/receiver pair, HS256, `roles:['internal:orders-microservice:admin']`,
exp 2026-09-11 (**~2 weeks out**). It is a legitimate pair, not over-sharing, but it is still
a static shared password on orders' legacy path and it expires soon.

`orders-microservice`'s guard resolves `flipflop-service` by string comparison and then
synthesises the role from the `x-service-name` header. Migrating this lane to Bearer removes
one of the last four entries from that map. **The receiver-side edit
(`orders-microservice/src/auth/jwt-roles.guard.ts`) is Session C's file** — do the caller side,
verify the Bearer path works, and hand Session C the finding. Do not edit orders.

## 4. `cliplot-secret#ORDERS_STATUS_SERVICE_TOKEN`

```
fp=c59347ae  HS256  exp 2026-09-30  roles:['internal:orders-microservice:admin']
```

`cliplot/src/integrations.js` sends it with `x-service-name: cliplot`.
**`cliplot` now HAS an `applications` row and an `internal:cliplot:service` role** — seeded
2026-08-27, so a real per-pair principal is issuable for the first time. Check what cliplot
actually calls before choosing between `service` and `action-admin`.

Note `cliplot-service` was deliberately **not** seeded and its guard alias was removed: the
live pod sends `cliplot`. Do not reintroduce the alias.

---

## Boundaries — do not touch these

- `orders-microservice/` (including its guard and ExternalSecret) — **Session C**
- `catalog-microservice/`, `bazos/`, `allegro/` — **Session E**
- `marketing-microservice/`, `logging-microservice/`, `aukro/`, `heureka/` — **Session F**
- `suppliers-microservice/`, `k8s-manifests/` — **Session G**
- `flipflop-warehouse-token` is **already fixed** (override removed, orphan Secret deleted
  2026-08-27). Do not recreate it.

## Hard constraints

- **Deploys are serialised.** One node, one containerd. Check
  `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Committing to `main`
  auto-deploys. **A `FAILED` line after ~600s is usually a rollout timeout** — flipflop once
  reported `FAILED after 963s` while all five services converged correctly. Check pod image
  and readiness before re-running anything.
- Any container-creating command (`kubectl rollout restart`, `kubectl patch` on a Deployment,
  `docker run`) goes through `shared/scripts/with-deploy-lock.sh <cmd>`.
- flipflop is **five services sharing one `envFrom`** — every pod mounts all tokens regardless
  of use. Changing one key affects five deployments; verify all five afterwards.
- **Never log, echo, print or commit a token value.** Fingerprints only, first 8 chars.
- **Never let `kubectl` emit a Secret's `.data` wholesale.** Key names only.
- Reproduce the original failing call from inside the **deployed pod** before claiming a fix.
- No silent failures: every catch re-throws or logs at error level with full context.
  **A 404 legitimately means "no rows"; 401/403/5xx do not.**
- If you add a test, confirm it **fails** when you revert the fix.

## Report

Per item: before/after HTTP status, what you changed, four-hop fingerprint evidence, and how
you verified it live. Say explicitly what you handed to Sessions C and F rather than editing
their repos. Add a numbered section to
`auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` (check the highest existing
`## 6<letter>` first and take the next free one — several sessions append concurrently).
