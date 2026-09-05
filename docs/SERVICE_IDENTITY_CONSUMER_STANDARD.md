# Service Identity Consumer Standard

Date: 2026-06-24 · **revised 2026-08-25**
Status: **active standard — canonical, single point of truth**
Canonical file: `auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`

> **This is the single point of truth for how one service authenticates to
> another, how service tokens are minted and rotated, and how service RBAC is
> enforced.** It covers agent-to-agent calls over HTTP; see Scope for other
> channels. Registered in
> [`shared/docs/DOCUMENTATION_AUTHORITY.md`](../../shared/docs/DOCUMENTATION_AUTHORITY.md)
> and in the read order of [`shared/AGENTS.md`](../../shared/AGENTS.md).
>
> Adjacent lanes, deliberately separate — do not merge them into this one:
>
> | Question | Canonical document |
> | --- | --- |
> | A service calls another service (machine identity) | **this file** |
> | A consumer validates a human user's token | [`CONSUMER_JWT_VALIDATION_STANDARD.md`](CONSUMER_JWT_VALIDATION_STANDARD.md) |
> | An app sends humans to hosted login/registration | [`HOSTED_AUTH_CONSUMER_STANDARD.md`](HOSTED_AUTH_CONSUMER_STANDARD.md) |
> | Auth endpoints, JWT shape, CORS, OAuth, magic links | [`UNIFIED_AUTH_CONTRACT.md`](UNIFIED_AUTH_CONTRACT.md) |
> | Per-service migration status and evidence | [`RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`](RS256_SERVICE_TOKEN_MIGRATION_PLAN.md) |
>
> Anything else describing service-to-service credentials is historical. If
> another document contradicts this one, this one wins and the other is a bug
> to repair in its own source.

## Scope

This standard governs **request/response machine calls over HTTP**. Everything below —
headers, `POST /auth/validate`, route decorators, per-route role enforcement — is
HTTP-shaped. For other channels:

- **Message queues (RabbitMQ).** Publishing and consuming authenticate to the *broker*, not
  per message. A consumer must never treat a message as carrying caller authority: if handling
  it triggers a privileged action, re-authorise that action through an HTTP call bearing a
  service JWT.
- **CronJobs and CLI scripts.** A job that calls a service is a caller like any other and needs
  its own `(caller → target)` principal. Being internal or scheduled is not an exemption.
- **Agent-to-agent.** Follows whichever transport the call actually uses; over HTTP, this
  standard applies unchanged.

If a lane is not covered here, mark it `[MISSING: ...]` and resolve it rather than assuming it
is exempt.

## Decision

Auth remains the owner of human identity, credentials, user JWTs, and Auth RBAC role claims. Service-to-service credentials are machine identity, not human identity. Consumers must keep machine identity separate from Auth-issued user access tokens even when both paths meet in the same guard.

**The standard for service-to-service and agent-to-agent calls is an Auth-issued RS256 service JWT, one principal per `(caller → target)` pair, carrying least-privilege role claims.**

```
email: svc-<caller>--<target>@internal.alfares.cz
name:  <caller>--<target>
role:  internal:<target>:<least-privilege-role>
alg:   RS256, signed by auth only
exp:   90 days (re-minted by hand today — see Rotation)
```

Issued exclusively by `scripts/provision-service-token.js`. Receivers validate through `POST /auth/validate` (or the approved local RS256 verifier) and enforce the role claim.

**Minting procedure.** This document defines the *shape and the rules*; the executable steps
live in two places and are not duplicated here:

- the invocation, its `--dry-run` / `--confirm-db-mutation` / `--confirm-token-issuance` gates
  and the `--token-output` handling — header comment of
  `auth-microservice/scripts/provision-service-token.js`;
- the full Vault → `external-secret.yaml` → Deployment `secretKeyRef` → force-sync → restart →
  re-probe pipeline — [`RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`](RS256_SERVICE_TOKEN_MIGRATION_PLAN.md) § Phase 1.

Three traps in that pipeline each report success while delivering nothing, so read it rather
than improvising: a token written to the wrong service's Vault path is inert while ESO still
reports `SecretSynced`; **a Vault key never reaches a pod until `external-secret.yaml` names
it**; and roles are per-application rows that must be seeded before minting against them.

### Why per-pair, and why not a shared static token

