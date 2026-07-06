# VAL-W6B Orders Action-Admin Runtime Projection

Date: 2026-07-06 Europe/Prague
Repo: auth-microservice
Runtime mutation: true, approved by owner in thread for W6-B blocker closure
Sensitive output: redacted; no token/JWT/user email/raw secret printed

## Intent Preservation Chain

Vision -> Orders remains central lifecycle authority.
Goal Impact -> FlipFlop can invoke Orders-owned admin lifecycle action without local lifecycle drift.
System -> Auth owns RBAC role seed and JWT issuance; Vault/ExternalSecret projects the token; Orders enforces action-admin.
Feature -> `internal:orders-microservice:action-admin` runtime role and service JWT for FlipFlop `ORDERS_STATUS_SERVICE_TOKEN`.
Task -> Close W6-B Auth role/token projection blocker without exposing token values.
Execution Plan -> run source verifier, run in-pod DB check, apply existing RBAC seed, provision token through existing helper, validate role booleans, patch Vault via file payload, refresh ExternalSecret.
Coding Prompt -> use existing guarded helpers only; no raw token output; no direct Orders DB/status mutation.
Code -> no source code changes.
Validation -> evidence below.

## Evidence

- `node scripts/verify-orders-action-admin-rbac-seed.js` passed.
- In-pod helper initially returned `Role not found for internal:orders-microservice:action-admin. Run seed first.`
- Existing `scripts/seed-rbac.ts` was compiled to `/tmp` and run inside the Auth pod; it created `internal:orders-microservice:action-admin` for `orders-microservice`.
- `scripts/provision-internal-service-token.ts` dry-run returned `applicationFound=true`, `roleFound=true`, `wouldCreateUser=true`, `wouldAssignRole=true`, `mutatesDatabase=false`, `emitsToken=false`.
- Approved apply created/normalized service principal `orders-action-admin@internal.invalid`, assigned `internal:orders-microservice:action-admin`, and wrote JWT only to `/tmp/orders-action-admin.jwt` mode `0600`.
- Auth `/auth/validate` boolean proof returned `valid=true`, `hasActionAdmin=true`, `roleCount=1`, `tokenPrinted=false`.
- Vault was unsealed through the existing `shared/scripts/vault-unseal.sh` runbook after ExternalSecret reported `Vault is sealed`.
- Vault path `secret/prod/flipflop-service#ORDERS_STATUS_SERVICE_TOKEN` was patched using `vault kv patch -mount=secret prod/flipflop-service @/tmp/orders-action-admin-vault.json`; token value was not printed.
- Temp token/helper files were removed from host and pod.
- `flipflop-service-secret` ExternalSecret became `Ready=True SecretSynced`.

## Verdict

Status: `runtime_projection_complete`.

Resolved blockers:

- `[RESOLVED: Auth runtime role seed for internal:orders-microservice:action-admin]`
- `[RESOLVED: approved action-admin token projection after role seed]`

Remaining ownership moved to FlipFlop/Orders smoke evidence.

Next step: Consume the projected token from FlipFlop order-service and run the guarded W6-B synthetic create/read/cancel proof.
