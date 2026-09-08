# Consumer JWT Validation Standard

Date: 2026-06-12
Updated: 2026-09-08
Status: approved
Scope: human / user access tokens only

Machine identity is governed exclusively by [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](SERVICE_IDENTITY_CONSUMER_STANDARD.md).

## Decision

Consumers must validate Auth-issued user access tokens with one of two approved patterns:

1. Default pattern: call Auth `POST /auth/validate`.
2. High-throughput backend exception: verify locally with Auth's RS256 public key via JWKS (`/.well-known/jwks.json`) or the same verifier module Auth publishes for consumers.

Auth remains the identity, token, and RBAC role-claim authority in both patterns. Consumers may enforce endpoint authorization locally, but they must not mint Auth user JWTs, rewrite Auth role ownership, or silently change Auth role scope semantics.

Auth signs user and service JWTs with **RS256 only**. Consumers must not verify tokens with `JWT_SECRET` (HMAC). `JWT_SECRET` is Auth-internal material for non-JWT HMAC helpers and is not a verifier secret.

The shared local verifier is an approved human-lane pattern for **user** tokens only. Do not use it for service tokens, and do not mix service credentials into user validation.

## Default Pattern

Use `POST /auth/validate` for admin panels, browser-facing backends, lower-throughput APIs, services that do not need JWKS material, and consumers that need fresh Auth role state during request handling.

Server-side consumers in Kubernetes should use `AUTH_SERVICE_URL=http://auth-microservice:3370` and call `POST /auth/validate` with a body containing a token field. On success, Auth returns `valid: true` and a user object with Auth-owned roles. Token values must never be logged, placed in URLs, copied into docs, or persisted in reports.

## Shared Local Verifier Exception

A backend service may validate user tokens locally only when all of these are true:

- The service has a clear throughput or availability reason to avoid per-request Auth round trips.
- Verification uses Auth RS256 material only: JWKS from Auth, or `JWT_PUBLIC_KEY` / `JWT_KEY_ID` sourced from the Auth Vault path — never `JWT_SECRET`, never a service-owned signing secret.
- The verifier accepts `alg=RS256` only and rejects every other algorithm (including HS256).
- The verifier enforces token expiry and standard JWT validation failures.
- The verifier preserves full Auth role strings, including `global:`, `app:`, and `internal:` scopes.
- The verifier treats Auth roles as identity/RBAC claims and keeps endpoint authorization policy in the consumer.
- The verifier logs only safe metadata and never logs token bodies or secret values.
- The verifier is not used to accept, mint, or dual-accept machine/service credentials.

Current direct local verifier consumers are `catalog-microservice`, `warehouse-microservice`, `suppliers-microservice`, `orders-microservice`, `payments-microservice`, and `notifications-microservice`.

## Prohibited Patterns

Consumers must not mint Auth user JWTs locally, validate them with `JWT_SECRET` or service-owned signing secrets, hand-roll divergent expiry/algorithm/claim assumptions, strip Auth role scopes as a generic rule, or treat static service tokens / API keys as user identity.

## Consumer Classification

| Consumer | Standard classification | Follow-up |
| --- | --- | --- |
| `shop-assistant` | Default `POST /auth/validate` | — |
| `runlayer` | Default `POST /auth/validate` for user tokens | — |
| `speakasap/api-gateway` | Default `POST /auth/validate` | Scoped role normalization remains RBAC-REM-04 for other SpeakASAP services. |
| `school-committee` | Auth identity validation plus local school authorization | Local-role ownership note remains RBAC-REM-05. |
| `logging-microservice` web admin | Default `POST /auth/validate` | Privileged backend role enforcement remains RBAC-REM-07. |
| `catalog-microservice` | Shared local RS256/JWKS verifier | Frontend stale role assumption remains RBAC-REM-03. |
| `warehouse-microservice` | Shared local RS256/JWKS verifier | — |
| `suppliers-microservice` | Shared local RS256/JWKS verifier | — |
| `orders-microservice` | Shared local RS256/JWKS verifier | — |
| `payments-microservice` | Shared local RS256/JWKS verifier | — |
| `notifications-microservice` | Shared local RS256/JWKS verifier | — |

## Validation Checklist

Before closing a consumer migration or verifier change, record which pattern the consumer uses for **user** tokens, whether Auth role strings are preserved or explicitly mapped to local roles, whether expiry/signature validation is enforced with RS256 only, and that no `JWT_SECRET` HMAC verify path remains. Record which tests or request-level checks passed. Do not invent or document machine-auth exceptions here; use [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](SERVICE_IDENTITY_CONSUMER_STANDARD.md).
