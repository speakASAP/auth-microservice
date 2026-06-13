# Internal Service Auth Boundary Review

Date: 2026-06-13
Remediation chunk: RBAC-REM-06
Scope: documentation-only inventory of service-token and API-key machine-auth paths observed in Auth consumers.

## Decision

Static service tokens and API keys are machine-auth credentials, not Auth user identity and not Auth RBAC role claims. They may remain valid for service-to-service calls, smoke checks, provider callbacks, and tightly scoped internal APIs, but they must stay separate from Auth-issued user access tokens.

Auth's canonical internal-service contract uses:

```http
x-internal-service-token: <INTERNAL_SERVICE_TOKEN>
x-service-name: <trusted-service-name>
```

`TRUSTED_INTERNAL_SERVICES` may restrict accepted caller names. Consumer-owned machine-auth paths can keep existing headers while they are service-local, but they should not be documented as Auth RBAC enforcement.

## Inventory

| Service | Machine-auth surface | Header or channel | Current behavior | Boundary assessment |
| --- | --- | --- | --- | --- |
| `auth-microservice` | Internal Auth APIs for preferences, unsubscribe, magic-link token creation, and email lookup | `x-internal-service-token` plus `x-service-name` | `InternalServiceGuard` checks `INTERNAL_SERVICE_TOKEN` and optional `TRUSTED_INTERNAL_SERVICES`. | Canonical Auth internal-service contract. |
| `catalog-microservice` | Protected catalog mutation routes | `x-internal-service-token` plus `x-service-name` | `CatalogAuthGuard` accepts `CATALOG_INTERNAL_SERVICE_TOKEN` or `INTERNAL_SERVICE_TOKEN` and grants `internal:catalog-microservice:admin` plus `catalog:write`. | Compatible header shape, but the authorization is Catalog-local service auth, not user RBAC. Consider a trusted-caller allowlist if more callers are added. |
| `catalog-microservice` to `warehouse-microservice` | Warehouse availability client | `Authorization: Bearer <WAREHOUSE_SERVICE_TOKEN>` | Catalog sends a configured warehouse token to `/api/stock/availability/batch`. | Receiver contract needs follow-up: inspected Warehouse guard validates Auth-signed JWT roles and does not show a static service-token bypass. The token must be an Auth-compatible service JWT or the caller/receiver contract should be reconciled in the owning services. |
| `notifications-microservice` | Admin/read-only smoke and protected admin APIs | `Authorization: Bearer <SERVICE_TOKEN>` | Global `JwtRolesGuard` accepts `SERVICE_TOKEN` and grants `global:superadmin` plus `internal:notifications-microservice:admin`. | Valid machine-auth path if restricted to trusted automation, but it shares the user-token bearer channel and grants broad roles. Keep it documented as service auth and prefer the canonical internal-service header shape for new machine paths. |
| `notifications-microservice` to `runlayer` | Orchestrator client | `Authorization: Bearer <ORCHESTRATOR_SERVICE_TOKEN>` | Notifications calls RunLayer with a service token. | Non-user machine auth. Caller token must not be treated as Auth user identity in RunLayer. |
| `notifications-microservice` to AI service | Telegram bot AI calls | `Authorization: Bearer <AI_SERVICE_TOKEN>` | Notifications calls AI service with a configured token. | Non-user machine auth outside Auth RBAC. |
| `runlayer` | Most dashboard/project/goal/task APIs using `JwtGuard` | `Authorization: Bearer <NOTIFICATIONS_SERVICE_TOKEN>` or `<ORCHESTRATOR_SERVICE_TOKEN>` or `<ORCHESTRATOR_USER_JWT>` | `JwtGuard` accepts configured static tokens without calling Auth and sets `request.userId` to `notifications-microservice`. | Needs cleanup in a service-local chunk: static service-token bypass should identify the actual caller and `ORCHESTRATOR_USER_JWT` should not be accepted as a machine bypass unless it is intentionally a service credential. |
| `runlayer` to notifications and AI | Outbound clients | `Authorization: Bearer <NOTIFICATIONS_SERVICE_TOKEN>` and AI token | Configured service tokens are used for service-to-service calls. | Non-user machine auth. Keep separate from Auth user token validation. |
| `payments-microservice` | Payments/connect APIs and JWT-protected APIs | `X-API-Key` / `x-api-key` | `ApiKeyGuard` validates `API_KEYS`; `JwtRolesGuard` also bypasses user JWT checks when the key is valid. `ApiKeyGuard` permits requests when `API_KEYS` is empty, intended for development. | Payments-owned API-key auth, not Auth RBAC. Production must keep `API_KEYS` configured; new internal service calls should prefer canonical internal-service headers or an explicit payments API-key contract. |
| `payments-microservice` outbound callbacks | Provider/application callbacks | `X-API-Key` | `PAYMENT_CALLBACK_API_KEYS` and fallback keys are used for outbound callback authentication. | Provider/application callback auth, not user RBAC. |

## Boundary Rules

- User requests must use Auth-issued access tokens validated through `POST /auth/validate` or the approved shared local verifier pattern.
- Static service tokens and API keys must not be used as substitutes for Auth user identity.
- Machine-auth acceptance must create a service actor, not a human user.
- Machine-auth logs may include service name, route, status, and request ID, but must never include token or API-key values.
- New internal Auth-owned endpoints should use Auth's canonical `x-internal-service-token` plus `x-service-name` contract.
- Consumer-owned machine-auth paths may remain service-specific, but the owning service must document header names, trusted callers, rotation source, and whether the path is read-only, write-capable, or smoke-only.

## Follow-Ups

1. `runlayer`: split service-token bypasses from user JWT handling, avoid accepting `ORCHESTRATOR_USER_JWT` as a static machine credential unless deliberately renamed or documented, and preserve the real caller identity.
2. `notifications-microservice`: consider replacing broad `SERVICE_TOKEN` bearer admin bypass with canonical internal-service headers for smoke/automation paths or constrain it by route.
3. `payments-microservice`: require non-empty `API_KEYS` outside local development and document `X-API-Key` as payments-owned API auth, not Auth RBAC.
4. `catalog-microservice` and `warehouse-microservice`: reconcile the warehouse availability service-token contract so Catalog's bearer token is either an Auth-compatible service JWT or Warehouse exposes a documented machine-auth path.
5. Future shared standard: define one ecosystem machine-auth naming convention for `x-internal-service-token`, caller names, rotation paths, and redaction requirements.

## Validation Evidence

- DocsRAG returned `HTTP 200` from `deployment/auth-microservice` without printing the pod token.
- Inspected Auth `InternalServiceGuard` and internal Auth endpoint guards.
- Inspected RunLayer `JwtGuard`, service-token environment keys, and outbound token configuration.
- Inspected Notifications `JwtRolesGuard`, deployment notes, and orchestrator/AI clients.
- Inspected Payments `ApiKeyGuard`, `JwtRolesGuard`, controller guard usage, and key configuration docs.
- Inspected Catalog `CatalogAuthGuard` and warehouse availability client.
- Inspected Warehouse `JwtRolesGuard` as the receiving side for the Catalog availability call.
- No decoded secrets, JWTs, service tokens, API keys, passwords, OAuth tokens, reset tokens, magic-link tokens, or production user data were printed or recorded.
