# Session B — Broken lanes and silent-failure cleanup

Work in `/home/ssf/Documents/Github`. Read `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`
sections **6n and 6o** first for the measured findings. Do not read the whole file, it is long.

Every item below is a **confirmed** production defect, already verified against running pods.
You are fixing them, not re-discovering them — but re-verify each before you change it, and
say so if reality has moved.

---

## 1. flipflop → ai-microservice: every AI feature is dead (401)

All five flipflop services mount a **valid RS256** `AI_SERVICE_TOKEN` (fp `f97255cc`, expiry
2027-08-07) that returns 200 when attached. **No code path attaches it.** `grep -rn
AI_SERVICE_TOKEN flipflop --include="*.ts"` returns nothing outside build artifacts.

Call sites that post to `/ai/complete` with no service credential:

```
flipflop/services/order-service/src/orders/pricing.service.ts:107
flipflop/services/order-service/src/orders/orders.service.ts:3485  (and ~3799, ~4021)
flipflop/services/product-service/src/marketing/email-campaign.service.ts:107
flipflop/services/product-service/src/marketing/abandoned-cart.service.ts:100
```

`ai-microservice` runs `ServiceAuthGuard` globally as `APP_GUARD` and, since 2026-08-26,
`ALLOW_HS256_FALLBACK=false`. Unauthenticated calls get `401 Missing service token`.

Broken features: pricing suggestions, dead-stock markdown, repeat-buyer recommendations,
abandoned-cart emails, marketing campaign generation.

**Fix**: attach `Authorization: Bearer ${AI_SERVICE_TOKEN}` at every call site — ideally via
one shared helper rather than five copies. **Verify with a real call from inside a flipflop
pod**: expect 200, or 400 on a validation error — **not 401**. Note `/api/email-triage/classify`
is `@Public()` and returns 200 for a garbage token, so it proves nothing; use `/ai/complete`.

---

## 2. `flipflop-warehouse-token` is untracked drift that will break the next rotation

`flipflop-product-service` has a **named `env[]` override** pointing `WAREHOUSE_SERVICE_TOKEN`
at Secret `flipflop-warehouse-token` — hand-created, **no ExternalSecret, no owner references,
absent from the repo**. On 2026-08-26 a Vault rotation reached the other four flipflop
services but not this one; deploying from the repo did **not** clear the override (the deploy
patches images, it does not replace the pod spec). It was fixed by writing the value into that
Secret directly, so the drift is still there.

```
kubectl get deploy flipflop-product-service -n statex-apps \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.valueFrom.secretKeyRef.name}{"\n"}{end}'
```

**Fix**: make `envFrom`/ESO the single source — remove the override from the live Deployment
(and confirm the repo manifest does not reintroduce it), then delete the orphan Secret once
nothing references it. **Verify by fingerprint inside the pod** that the ESO value is what is
mounted, and that warehouse still returns 200.

Check whether `suppliers-microservice` has the same pattern — the plan (section 2c, finding 2)
records `CATALOG_SERVICE_TOKEN` and `WAREHOUSE_SERVICE_TOKEN` both mapped to a hand-created
`stock-traceability-runtime-token` with no ExternalSecret.

---

## 3. Silent failures that hid a 26-day outage

flipflop's warehouse lane was 401 for 26 days and nobody noticed, because the client turned
the failure into an empty list. That specific method is fixed; **these are not**:

- `notifications-microservice/src/telegram-bot/orchestrator.client.ts:65` — `catch {}` swallows
  the error and returns `[]`.
- `allegro/shared/clients/warehouse-client.service.ts:33` — returns `{}` when no token is
  found, sending an unauthenticated request instead of failing.
- `aukro/`, `heureka/`, `bazos/` carry near-identical `shared/clients/*` — **check each for the
  same `return []` / `return {}` / `catch {}` pattern.**

Rule (`/home/ssf/.claude/CLAUDE.md`): every catch either re-throws or logs at error level with
full context; **an empty result must never stand in for a failure**; "not found" and "lookup
failed" must be distinguishable. A 404 legitimately means "no rows" — 401/403/5xx do not.

---

## 4. runlayer follow-ups (the bypass itself is already fixed and deployed)

`runlayer` commit `48d3e9d` closed the auth bypass; verified live (shared token now 401, the
notifications token still 200). Remaining:

- `runlayer/k8s/external-secret.yaml` (~lines 98,102) still syncs `ORCHESTRATOR_USER_JWT` and
  `ORCHESTRATOR_SERVICE_TOKEN` into the pod. They are inert for auth now, but they mount the
  shared `a2880693`. **Coordinate: Session A owns retiring that token** — remove the mounts
  here only, and tell the user if it needs sequencing.
- `runlayer/scripts/*.sh` (`_orch-common.sh`, `e2e-smoke-test.sh`,
  `goal-journey-smoke-test.sh`, `orch-final-validation.sh`) fall back to `ORCHESTRATOR_USER_JWT`
  and will now get 401. They already support a `TOKEN` env var / login flow. Local operator
  scripts, not production.

---

## Hard constraints

- **Deploys are serialised.** One node, one containerd. Check
  `shared/scripts/deploy-queue/queuectl.sh status` and
  `shared/scripts/with-deploy-lock.sh --status` before any build/rollout. Committing to `main`
  auto-deploys. **A `FAILED` line after ~600s is often a rollout timeout, not a failure** —
  flipflop reported `FAILED ... after 963s` on 2026-08-26 while every pod converged correctly.
  Check the deploy's image and readiness before re-running anything.
- **Session A is editing `orders-microservice/`, `marketing-microservice/`, `payments-microservice/`,
  `aukro/`, `bazos/` and auth DB principals.** Coordinate before touching those. `flipflop/`,
  `runlayer/`, `notifications-microservice/` and `ai-microservice/` are yours.
- Never log or echo a token value; use sha256 fingerprints (first 8 chars).
- Never let `kubectl` dump a Secret's `.data` wholesale.
- Verify every fix by reproducing the original failing call from inside the deployed pod —
  **not from the deploy banner, and not by pod restart alone.**
- If you add a test, confirm it **fails** when you revert the fix. A test that passes either
  way is worthless.

## Report

Per item: the before/after HTTP status or observed behaviour, what you changed, and how you
verified it live. Note anything you found but did not fix rather than expanding scope. Add a
numbered section to `auth-microservice/docs/RS256_SERVICE_TOKEN_MIGRATION_PLAN.md`.
