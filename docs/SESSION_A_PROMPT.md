# Session A — Retire the shared `a2880693` token (orders identity spoofing)

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6h, 6i, 6j, 6n, 6o** first — they are the worked examples and the measured
inventory. Do not read the whole file, it is long.

## The problem

One HS256 token — sha256 fingerprint **`a2880693`**, payload
`{"serviceId":"alfares-agent-rag","iss":"docs-rag-microservice"}`, **no `sub`, no `roles`**,
expiry 2027-08-01 — is mounted in **9 running pods across 22 env vars** (measured
2026-08-26):

```
aukro-service           AUKRO_INTERNAL_SERVICE_TOKEN, JWT_TOKEN
bazos-service           BAZOS_INTERNAL_SERVICE_TOKEN, JWT_TOKEN
heureka-service         HEUREKA_INTERNAL_SERVICE_TOKEN, JWT_TOKEN
logging-microservice    JWT_TOKEN
marketing-microservice  MARKETING_API_TOKEN, ORDER_AFFINITY_AUKRO_REPLAY_TOKEN,
                        ORDER_AFFINITY_BAZOS_REPLAY_TOKEN
orders-microservice     AUKRO_INTERNAL_SERVICE_TOKEN, BAZOS_INTERNAL_SERVICE_TOKEN,
                        HEUREKA_INTERNAL_SERVICE_TOKEN, MARKETING_INTERNAL_SERVICE_TOKEN,
                        PAYMENTS_INTERNAL_SERVICE_TOKEN, WAREHOUSE_INTERNAL_SERVICE_TOKEN
payments-microservice   JWT_TOKEN, PAYMENTS_ORDERS_SERVICE_TOKEN
runlayer                JWT_TOKEN, ORCHESTRATOR_SERVICE_TOKEN, ORCHESTRATOR_USER_JWT
warehouse-microservice  JWT_TOKEN
```

**The core defect — verify this yourself before doing anything else.**
`orders-microservice/src/auth/jwt-roles.guard.ts` → `resolveInternalServiceActor()` compares
`x-internal-service-token` byte-for-byte against a per-caller env var, then **synthesises the
role from the `x-service-name` header** — it never decodes the token. Because all six orders
entries hold the same value, presenting `a2880693` with six different `x-service-name` values
authenticates as six different principals:

```
x-service-name: warehouse-microservice  -> 403 (authenticated, role-limited)
x-service-name: payments-microservice   -> 403
x-service-name: marketing-microservice  -> 200
x-service-name: aukro-service           -> 403
wrong token, any name                   -> 401
```

**Any holder of this string chooses which service it is.** There is no `sub`, so no DB
principal exists and it cannot be revoked — only rotated in 22 places at once.

## Goal

Retire `a2880693` completely. Every lane that needs it gets a per-pair RS256 principal;
every lane that does not need it loses the variable.

## Method — follow the proven pattern exactly

Per lane `(caller → target)`, in this order. **Never skip the probe.**

1. **Trace first.** Establish whether the var is actually read by code, and via which wire
   contract (`Authorization: Bearer` vs `x-internal-service-token`). Watch `||` fallback
   chains — a var can be mounted but never reached. Report the *effective* token.
   Use `rg` — it is a GNU grep shim here, so use `-E` or patterns silently fail. Never `find`.
2. **Seed the role if missing.** `internal:<target-app>:service` roles now exist for
   allegro-service, aukro-service, bazos-service, catalog-microservice, flipflop-service,
   heureka-service, marketing-microservice, orders-microservice, payments-microservice,
   warehouse-microservice. Check with the postgres MCP (`postgres_agent_guide` FIRST).
   **`cliplot`, `cliplot-service` and `invoices-microservice` have no `applications` row at
   all** — orders references roles for them that can never exist. Decide deliberately.
3. **Mint**, inside the auth pod, never printing the token:
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
   Run `--check-db-only` then `--dry-run` first; require `wouldCreateUser:true` for a new
   pair. Pick **least privilege**: check what the caller actually calls before choosing a role.
4. **Probe before storing.** Call `/auth/validate` and the real target endpoint with the new
   token. **401/403 = fail. 200/404/400 = authorized.** Do not touch Vault until it passes.
   Use read-only or validation-failing calls; never mutate production data.
5. **Store**: `vault kv patch secret/prod/<svc> <KEY>=@<0600 file>` — patch, never put.
   `VAULT_ADDR=http://127.0.0.1:8200`; `~/.vault-token` already authenticates, so do **not**
   read `.vault-init`.
6. **Map it.** A new Vault key **never reaches the pod** until it is named in
   `k8s/external-secret.yaml`, and ESO still reports `SecretSynced`. Check whether the env var
   is remapped to a *different* Vault property first — in marketing, `ORDERS_SERVICE_TOKEN`
   read `property: JWT_TOKEN`, which also fed five other vars.
7. **Fingerprint all three hops** — minted = Vault = mounted K8s Secret — and **also the pod**.
   Never trust ESO sync status. Then delete both token files.
8. **Commit, push, verify from the deployed pod.**

## Hard constraints

- **Deploys are serialised.** One node, one containerd. Check
  `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Commit to `main`
  auto-deploys. **A `FAILED` line after ~600s is often a rollout timeout, not a failure** —
  check the deploy's image and readiness before re-running anything.
- **Session B is editing `flipflop/`, `runlayer/`, `notifications-microservice/` and
  `ai-microservice/`.** Do not edit those repos. `orders-microservice/src/auth/jwt-roles.guard.ts`
  is yours alone.
- Never log or echo a token value; fingerprints only.
- Never let `kubectl` dump a Secret's `.data` wholesale.
- No silent failures: every rejection logs at error level with context; an empty result must
  never stand in for a failure.

## Order of work (highest value first)

1. **orders' six entries.** Give each caller its own principal so the header can no longer
   choose identity. aukro/bazos/heureka/marketing already work today — do not break them:
   keep the static value accepted until each caller's Bearer lane is verified, then remove.
2. **`PAYMENTS_ORDERS_SERVICE_TOKEN`** is a latent trap: currently shadowed by a set primary,
   but the `||` chain silently re-activates the shared password if the primary is cleared.
3. **Dead/unused mounts** — delete rather than reissue. Reported unused: `payments JWT_TOKEN`,
   `marketing MARKETING_API_TOKEN` (no service sends `x-service-token` to marketing),
   `runlayer JWT_TOKEN`, `aukro JWT_TOKEN` (Bearer-only lanes, already 401). **Re-verify
   each before deleting** — "unused" from a grep is a hypothesis, not a fact.
4. **Two dormant copies** exist in `database-credentials#JWT_TOKEN` and
   `nginx-microservice-secret#JWT_TOKEN`, mounted by nothing.
5. Only when every lane is migrated: rotate/retire the value itself.

## Report

What you migrated, with the before/after HTTP status per lane; what you deleted and the
evidence it was unused; anything you found but did not fix. Update
`auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` with a new numbered section.
Do not fabricate — if a lane is unverified, say so.
