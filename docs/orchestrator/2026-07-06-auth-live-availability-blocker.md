# 2026-07-06 Auth Live Availability Blocker

## Scope

Read-only live check before any email-change SQL/deploy/runtime smoke.

## Evidence

- `https://auth.alfares.cz/health` returned `no available server`.
- `npm run check:customer-data-wallet-hosted-profile-static -- --base-url=https://auth.alfares.cz --no-write-report` failed with:
  - `/profile` HTTP `503`
  - `/js/profile.js` HTTP `200`
  - missing latest hosted profile markers including `id="email-change-form"`, `name="avatarUrl"`, `name="settings"`, and `fetchJson('/auth/email-change-request')`
- Kubernetes read-only status:
  - `deployment/auth-microservice` was `0/1`, image `localhost:5000/auth-microservice:e484688-20260703071733`
  - `deployment/auth-microservice-web` was `0/1`, image `localhost:5000/auth-microservice-web:e484688-20260703071733`
  - backend pod `auth-microservice-868d44d6c9-rwtmh` had container state `Terminated`, reason `Unknown`, exit code `255`
  - web pod `auth-microservice-web-799c4c559-pcp62` had container state `Terminated`, reason `Unknown`, exit code `255`
  - `endpoints/auth-microservice` and `endpoints/auth-microservice-web` were empty
- Recent cluster events showed broad `NodeNotReady`, `SandboxChanged`, `context deadline exceeded`, and reserved container-name failures across unrelated workloads, so this is not isolated to the Auth source changes.

## Verdict

Live profile-centralization verification is currently blocked by Auth/cluster availability, independently of the email-change SQL/deploy gate. Do not run email-change live request/confirm smoke until Auth backend and web deployments have ready endpoints.

## Boundary

No SQL apply, deploy, rollout restart, pod deletion, Kubernetes mutation, DB read/write, Authenticated API call, token/password/email output, notification payload output, response-body dump, or raw customer-data output occurred.

## Next Gate

1. Restore or operator-confirm cluster/node/container runtime health.
2. Confirm `deployment/auth-microservice` and `deployment/auth-microservice-web` are `1/1` with non-empty service endpoints.
3. Re-run GET-only `/health` and hosted `/profile` static smoke.
4. Only then continue to owner-approved email-change SQL apply/deploy/request-confirm runtime smoke.
