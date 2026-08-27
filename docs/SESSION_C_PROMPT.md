# Session C — Two live 401 outages, and the expired-token sweep

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6x** (the migration pattern, worked four times) and **6n** first. Do not read the
whole file, it is long.

**Session C owns:** `orders-microservice/`, `monitoring-microservice/`, and the auth DB
principals for the lanes below. Sessions D/E/F/G own other repos — see "Boundaries".

---

## The pattern you are applying (already proven four times)

Every fix in this prompt is the same shape. Do not invent a new one:

1. **Trace** the caller's effective token — read the `||` fallback chain in the client and
   fingerprint what the *pod* actually resolves. A var can be mounted but never reached.
2. **Reproduce the 401** from inside the caller's pod before changing anything.
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
   Run `--check-db-only` then `--dry-run` first; require `wouldCreateUser:true` for a new pair.
   **Pick least privilege by reading what the caller actually calls.** Every token you are
   replacing grants `admin`; most callers only read.
4. **Probe before storing.** `/auth/validate` plus the real target endpoint.
   **401/403 = fail. 200/404/400 = authorized.** Use a non-existent id so nothing mutates.
5. **Store**: `vault kv patch secret/prod/<svc> <KEY>=@<0600 file>` — patch, never put.
   `VAULT_ADDR=http://127.0.0.1:8200`; `~/.vault-token` already authenticates.
6. **Map it** in `k8s/external-secret.yaml`, then **`kubectl apply -f`** that file — the deploy
   queue builds images, it does **not** apply manifests. Then annotate
   `force-sync=$(date +%s)`.
7. **Verify four hops**: minted = Vault = K8s Secret = **inside a pod created after the change**.
   Never trust ESO sync status or the deploy banner.
8. Commit, push, re-probe from the deployed pod. Delete both token files.

---

## 1. orders → warehouse is DEAD (401) — highest priority

Verified 2026-08-27 from the running orders pod:

```
effective WAREHOUSE_SERVICE_TOKEN  fp=222d57a5  HS256  exp 2026-07-31 (27 days ago)
GET warehouse-microservice:3201/api/stock/<id>/total  ->  401 Invalid token
```

The token is HS256 with `roles:['internal:warehouse-microservice:admin']`, and warehouse
stopped accepting HS256 (plan 6d/6f). Unexpired-looking code paths do not help: it is both
expired *and* structurally obsolete.

Consumers: `orders-microservice/src/warehouse/warehouse-reservation.client.ts:275` and
`src/orders/order-fulfillment-handoff.client.ts:257`, both
`WAREHOUSE_SERVICE_TOKEN || WAREHOUSE_INTERNAL_SERVICE_TOKEN`. **Note the fallback holds
`a2880693`** (the shared roleless token), so clearing the primary does not fail loudly — it
silently reaches a credential warehouse also rejects.

**Do:** mint `svc-orders-microservice--warehouse-microservice`. Read both clients to choose
the role — if orders only reserves/reads, `readonly` or `service` beats `admin`; if it
genuinely mutates stock, justify the wider role in your report. Then check whether these two
clients mask the failure (`return []`/`return 0`/`catch {}`) and fix that too — that masking
is why this went unnoticed for 27 days.

## 2. `monitoring-microservice` smoke tokens — expired, and possibly dead config

```
MONITORING_SMOKE_AUTH_TOKEN     fp=5dbcc681  exp 2026-06-22  roles=[]
MONITORING_SMOKE_REFRESH_TOKEN  fp=78384320  exp 2026-07-15  roles=[]
```

Both have **empty roles**, so they authenticate as nothing useful. `grep` found no code
reference in `monitoring-microservice/` — but **"unused" from a grep is a hypothesis, not a
fact.** Three of four such claims failed verification earlier in this migration.

**Do:** establish whether anything reads them (check the repo, its k8s manifests, any CronJob,
and any smoke script). If genuinely unused, remove the ExternalSecret entries **and** the
Vault properties, and confirm the keys disappear from the K8s Secret (removing only the Vault
property does **not** prune the Secret — see 6x). If they are used, mint proper principals.

## 3. `monitoring-microservice#LOGGING_READ_SERVICE_TOKEN` expires 2026-09-24

RS256 and healthy, but the only token in the ecosystem expiring within 30 days. Rotate it on
the same per-pair pattern before it becomes outage #6, and record the new expiry.

---

## Boundaries — do not touch these

- `flipflop/`, `cliplot/` — **Session D**
- `catalog-microservice/`, `bazos/`, `allegro/` — **Session E**
- `marketing-microservice/`, `logging-microservice/`, `aukro/`, `heureka/` — **Session F**
- `suppliers-microservice/`, `k8s-manifests/`, the two dormant ExternalSecrets — **Session G**
- `orders-microservice/src/auth/jwt-roles.guard.ts` is yours, but **do not add entries to
  `configuredServices`** — that map is being retired, not extended. New callers use Bearer.

## Hard constraints

- **Deploys are serialised.** One node, one containerd. Check
  `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Committing to `main`
  auto-deploys. **A `FAILED` line after ~600s is usually a rollout timeout, not a failure** —
  check pod image and readiness before re-running anything.
- Any command that creates a container (`kubectl rollout restart`, `kubectl patch` on a
  Deployment, `docker run`) must go through `shared/scripts/with-deploy-lock.sh <cmd>`.
- **Never log, echo, print or commit a token value.** sha256 fingerprints, first 8 chars only.
- **Never let `kubectl` emit a Secret's `.data` wholesale** — no `-o yaml`/`-o json` on a
  Secret. Key names only, or pipe one value into the consuming command.
- Reproduce the original failing call from inside the **deployed pod** before claiming a fix.
- No silent failures (`/home/ssf/.claude/CLAUDE.md`): every catch re-throws or logs at error
  level with full context. **A 404 legitimately means "no rows"; 401/403/5xx do not.**
- If you add a test, confirm it **fails** when you revert the fix.
- If the cluster looks broken — `kubectl get --raw /readyz` reporting `etcd failed`,
  ExternalSecrets frozen, pods `Pending` with bind timeouts — check `iostat -x 1 2` for disk
  saturation before escalating. A desktop file indexer starving etcd has caused this; it
  clears on its own. Do not restart k3s and do not force-delete pods for that.

## Report

Per item: before/after HTTP status, what you changed, the four-hop fingerprint evidence, and
how you verified it live. Note anything you found but did not fix rather than expanding scope.
Add a numbered section to `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
(check the highest existing `## 6<letter>` first and take the next free one — several sessions
append concurrently).
