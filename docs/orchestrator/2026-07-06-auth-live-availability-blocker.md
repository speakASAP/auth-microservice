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


## 2026-07-06 18:27 Follow-up

A narrow Auth-only rollout restart was attempted to recover empty Auth endpoints after the node returned to `Ready`:

```bash
kubectl rollout restart deployment/auth-microservice deployment/auth-microservice-web -n statex-apps
```

Outcome:

- Auth web partially recovered: `deployment/auth-microservice-web` became `1/1`, with endpoint `10.42.0.190:3372`.
- Auth backend did not recover: `deployment/auth-microservice` stayed `0/1`.
- New backend pod `auth-microservice-56565699cf-2lk7q` remained `Init:0/2` with no pod IP.
- Old backend pod `auth-microservice-868d44d6c9-rwtmh` remained `Unknown`.
- Public `https://auth.alfares.cz/health` still returned `no available server`.

Parallel read-only subagent triage found this is not an Auth application/source failure:

- Host uptime was only about 16-18 minutes and `k3s` had recently restarted.
- Node was `Ready=True` with no memory, disk, or PID pressure.
- Load was still high.
- Many unrelated workloads were non-running, `ContainerCreating`, or `Unknown`.
- Events/journal showed `NodeNotReady`, broad `SandboxChanged`, `context deadline exceeded`, stale container reservations, k3s API/lease timeouts, and an etcd/kine consistency error.

Verdict update:

- Pause deploys and runtime smokes.
- Treat remaining backend unavailability as operator-level k3s/containerd/control-plane recovery, not an Auth-only fix.
- Re-check Auth backend/web readiness and endpoints after cluster runtime stabilizes.
