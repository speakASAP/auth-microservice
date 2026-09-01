# Catalog shared-secret split — plan

Retire `5f420714`, the last entry in orders' legacy static-header map and the widest
remaining shared credential in the ecosystem.

Companion to `RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` §6ax, which isolated this as its own
workstream. Every fact below was measured on 2026-09-01, not inferred.

---

## 1. What the credential actually is

One value, `sha256 5f420714`, a **64-byte opaque random string — not a JWT**. It resolves
from a single Vault property, `secret/prod/auth-microservice#CATALOG_INTERNAL_SERVICE_TOKEN`,
into **eight** Kubernetes Secrets:

| Secret | Key |
| --- | --- |
| `allegro-service-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |
| `bazos-service-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |
| `catalog-microservice-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |
| `cliplot-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |
| `flipflop-service-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |
| `heureka-service-secret` | **`HEUREKA_INTERNAL_SERVICE_TOKEN`** ← different key name, same value |
| `marketing-microservice-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |
| `orders-microservice-secret` | `CATALOG_INTERNAL_SERVICE_TOKEN` |

Eight ExternalSecrets reference that one property. **A grep for the key name finds seven of
the eight** — heureka's differs. Enumerate by fingerprint, never by name.

### Why it is worse than `a2880693` was

`catalog-auth.guard.ts:100-143` mints, from an **unauthenticated** header:

```ts
roles: ['internal:catalog-microservice:admin', 'catalog:write']
```

The token is only string-compared; identity comes from `x-service-name`. Any holder can
claim to be any name on the allowlist. That grant satisfies `defaultWriteRoles`, which
applies to **every route without an explicit `@RequireCatalogRoles`** — so a single leaked
string is full catalog write access.

The allowlist (guard lines 165-186) constrains *which names* may be claimed, not which
caller is which. It is a real mitigation — it stops an arbitrary name being written into the
audit trail — but it is not authentication.

### It is used in both directions

`orders-microservice-secret#CATALOG_INTERNAL_SERVICE_TOKEN` serves **two** lanes:

- **outbound** orders → catalog (`orders/src/pricing/pricing.service.ts:33`)
- **inbound** catalog → orders (`orders/src/auth/jwt-roles.guard.ts:223`, the last static entry)

And catalog → orders falls back to the *same* variable
(`catalog/src/products/products.service.ts:2841`). Untangling these is why this plan has a
strict order. **This is the trap that caused a near-miss in §6ax:** patching the shared
property looks like a caller-side change and is actually an eight-service inbound change.

---

## 2. The blocking constraint

The provisioner (`scripts/provision-service-token.js`) issues **only**
`internal:<service>:<role>` strings. Verified:

```
internal:catalog-microservice:service    roleFound: true
internal:catalog-microservice:admin      roleFound: true
internal:catalog-microservice:readonly   FAILED "Role not found … Run seed first"
catalog:authenticated                    FAILED "Only internal:<service>:<role> supported"
catalog:write                            FAILED "Only internal:<service>:<role> supported"
```

**39 of 45 catalog routes require `catalog:authenticated`, which no minted principal can
ever hold.** So the split cannot be done by swapping credentials alone — catalog's guard
must first accept internal service roles wherever it currently accepts `catalog:authenticated`
and `catalog:write`. That guard change is Phase 1 and everything else depends on it.

`internal:catalog-microservice:readonly` must also be seeded, or read-only callers have no
role below `admin` and the exercise grants nothing narrower.

---

## 3. Callers, measured

| Caller | Names sent | Catalog paths | Writes | Target role |
| --- | --- | --- | --- | --- |
| allegro | `allegro-service` | 13 | 6 | `internal:catalog-microservice:service` |
| flipflop | 4 names (api-gateway, cart, order, product) | 11 | 2 | `service` |
| heureka | `heureka-service` | 7 | 2 | `service` |
| bazos | `bazos-service` | 4 | 2 | `service` |
| cliplot | `cliplot` | 4 | **0** | **`readonly`** ← privilege reduction |
| marketing | `marketing-microservice` | 3 | **0** | **`readonly`** ← privilege reduction |
| orders | `orders-microservice` | pricing updates | yes | `service` |
| catalog (self) | `catalog-microservice` | own projection route | yes | `service` |

Two callers drop from *de facto* admin+write to read-only. That is the concrete security win,
beyond removing the shared value.

**flipflop needs one principal, not four.** All four containers mount one Secret; the four
names exist only because each derives its own `SERVICE_NAME`. One credential, and the
`x-service-name` header becomes decorative once identity comes from the token.

---

## 4. Phases

Each phase is independently deployable and independently revertible. **Do not begin a phase
until the previous one is verified live in the pod.**

### Phase 0 — seed the missing role (auth-microservice)

Seed `internal:catalog-microservice:readonly`. No behaviour change; nothing consumes it yet.

Gate: `--check-db-only` returns `roleFound: true`.

### Phase 1 — catalog accepts internal roles (catalog-microservice)

The keystone. In `catalog-auth.guard.ts`, extend role matching so that:

