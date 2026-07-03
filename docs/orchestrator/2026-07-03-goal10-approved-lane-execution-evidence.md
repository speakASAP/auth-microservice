# Goal 10 Approved Lane Execution Evidence

Status: Cliplot lane complete; Rent-a-box source/config migration complete; Rent-a-box runtime activation blocked by Kubernetes node runtime
Created: 2026-07-03

## Intent Chain

- Vision: Auth remains the single source of truth for registered-user profile, reusable delivery addresses, and reusable invoice profiles.
- Goal impact: remove the stale owner-input blockers and record actual execution evidence from the approved parallel lanes.
- System: Auth coordinates consumer adoption without moving order, warehouse, payment, notification, or Rent domain ownership into Auth.
- Feature: approved Cliplot live checkout proof and Rent-a-box hosted Auth route/onboarding migration.
- Task: record sanitized evidence, validation, rollback/cleanup, and the remaining runtime blocker.
- Execution plan: accept worker evidence, independently verify repo states where possible, update Auth checkers/docs, and keep Goal 10 active until Rent runtime activation is proven.
- Coding prompt: never print secrets, bearer tokens, raw customer data, provider payloads, request/response bodies, DB rows, or customer addresses.
- Code: Auth documentation/checker update only.
- Validation: Auth source-only checkers must pass after this update.

## Cliplot Lane Result

- Result: complete.
- Remote repository: `/home/ssf/Documents/Github/cliplot`.
- Worker commit: `d8e875c ops: add bounded live checkout operator`.
- Current observed head after worker: `fafbe70 docs: record latest full checkout live window`.
- Repo-owned command added: `npm run operator:bounded-live-window -- https://cliplot.alfares.cz --execute`.
- Live side effect occurred through the repo-owned bounded operator only.
- Sanitized result: HTTP `201`, executor status `live_checkout_bounded_execution_completed_cleanup_completed`, order created, Warehouse reserved, payment created, notification sent, cleanup succeeded, final order status cancelled, active reservation count after cleanup `0`.
- Restoration evidence: `ENABLE_LIVE_ORDER_SUBMIT=false`, `ENABLE_LIVE_PAYMENT_CREATE=false`, `ENABLE_LIVE_NOTIFICATIONS=false`, and `ENABLE_LIVE_ORDER_WAREHOUSE_SMOKE=false` after execution.
- Validation evidence: `node --check scripts/live-bounded-window-operator.js`, `npm run check`, `git diff --check`, changed-file sensitive marker scan, default dry-run fail-closed proof, execute-mode success, post-push dry-run proof.

## Rent-a-box Lane Result

- Result: source/config migration complete; runtime activation not proven.
- Remote repository: `/home/ssf/Documents/Github/rent-a-box`.
- Route/onboarding migration commit: `4ff0b5c feat: migrate rent auth routes to hosted auth`.
- Runtime flag/build commit: `6191ba3 chore: enable rent hosted auth rollout flags`.
- Kubernetes manifest repair commit: `b3a607c fix: align rent database url deployment secret`.
- Source migration: approved route files now use Auth customer/admin dependencies while local login/register endpoints remain present for compatibility.
- Runtime config source: `RENT_AUTH_ADAPTER_ENABLED=true`, `RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED=true`, and `NEXT_PUBLIC_RENT_AUTH_ADAPTER_ENABLED=true` are committed in `k8s/configmap.yaml`; the web Dockerfile/deploy script pass the public hosted Auth flag at build time.
- Backfill/DB status: no customer row inspection, live DB backfill, unique/non-null enforcement, local credential/profile column drop, or customer profile id rewrite was performed.
- Validation evidence: route/onboarding gate passed, Auth wallet readiness passed, intent preflight passed, `git diff --check` passed, Python compile passed, and web lint passed.
- Deploy evidence: images built and pushed, ConfigMap applied, and `rent-a-box-api` manifest apply succeeded after aligning `DATABASE_URL` with the existing live secretKeyRef.
- Runtime blocker: new Rent pods did not become ready because the single `alfares` Kubernetes node hit a container runtime/pod sandbox failure also visible in unrelated workloads. Events included `FailedCreatePodSandBox`, `CreateContainerError`, `failed to reserve container name`, and `stream terminated by RST_STREAM`.
- Remediation attempted: stuck rollout pods were deleted, but replacement pods hit the same node-level runtime symptom. Passwordless sudo is not available, so the coordinator could not restart `k3s`/`containerd`.
- Safety action: Rent deployments were rolled back to the known ready ReplicaSets (`rent-a-box-api` revision 6 and `rent-a-box-web` revision 3). Rollback status succeeded and the old ready pods remained available. External `https://rent-a-box.alfares.cz/` returned HTTP `200`, but this is old-pod availability, not proof of Auth-migrated runtime activation.

## Runtime Smoke Gate Added

- Rent-a-box commit: `c11cb1d test: add rent hosted auth runtime rollout smoke`.
- Runtime smoke command: `npm run check:goal12-runtime-rollout-smoke`.
- Current expected status before node/runtime repair: `fail_goal12_runtime_rollout_smoke` because old rollback pods are serving without `RENT_AUTH_ADAPTER_ENABLED`, `RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED`, and `NEXT_PUBLIC_RENT_AUTH_ADAPTER_ENABLED` in their running environments, and `/login` does not expose the hosted Auth marker.
- The smoke is non-mutating and records only sanitized Kubernetes rollout state, non-secret feature flags, and HTTP status/marker booleans.

## Current Gate

Goal 10 owner-input blockers for Cliplot and Rent-a-box are resolved. Goal 10 is still not complete because Rent-a-box runtime activation must be rerun after the Kubernetes node/container runtime is healthy and `npm run check:goal12-runtime-rollout-smoke` must pass on the Auth-migrated pods.

## Forbidden Output Boundary

This evidence intentionally excludes bearer tokens, JWTs, cookies, passwords, raw customer data, raw request/response bodies, customer address payloads, provider payloads, notification payloads, DB rows, connection strings, and secret values.
