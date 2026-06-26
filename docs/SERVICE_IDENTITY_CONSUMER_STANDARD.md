# Service Identity Consumer Standard

Date: 2026-06-24
Status: active transition standard
Canonical file: `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`

## Decision

Auth remains the owner of human identity, credentials, user JWTs, and Auth RBAC role claims. Service-to-service credentials are machine identity, not human identity. Consumers must keep machine identity separate from Auth-issued user access tokens even when both paths meet in the same guard.

The preferred new internal-service contract is:

```http
x-internal-service-token: <runtime-secret-token>
x-service-name: <trusted-service-name>
```

The receiving service may restrict `x-service-name` through an allowlist such as `TRUSTED_INTERNAL_SERVICES`. The token value must come from the approved runtime secret source. Token values, API keys, JWTs, and decoded secret material must never be logged, committed, printed in reports, or copied into docs.

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
- Catalog-to-Warehouse and Orders-to-Warehouse service bearer tokens need explicit receiving-side classification: either Auth-compatible service JWTs or documented service-local machine auth.

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
- create new service-token formats when the preferred `x-internal-service-token` plus `x-service-name` contract can be used.

## Migration Policy

New machine-auth paths should use the preferred header contract. Existing paths should be migrated opportunistically in service-owned lanes after user-auth migration is stable. The integration owner must keep human Auth migration and service-token redesign in separate workstreams unless the same code path cannot be made safe without doing both together.