- routes requiring `catalog:authenticated` also accept
  `internal:catalog-microservice:{service,readonly,admin}`
- `defaultWriteRoles` also accepts `internal:catalog-microservice:service`

Do **not** touch `resolveInternalServiceActor` yet. After this phase both paths work: the
static header still grants admin+write, and a Bearer principal also works. That overlap is
what makes Phases 2-4 safe one caller at a time.

Gate: a freshly minted `readonly` principal gets **200** on a read route and **403** on a
write route; the static path is unchanged. Both measured from a pod.

### Phase 2 — pilot one caller (cliplot)

Smallest surface, zero writes, and its ES entry is already a matched pair.

1. mint `svc-cliplot--catalog-microservice`, role `readonly`
2. add a **new** Vault property `secret/prod/cliplot#CATALOG_SERVICE_TOKEN` — never write the
   shared property
3. add an ES entry for the new key; `kubectl apply`, `force-sync`
4. switch cliplot's caller to `Authorization: Bearer`, keeping the old header until verified
5. restart, verify in-pod fingerprint, probe reads **200** and a write **403**

Gate: cliplot reads catalog over Bearer, and the other seven holders are untouched
(fingerprint scan before and after).

### Phase 3 — remaining external callers

Repeat Phase 2 for marketing (`readonly`), then bazos, heureka, allegro, flipflop
(`service`). **One caller per change, verified before the next.** flipflop is last of these:
five services share one `envFrom`, so its blast radius is widest.

Gate per caller: that caller on Bearer; every other holder's fingerprint unchanged.

### Phase 4 — the orders/catalog pair, both directions

Deliberately last, because one value serves both lanes.

1. orders → catalog: mint `svc-orders-microservice--catalog-microservice` (`service`), new
   property, switch `pricing.service.ts` to Bearer, verify
2. catalog → orders: remove the `CATALOG_INTERNAL_SERVICE_TOKEN` fallback in
   `products.service.ts:2841` so it uses only `ORDERS_SERVICE_TOKEN`; mint that per-pair
   principal if absent, verify
3. catalog → itself: the self-call for the flipflop projection gets its own principal

Gate: both directions on Bearer, each verified from its own pod.

### Phase 5 — close the static path

Only when Phases 2-4 are green for **all eight** holders:

1. delete `catalog-microservice` from orders' `configuredServices` — the map becomes empty,
   so delete `resolveInternalServiceActor` and its ambiguity check entirely
2. delete `resolveInternalServiceActor` from catalog's guard, plus
   `allowedInternalServiceNames` and `CATALOG_INTERNAL_SERVICE_NAMES`
3. remove the eight ES entries, then delete the Vault property — **in that order**: ESO does
   not prune, so deleting the property first leaves the key in every Secret
4. rotate nothing — the value is dead once no consumer reads it

Gate: `5f420714` returns zero hits in a full-namespace fingerprint scan, and every lane still
green.

---

## 5. Rules carried from this session's mistakes

- **Fingerprint every holder before writing to a shared property.** A key name matching the
  receiver's variable is not evidence of ownership. This property was patched once in error;
  it was caught only because no ExternalSecret had synced yet.
- **Never write the shared property.** Every phase adds a *new* per-caller property. The
  shared one is deleted at the end, never mutated.
- **A deploy is not a rotation.** Committing a caller's switch does not move the credential
  into its pod — only an ES sync plus a restart does. Shipping a caller switch while the
  pod still holds the old value produced a 401 outage in §6ax.
- **Verify in the pod, not at the Secret.** Three of five flipflop pods were failing while
  Vault, the ES and the Secret all read correct (§6av).
- **Read unexpected statuses.** A 500 during a credential probe uncovered a TypeORM bug that
  had broken catalog's only orders endpoint on every call.
- **A test that passes both before and after proves nothing.** Two checks in §6aw/§6ax were
  passing vacuously. Confirm each new assertion fails on revert.

---

## 6. Risk and sequencing

Highest risk is Phase 1 (touches every catalog route) and Phase 4 (one value, two
directions). Phases 2-3 are low risk: additive per caller, and the static path stays live
until Phase 5.

Rollback at any point before Phase 5 is a revert plus restart — the shared value is still
present and still accepted throughout.

**Do not compress phases.** The overlap window where both paths work is the entire safety
mechanism; removing it early converts a reversible step into an eight-service outage.

## 7. Open questions for the owner

1. `internal:catalog-microservice:readonly` does not exist. Seed it (Phase 0), or accept that
   cliplot and marketing keep `service` and the privilege reduction is lost?
2. `catalog:authenticated` guards 39 routes and is not mintable. Phase 1 assumes widening the
   guard to accept internal roles. The alternative — making it mintable — would need
   provisioner changes and is a larger blast radius. Confirm the guard-side approach.
3. Phase 5 deletes catalog's `x-service-name` allowlist entirely. It currently protects the
   audit trail. Confirm that token-derived identity is an acceptable replacement for the
   `sub`/`source` fields written onto product events.