Revised 2026-08-25 after an ecosystem-wide credential outage. The previous revision preferred a shared static `x-internal-service-token` for new machine paths. That contract cannot satisfy two requirements the owner has since made explicit, and it is no longer the preferred shape:

1. **Blast radius must be one service.** `InternalServiceGuard` compares against a single shared `INTERNAL_SERVICE_TOKEN`. Every holder presents the identical string, so one leak forces simultaneous rotation everywhere — the same failure mode as the shared HS256 `JWT_SECRET` retired in `9269a86`. A per-pair principal is revoked by deactivating that principal alone.

2. **Authorization must be role-based.** The static contract is a binary string comparison; `x-service-name` is self-asserted by the caller and any holder can claim any trusted name. A service JWT carries `roles`, enforced by `JwtRolesGuard`, so a stolen catalog→warehouse token cannot call bazos.

Per-application *signing keys* were considered and rejected: they replace one key-distribution problem with N, and do not bound the only remaining ecosystem-wide risk (auth's private key). That risk is bounded instead by 90-day lifetimes and `kid`-based rotation, which JWKS already supports without redeploy.

### Receivers must enforce the role, not just carry it

Added 2026-08-25 after validation. A per-pair token bounds *revocation* to one principal.
It bounds *authority* only if the receiving service can tell a read route from a write one.
Issuing `internal:<target>:readonly` is meaningless where every route resolves to the same
role.

Every service accepting service JWTs must therefore:

- decorate **every** route with an explicit role set, classified by effect rather than HTTP
  verb — `POST /stock/availability/batch` is a read;
- define those sets as named constants (`<SERVICE>_READ_ROLES`, `_WRITE_ROLES`,
  `_ADMIN_ROLES`) in `src/auth/roles.constants.ts`, never as inline strings;
- **deny an undecorated route** and log it at error level. A guard that falls back to
  `[global:superadmin, internal:<self>:admin]` silently grants mutation rights to read-only
  callers;
- scope any remaining static-token bypass to `:readonly`, and log a warning when it is used.

`orders-microservice/src/auth/jwt-roles.guard.ts` is the reference verifier;
`warehouse-microservice/src/auth/roles.constants.ts` is the reference role-constant layout and
the worked migration. (Orders keeps its own role sets in `src/admin/admin.service.ts` — that is
the exception, not the pattern to copy; it has no `src/auth/roles.constants.ts`.) Rollout and per-service status: `docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
§ Phase 1a.

### Status of the static header contract

`x-internal-service-token` + `x-service-name` is **legacy**. Existing paths keep working and must stay classified as machine auth, not Auth RBAC. No new path may adopt it. `INTERNAL_SERVICE_TOKEN` is scheduled for removal once existing consumers migrate; track in `docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`.

Token values, API keys, JWTs, and decoded secret material must never be logged, committed, printed in reports, or copied into docs.

## Human User Requests

Human/browser/API user requests must use Auth-issued access tokens and one of the approved validation patterns from `docs/CONSUMER_JWT_VALIDATION_STANDARD.md`:

- default: server-side `POST /auth/validate`;
- documented high-throughput exception: local verifier using Auth-owned verification material.

On success, consumers attach a user actor with Auth user id and Auth role strings. Local product authorization may decide whether that user can mutate a resource, but the consumer must not become the credential authority.

## Machine Requests

Machine requests must create a service actor, not a user actor. A service actor should include:

- `type`: `service`;
- `serviceName`: stable caller id, for example `orders-microservice`;
- `authMethod`: `internal-service-token`, `api-key`, or `auth-service-jwt`;
- `scopes` or local capabilities when the receiving service supports them.

When a service accepts service JWTs validated by Auth `/auth/validate`, the Auth validation response must expose an unambiguous service identity field such as `serviceName`, `service`, `clientId`, or `client_id`. Consumers may temporarily preserve these variants while the ecosystem converges, but new code should prefer `serviceName`.

## Existing Exceptions

Existing service-local API keys and bearer service tokens may remain only as documented transitional exceptions. They must be classified as machine auth, not Auth RBAC:

- `payments-microservice` `x-api-key` is Payments-owned API auth.
- `catalog-microservice` `x-internal-service-token` uses Auth-owned runtime secret source `secret/prod/auth-microservice#CATALOG_INTERNAL_SERVICE_TOKEN` for Goal 17 Catalog-to-Orders product statistics. Consumers still treat it as service identity, not user identity.
- `speakasap` `/api/v1/internal/...` `x-internal-token` paths are service-owned internal routes.
- Catalog-to-Warehouse and Orders-to-Warehouse service bearer tokens: **resolved 2026-08-25** as Auth-compatible per-pair RS256 service JWTs. This closes follow-up 4 of `INTERNAL_SERVICE_AUTH_BOUNDARY_REVIEW.md`, open since 2026-06-13. Leaving it open is what made the HS256 retirement an outage rather than a migration.
- **Log ingest (`logging-ingest-credentials#LOGGING_SERVICE_TOKEN`) is a shared static token, not per-pair — the largest remaining instance of the pattern this standard closes.** One opaque 64-character string is presented by every logger; `logging-microservice` accepts it via `LOG_INGEST_BEARER_TOKENS`. It is exactly the shape described above under "why not a shared static token": one leak forces rotation across every holder at once. (The separate *admin* token is already a compliant per-pair RS256 JWT; only the ingest credential is shared.)

  Measured 2026-09-04: 30 deployments hold it and log correctly; **11 do not hold it and are silently logging nothing** — `domain-research`, `leads-microservice`, `invoices-microservice`, `ai-microservice`, `shop-assistant`, `rent-a-box-api`, `heureka-service`, `allegro-service`, `bazos-service`, `aukro-service`, `agentic-email-processing-system`. Each has `LOGGING_SERVICE_URL` set, so it believes it is logging while ingest answers 401 and the client's catch discards the rejection.

  Do not close this by handing the shared string to the remaining 11 — that widens the blast radius this standard exists to shrink. Note also that the `secretKeyRef` for the existing holders lives only on live Deployment objects and in no manifest, so an apply from Git drops it silently: each of the 11 needs a **new** manifest entry, and there is no committed working example to copy.

  **Order matters, and the obvious fix does not work yet (verified 2026-09-05).** `logging-microservice` gates ingest on `LOG_INGEST_BEARER_TOKENS`, an opaque string allowlist — `src/auth/log-ingest.guard.ts` does a plain set-membership test with **no RS256 verification and no role enforcement**. Minting 11 per-pair `internal:logging-microservice:ingest` JWTs today produces 11 tokens that ingest rejects exactly as it rejects nothing at all. The receiver must be migrated to verify RS256 and enforce the role **first**; only then is minting the right move. Until that lands, these 11 services stay dark rather than being handed the shared string.

- **`domain-research` CronJobs — non-compliant, tracked 2026-09-05.** `k8s/expiry-recheck-cronjob.yaml` and `k8s/notification-dispatch-cronjob.yaml` sign their own HS256 token inline with `jwt.sign` over the shared `JWT_SECRET`, using an invented `sub` (`domain-research-expiry-cron`, no principal row, therefore unrevocable) and self-granting `internal:domain-research:admin`. That breaks four rules at once. Both manifests now carry a do-not-copy marker; replacing the credential needs a minted `internal:domain-research:jobs` principal and is a runtime change, not a doc edit. The compliant pattern to copy is `warehouse-microservice/k8s/reservation-expiry-cronjob.yaml`, which reads a mounted `WAREHOUSE_MAINTENANCE_TOKEN` and fails closed when it is absent.
- **`cv-tuning` → `ai-microservice`** signs its own token (`cv-tuning/src/ai/service-token.ts`), preferring RS256 and falling back to HS256 during the migration window. `ai-microservice` runs its own signing authority rather than accepting Auth-issued tokens. Legacy lane; do not copy it for a new service.
- **`WAREHOUSE_MAINTENANCE_TOKEN` and `CLIPLOT_WAREHOUSE_SERVICE_TOKEN`** are static bearer tokens scoped read-only or maintenance-only, documented in `RS256_SERVICE_TOKEN_MIGRATION_PLAN.md` § Phase 1a and slated for per-pair replacement. `warehouse-microservice/src/auth/jwt-roles.guard.ts` is the model for how a legacy credential should be commented and scoped.

Do not block hosted human login migration on these exceptions unless a single guard path cannot distinguish user and machine actors safely.

## Required Consumer Evidence

Before a service identity lane is closed, record:

- which headers or bearer channel are accepted;
- trusted caller names or scopes;
- where rotation is sourced, using key names only and no values;
- whether the route is read-only, write-capable, webhook, smoke-only, or admin-only;
- how the request actor is represented in code;
- tests or static checks proving user tokens still call Auth validation and machine tokens do not become users;
- redaction evidence proving no token/API-key/JWT values are logged or documented.

## Prohibited Patterns

Consumers must not:

- treat static service tokens or API keys as Auth users;
- grant human roles from a machine token without an explicit service actor boundary;
- accept empty API-key allowlists in production;
- log or return service-token/API-key values;
- mix `ORCHESTRATOR_USER_JWT` or other user-token names into machine bypasses without a documented owner approval;
- create new service-token formats — the Auth-issued per-pair RS256 service JWT is the only shape for new machine paths;
- mint service tokens with any script other than `scripts/provision-service-token.js`, or with any algorithm other than RS256;
- share one principal across multiple caller services, or reuse a token issued for one `(caller → target)` pair on a different pair;
- issue a service token whose `sub` is an invented string with no principal row — such a credential cannot be revoked;
- grant `global:superadmin` to a service token. Use the narrowest `internal:<target>:<role>` the call path needs;
- leave a route undecorated and rely on a guard's default role set, or store credential material in a ConfigMap rather than a Secret.

## Rotation

Service tokens live 90 days. **Rotation must verify acceptance, never trust `exp`.**

> **Corrected 2026-09-05: automatic rotation is designed but NOT deployed.** An
> earlier revision of this section said service tokens "are rotated
> automatically" and described "the rotation job" in the present tense. Verified
> against the live cluster: `kubectl get cronjob -n statex-apps` contains **no**
> `service-token-rotation` job, and no manifest for one exists in any repo. The
> Phase 6 design in
> [`RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`](RS256_SERVICE_TOKEN_MIGRATION_PLAN.md)
> is a specification, not a description of something running.
>
> **A token you mint today will expire unless you re-mint it by hand.**
>
> What does run is *detection*, and it is good:
> **`systemctl --user` `statex-token-health.timer`** (daily 07:15 +≤15min jitter,
> `shared/scripts/token-health/`, `Persistent=true`) decodes every
> credential-shaped env var mounted by a running pod and classifies at
> **WARN 21 days / CRITICAL 7 days**, forcing CRITICAL for HS256 and flagging
> `global:superadmin` regardless of `exp`; failures page via
> `statex-token-health-failure.service`.
>
> **Check it with `systemctl --user`, not `systemctl`.** A system-level copy is
> installed at `/etc/systemd/system/statex-token-health.timer` and is
> **disabled and dead**; the live one is the user timer. The unit files are
> byte-identical, so a bare `systemctl status` shows "inactive (dead)" and
> invites the wrong conclusion that detection is not running.
>
> It alerts on *transitions*, not standing state — with the exception of
> CRITICAL inside `URGENT_DAYS=7`, which re-alerts every run.
>
> Two credential jobs run automatically, and neither rotates a service token:
> `shared/scripts/rotate-logging-admin-token.sh` (user crontab 03:15) re-mints
> the logging *admin* token and is the reference implementation for the
> acceptance-probe pattern; `vault-eso-token-renew.timer` (daily) *renews* ESO's
> Vault token rather than re-minting it.
>
> **Until Phase 6 ships, treat a `token-health` WARN as the rotation trigger.**

A token can be unexpired and still refused — a signing-algorithm change, a key rotation, or a deactivated principal all produce a healthy-looking credential that every verifier rejects. On 2026-08-18 that was true of 41 tokens at once, several with `exp` in 2027; an `exp`-based check would have called every one of them healthy. Rotation — by hand today, by the Phase 6 job when it ships — asks the receiving service whether the token is accepted and re-mints on any rejection, following the pattern proven in `shared/scripts/rotate-logging-admin-token.sh`.

Rotation failures must raise and alert. A rotation job that silently skips is how tokens reached 2027 expiries unnoticed.

## Migration Policy

New machine-auth paths use Auth-issued per-pair RS256 service JWTs. Existing static-token paths are migrated per calling pair, tracked in `docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`. The integration owner must keep human Auth migration and service-token redesign in separate workstreams unless the same code path cannot be made safe without doing both together.

**A credential lane is not closed until an authenticated call has been proven to succeed.** Verifying that a secret key is present, that an ExternalSecret reports `SecretSynced`, or that a pod restarted proves plumbing, not acceptance — `catalog-microservice/scripts/check-stock-credential-wiring.sh` reported `status: passed` throughout the outage because it never made an authenticated call.
