# Removed provisioning scripts (2026-08-25)

Three service-token provisioning scripts were removed and replaced by one:

**`scripts/provision-service-token.js`**

| Removed | Why |
|---|---|
| `provision-internal-service-token.ts` | Signed with `new JwtService({ secret: process.env.JWT_SECRET })` — HS256. Also wrote principals via raw `INSERT INTO users`, bypassing entity defaults and validation. |
| `provision-catalog-warehouse-service-token.ts` | Signed HS256 via the app's `JwtService`. Hardcoded to one caller/target pair. |
| `provision-goal24-actor-token.js` | Hand-rolled `crypto.createHmac('sha256', secret)` — HS256, outside any JWT library. |

auth retired HS256 on 2026-08-18 (`9269a86`) and verifies RS256 only. All three
would therefore mint a credential that looks healthy — correct roles, far-future
`exp` — and is refused by every verifier in the ecosystem. That failure mode is
exactly what caused the outage documented in
`docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`.

Having four scripts was itself the problem: each incident produced a new one
instead of fixing the last. There is now one, it asserts RS256 on the token it
just signed rather than trusting configuration, and it carries `--check-db-only`
from the generic predecessor.

Historical documents referencing the removed filenames are left unchanged; they
are accurate records of what was run at the time. For any new work use
`provision-service-token.js`, which runs inside the auth pod:

```bash
kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
  node scripts/provision-service-token.js \
  --email=svc-<caller>--<target>@internal.alfares.cz \
  --service-name=<caller> \
  --role=internal:<target>:<role> \
  --check-db-only
```
