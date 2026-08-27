# Session E — catalog, bazos and allegro: `aa7ae49e` and the catalog credentials

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6x** (the migration pattern, worked four times), **6h** and **6i** (the `369e4f3c…`
/ `aa7ae49e` history) first. Do not read the whole file, it is long.

**Session E owns:** `catalog-microservice/`, `bazos/`, `allegro/`. Sessions C/D/F/G own other
repos — see "Boundaries".

---

## The pattern you are applying (already proven four times)

1. **Trace** the caller's effective token — read the `||` fallback chain and fingerprint what
   the *pod* resolves. A var can be mounted but never reached.
2. **Reproduce** the current behaviour from inside the caller's pod before changing anything.
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
   **Least privilege, chosen from what the caller actually calls.**
4. **Probe before storing.** `/auth/validate` plus the real target endpoint.
   **401/403 = fail. 200/404/400 = authorized.** Non-existent ids only; never mutate prod data.
5. **Store**: `vault kv patch secret/prod/<svc> <KEY>=@<0600 file>` — patch, never put.
6. **Map it**, then **`kubectl apply -f k8s/external-secret.yaml`** (the deploy queue does not
   apply manifests), then annotate `force-sync=$(date +%s)`.
7. **Verify four hops**: minted = Vault = K8s Secret = **inside a pod created after the change**.
8. Commit, push, re-probe from the deployed pod. Delete both token files.

---

## 1. `aa7ae49e` — allegro's identity, held by three services

```
allegro-service-secret#JWT_TOKEN                              fp=aa7ae49e
orders-microservice-secret#ALLEGRO_INTERNAL_SERVICE_TOKEN     fp=aa7ae49e   (receiver)
marketing-microservice-secret#ORDER_AFFINITY_MARKETPLACE_REPLAY_TOKEN  fp=aa7ae49e
```

HS256, `sub=369e4f3c-5af8-41df-9cd2-09861d403bd6`, exp 2027-06-29, and its single role is
**`internal:warehouse-microservice:admin`** — warehouse admin on a credential used to talk to
orders and allegro. That DB principal was deactivated in plan 6k, so the role is inert, but
the value is still accepted by string comparison.

**Already verified for you (2026-08-27):** presented at orders with four different
`x-service-name` values, it authenticates **only** as `allegro-service` (400 = authorized;
the rest 401). So it is *not* header-spoofable — the ambiguity check added in 6u holds. This
is over-sharing, not a live privilege escalation. Fix it for blast radius, not urgency.

**Do:** allegro → orders already has a per-pair principal (`svc-allegro-service--orders-microservice`,
plan 6i). Establish what `allegro-service-secret#JWT_TOKEN` is still *reached* for — read the
`||` chains in `allegro/shared/clients/*` — and give each real lane its own credential.
The marketing holder is **Session F's**; the orders receiver entry is **Session C's**. Do the
allegro side, then hand both the finding.

## 2. allegro → warehouse: `JWT_TOKEN` is the third fallback

`allegro/shared/clients/warehouse-client.service.ts` resolves
`WAREHOUSE_SERVICE_TOKEN || WAREHOUSE_INTERNAL_SERVICE_TOKEN || JWT_TOKEN`. Plan 6r records
this lane as repaired, so the primary should be set — **verify that from the pod**, because if
the primary is ever cleared the chain silently falls through to `aa7ae49e`, which carries
`warehouse:admin`. Remove `JWT_TOKEN` from that chain: falling through to a credential the
target rejects turns a configuration error into a confusing 401 (the exact trap fixed in
aukro and bazos).

## 3. catalog-microservice's two HS256 credentials

```
catalog-microservice-secret#JWT_TOKEN         fp=ae611ed9  exp 2026-09-11
    sub=catalog-authorized-r…  roles=['catalog:write','internal:catalog-microservice:…']
catalog-microservice-secret#BAZOS_SERVICE_TOKEN  fp=0f1b8070  exp 2026-09-11
    sub=catalog-to-bazos-dra…  roles=['internal:bazos-service:admin','app:bazos-…']
```

Both expire in ~2 weeks and both are HS256 with invented `sub` values (not real DB
principals, so neither can be revoked — only rotated). `BAZOS_SERVICE_TOKEN` grants
**bazos admin** for what is likely a draft/publish call: check what catalog actually calls on
bazos before reissuing at that level.

`catalog-microservice-secret#WAREHOUSE_SERVICE_TOKEN` is already RS256 (`da08f19e`) — leave it.

## 4. bazos-side catalog credential

`bazos/shared/clients/catalog-client.service.ts` uses `CATALOG_INTERNAL_SERVICE_TOKEN`,
sourced from `secret/prod/auth-microservice` (not bazos's own path — plan 6n). Confirm the
lane works from the pod, and if you migrate it to a per-pair principal note that
`CatalogAuthGuard` grants the static-header path
`internal:catalog-microservice:admin` + `catalog:write`, while every catalog route requires
only `catalog:authenticated`. **Migrating is therefore a large privilege reduction**, as it
was for aukro (plan 6x).

`bazos/shared/clients/warehouse-client.service.ts` and `catalog-client.service.ts` were swept
for silent failures on 2026-08-27 — **do not re-sweep them**; they are done.

---

## Boundaries — do not touch these

- `orders-microservice/` (guard + ExternalSecret) — **Session C**
- `flipflop/`, `cliplot/` — **Session D**
- `marketing-microservice/`, `logging-microservice/`, `aukro/`, `heureka/` — **Session F**
- `suppliers-microservice/`, `k8s-manifests/` — **Session G**
- Do **not** add entries to `orders-microservice`'s `configuredServices` map — it is being
  retired. New callers use Bearer.

## Hard constraints

- **Deploys are serialised.** One node, one containerd. Check
  `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Committing to `main`
  auto-deploys. **A `FAILED` line after ~600s is usually a rollout timeout** — check pod image
  and readiness before re-running anything.
- Any container-creating command goes through `shared/scripts/with-deploy-lock.sh <cmd>`.
- **Never log, echo, print or commit a token value.** Fingerprints only, first 8 chars.
- **Never let `kubectl` emit a Secret's `.data` wholesale.** Key names only.
- Reproduce the original call from inside the **deployed pod** before claiming a fix.
- No silent failures: every catch re-throws or logs at error level with full context.
  **A 404 legitimately means "no rows"; 401/403/5xx do not.**
- **A 401 only proves the credential is wrong for the endpoint you asked.** Resolve the
  caller's own target from its dispatch code before declaring a lane dead — a wrong-endpoint
  probe once produced a false "dead lane" call in this migration.
- If you add a test, confirm it **fails** when you revert the fix.

## Report

Per item: before/after HTTP status, what you changed, four-hop fingerprint evidence, how you
verified live, and what you handed to Sessions C and F. Note anything found but not fixed.
Add a numbered section to `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
(check the highest existing `## 6<letter>` first — several sessions append concurrently).
