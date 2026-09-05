# Consumer JWT Validation Standard

Date: 2026-06-12
Status: approved
Remediation chunk: RBAC-REM-02

## Decision

Consumers must validate Auth-issued user access tokens with one of two approved patterns:

1. Default pattern: call Auth `POST /auth/validate`.
2. High-throughput backend exception: use an approved shared local verifier that follows this standard.

Auth remains the identity, token, and RBAC role-claim authority in both patterns. Consumers may enforce endpoint authorization locally, but they must not mint Auth JWTs, rewrite Auth role ownership, or silently change Auth role scope semantics.

## Default Pattern

Use `POST /auth/validate` for admin panels, browser-facing backends, lower-throughput APIs, services that do not need JWT verification secret material, and consumers that need fresh Auth role state during request handling.

Server-side consumers in Kubernetes should use `AUTH_SERVICE_URL=http://auth-microservice:3370` and call `POST /auth/validate` with a body containing a token field. On success, Auth returns `valid: true` and a user object with Auth-owned roles. Token values must never be logged, placed in URLs, copied into docs, or persisted in reports.

## Shared Local Verifier Exception

A backend service may validate locally only when all of these are true:

- The service has a clear throughput or availability reason to avoid per-request Auth round trips.
- Verification uses centrally sourced Auth verification secret material, not a service-owned signing secret path.
- The verifier rejects unsigned or unexpected algorithms and does not trust decoded payloads before signature verification.
- The verifier enforces token expiry and standard JWT validation failures.
- The verifier preserves full Auth role strings, including `global:`, `app:`, and `internal:` scopes.
- The verifier treats Auth roles as identity/RBAC claims and keeps endpoint authorization policy in the consumer.
- The verifier logs only safe metadata and never logs token bodies or secret values.

Current direct local verifier consumers are `catalog-microservice`, `warehouse-microservice`, `suppliers-microservice`, `orders-microservice`, `payments-microservice`, and `notifications-microservice`. RBAC-REM-01 aligned the first five consumers to source `JWT_SECRET` from the Auth Vault path where direct verification remains in use.

## Prohibited Patterns

Consumers must not mint Auth user JWTs locally, validate them with service-owned signing secrets, hand-roll divergent expiry/algorithm/claim assumptions, or strip Auth role scopes as a generic rule.

Machine identity is governed exclusively by [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](SERVICE_IDENTITY_CONSUMER_STANDARD.md).

## Consumer Classification

| Consumer | Standard classification | Follow-up |
| --- | --- | --- |
| `shop-assistant` | Default `POST /auth/validate` | No RBAC-REM-02 code change required. |
| `runlayer` | Default `POST /auth/validate` for user tokens | Service-token bypass belongs to RBAC-REM-06. |
| `speakasap/api-gateway` | Default `POST /auth/validate` | Scoped role normalization remains RBAC-REM-04 for other SpeakASAP services. |
| `school-committee` | Auth identity validation plus local school authorization | Local-role ownership note remains RBAC-REM-05. |
| `logging-microservice` web admin | Default `POST /auth/validate` | Privileged backend role enforcement remains RBAC-REM-07. |
| `catalog-microservice` | Shared local verifier exception | Frontend stale role assumption remains RBAC-REM-03. |
| `warehouse-microservice` | Shared local verifier exception | Future shared verifier module candidate. |
| `suppliers-microservice` | Shared local verifier exception | Future shared verifier module candidate. |
| `orders-microservice` | Shared local verifier exception | Future shared verifier module candidate. |
| `payments-microservice` | Shared local verifier exception | API-key bypass belongs to RBAC-REM-06. |
| `notifications-microservice` | Mixed approved patterns | Consolidation can happen in a future service-local chunk. |

## Validation Checklist

Before closing a consumer migration or verifier change, record which pattern the consumer uses, whether Auth role strings are preserved or explicitly mapped to local roles, whether expiry/signature validation is enforced, whether `JWT_SECRET` comes from the Auth secret source when present, whether machine-auth paths are separated from user RBAC, and which tests or request-level checks passed.
