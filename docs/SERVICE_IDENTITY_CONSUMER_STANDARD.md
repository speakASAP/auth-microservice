# Service Identity Consumer Standard

Date: 2026-06-24 · **revised 2026-08-25**
Status: active standard
Canonical file: `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`

## Decision

Auth remains the owner of human identity, credentials, user JWTs, and Auth RBAC role claims. Service-to-service credentials are machine identity, not human identity. Consumers must keep machine identity separate from Auth-issued user access tokens even when both paths meet in the same guard.

**The standard for service-to-service and agent-to-agent calls is an Auth-issued RS256 service JWT, one principal per `(caller → target)` pair, carrying least-privilege role claims.**

```
email: svc-<caller>--<target>@internal.alfares.cz
name:  <caller>--<target>
role:  internal:<target>:<least-privilege-role>
alg:   RS256, signed by auth only
exp:   90 days, rotated automatically
```

Issued exclusively by `scripts/provision-service-token.js`. Receivers validate through `POST /auth/validate` (or the approved local RS256 verifier) and enforce the role claim.

### Why per-pair, and why not a shared static token

Revised 2026-08-25 after an ecosystem-wide credential outage. The previous revision preferred a shared static `x-internal-service-token` for new machine paths. That contract cannot satisfy two requirements the owner has since made explicit, and it is no longer the preferred shape:

1. **Blast radius must be one service.** `InternalServiceGuard` compares against a single shared `INTERNAL_SERVICE_TOKEN`. Every holder presents the identical string, so one leak forces simultaneous rotation everywhere — the same failure mode as the shared HS256 `JWT_SECRET` retired in `9269a86`. A per-pair principal is revoked by deactivating that principal alone.

2. **Authorization must be role-based.** The static contract is a binary string comparison; `x-service-name` is self-asserted by the caller and any holder can claim any trusted name. A service JWT carries `roles`, enforced by `JwtRolesGuard`, so a stolen catalog→warehouse token cannot call bazos.

Per-application *signing keys* were considered and rejected: they replace one key-distribution problem with N, and do not bound the only remaining ecosystem-wide risk (auth's private key). That risk is bounded instead by 90-day lifetimes and `kid`-based rotation, which JWKS already supports without redeploy.

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
- grant `global:superadmin` to a service token. Use the narrowest `internal:<target>:<role>` the call path needs.

## Rotation

Service tokens live 90 days and are rotated automatically. **Rotation must verify acceptance, never trust `exp`.**

A token can be unexpired and still refused — a signing-algorithm change, a key rotation, or a deactivated principal all produce a healthy-looking credential that every verifier rejects. On 2026-08-18 that was true of 41 tokens at once, several with `exp` in 2027; an `exp`-based check would have called every one of them healthy. The rotation job asks the receiving service whether the token is accepted and re-mints on any rejection, following the pattern proven in `shared/scripts/rotate-logging-admin-token.sh`.

Rotation failures must raise and alert. A rotation job that silently skips is how tokens reached 2027 expiries unnoticed.

## Migration Policy

New machine-auth paths use Auth-issued per-pair RS256 service JWTs. Existing static-token paths are migrated per calling pair, tracked in `docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`. The integration owner must keep human Auth migration and service-token redesign in separate workstreams unless the same code path cannot be made safe without doing both together.

**A credential lane is not closed until an authenticated call has been proven to succeed.** Verifying that a secret key is present, that an ExternalSecret reports `SecretSynced`, or that a pod restarted proves plumbing, not acceptance — `catalog-microservice/scripts/check-stock-credential-wiring.sh` reported `status: passed` throughout the outage because it never made an authenticated call.
