# Goal 10 Owner Decision Packet

Status: source-only owner-input packet; no runtime gate opened
Created: 2026-07-03
Owner: Auth Goal 10 coordinator

## Intent Chain

- Vision: Auth remains the only editable source of truth for registered-user profile, delivery address book, and invoice profile data.
- Goal impact: the remaining consumer work can continue only when owner decisions are precise enough to avoid accidental live commerce, auth ownership migration, or data backfill.
- System: Auth owns reusable wallet truth; consumers either execute bounded live order/payment/notification proof or migrate route ownership to Auth behind explicit gates.
- Feature: exact owner approval inputs for the remaining Cliplot and Rent-a-box Goal 10 gates.
- Task: convert current blockers into actionable approval packets with required flags, route lists, commands, stop conditions, and forbidden operations.
- Execution plan: read-only consumer audits via parallel subagents; Auth coordinator documentation/checker updates only.
- Coding prompt: preserve `[MISSING: ...]` until the owner supplies concrete approvals; do not treat this packet as approval.
- Code: Auth docs and source-only verifier references.
- Validation: Auth runtime packet checker, Node syntax check, `git diff --check`, and changed-file sensitive literal scan.

## Decision Summary

| Consumer | Current state | Next allowed work without new approval | Owner decision needed |
| --- | --- | --- | --- |
| `cliplot` | Runtime handoff is ready with live flags closed and execution disabled | GET-only readiness evidence | Bounded live checkout submit/live commerce window |
| `rent-a-box` | Source prep exists, but product routes remain local-auth authoritative | Read-only/source-only readiness evidence | Scoped route/onboarding migration approval and route ownership list |

This packet does not authorize live flags, checkout submit, route migration, deploy, backfill, DB writes, secret reads, or customer-data inspection.

## Cliplot Bounded Live Commerce Approval Packet

Current evidence:

- Repo/head: `cliplot` `main` at `ddceee8 docs: record auth wallet live fetch evidence`.
- GET-only production handoff checks pass with `liveFlagsClosed=true`, `liveExecutionAllowed=false`, `mutation=false`, `persistence=false`, `providerCall=false`, `failedAssertions=0`, and `revenueClosure=approval_required_live_revenue_closure`.
- No source-only blocker remains for this handoff; the remaining work is owner/runtime approval plus bounded live-window execution only.

Required owner inputs:

- `[MISSING: CLIPLOT_LIVE_ORDER_APPROVAL_ID]`
- `[MISSING: CLIPLOT_LIVE_PAYMENT_APPROVAL_ID]`
- `[MISSING: CLIPLOT_LIVE_NOTIFICATION_APPROVAL_ID]`
- `[MISSING: CLIPLOT_LIVE_ORDER_WAREHOUSE_SMOKE_APPROVAL_ID]`
- `[MISSING: CLIPLOT_LIVE_CHECKOUT_EXECUTION_WINDOW]`
- `[MISSING: CLIPLOT_PAYMENT_CREATE_EXECUTION_WINDOW]`
- `[MISSING: CLIPLOT_NOTIFICATION_SEND_EXECUTION_WINDOW]`
- `[MISSING: approved operator id for the live window]`
- `[MISSING: one unused orderIdempotencyKey]`
- `[MISSING: one unused paymentIdempotencyKey]`
- `[MISSING: one unused notificationIdempotencyKey]`

Temporary flags allowed only inside an approved bounded window:

- `ENABLE_LIVE_ORDER_SUBMIT=true`
- `ENABLE_LIVE_PAYMENT_CREATE=true`
- `ENABLE_LIVE_NOTIFICATIONS=true`
- `ENABLE_LIVE_ORDER_WAREHOUSE_SMOKE=true`

Required restoration:

- `ENABLE_LIVE_ORDER_SUBMIT=false`
- `ENABLE_LIVE_PAYMENT_CREATE=false`
- `ENABLE_LIVE_NOTIFICATIONS=false`
- `ENABLE_LIVE_ORDER_WAREHOUSE_SMOKE=false`

Executor request contract:

- `confirm=LIVE_CHECKOUT_EXECUTION_WINDOW`
- `executionWindow=<approved CLIPLOT_LIVE_CHECKOUT_EXECUTION_WINDOW>`
- `duplicateCheck=IDEMPOTENCY_KEYS_NOT_USED`
- `rollbackPlan=ORDER_WAREHOUSE_PAYMENT_NOTIFICATION_ROLLBACK_OWNERS_ASSIGNED`
- `validationPlan=EXACTLY_ONE_ORDER_PAYMENT_NOTIFICATION_RESULT_BY_IDEMPOTENCY_KEYS`

Orders/Warehouse smoke contract:

- `confirm=CREATE_REPLAY_CANCEL`
- `approvalId=<CLIPLOT_LIVE_ORDER_WAREHOUSE_SMOKE_APPROVAL_ID>`
- `approvedBy=<approved operator id>`
- `reasonCode=CLIPLOT_OWNER_CREATE_REPLAY_CANCEL_SMOKE`

Forbidden until approval:

- Open live flags, call `POST /api/checkout/live-bounded-executor`, call `POST /api/checkout/live-order-warehouse-smoke-executor`, call `POST /api/checkout/submit`, create orders/payments, reserve Warehouse stock, send notifications, persist/replay callbacks, write live status, read provider-backed `/payments/{paymentId}`, fetch Auth wallet rows/session tokens, print secrets, print customer PII, or print provider payloads.

Approval wording:

```text
Approve one bounded Cliplot live checkout execution window for https://cliplot.alfares.cz.
Use approval IDs for order, payment, notification, and Orders/Warehouse smoke.
Authorize temporarily setting ENABLE_LIVE_ORDER_SUBMIT, ENABLE_LIVE_PAYMENT_CREATE,
ENABLE_LIVE_NOTIFICATIONS, and ENABLE_LIVE_ORDER_WAREHOUSE_SMOKE to true only during
the named window, with immediate restoration to false after validation.
Require unused order/payment/notification idempotency keys, duplicateCheck=IDEMPOTENCY_KEYS_NOT_USED,
rollback owners assigned, validation proving exactly one result per idempotency key,
and no secret/PII/provider payload output.
```

## Rent-a-box Route/Onboarding Approval Packet

Current evidence:

- Repo/head: `rent-a-box` `main` at `e518725 test: add goal 12 route onboarding gate`.
- Current product routes remain local-auth authoritative.
- Auth adapter and dependency helpers exist but are not wired into current product routes.
- `customer_profiles.auth_subject_id` nullable schema exists and is indexed; no unique constraint, no production backfill, and no product-code replacement are approved.
- Current recorded aggregate evidence is zero local users/profiles, zero non-null subject bindings, zero duplicate groups, and zero backfill rows written.

Required owner inputs:

- `[MISSING: owner-approved RENT_AUTH_ADAPTER_ENABLED route migration window]`
- `[MISSING: owner decision for RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED]`
- `[MISSING: owner-approved route ownership list before replacing local auth dependencies]`
- `[MISSING: owner-approved live DB migration/backfill plan or explicit waiver for this window]`
- `[MISSING: owner-approved admin RBAC mapping policy for rent-a-box:admin]`
- `[MISSING: owner decision for local login/register retirement versus compatibility period]`

Route ownership list requiring explicit approval:

- `apps/api/app/api/auth.py`: `/auth/register`, `/auth/login`, `/auth/me`.
- `apps/api/app/api/lifecycle.py`: reservations, payments, rentals.
- `apps/api/app/api/post_rental.py`: contracts, access codes, admin contract metadata.
- `apps/api/app/api/admin/admin.py`: `/admin/**`.
- Frontend hosted Auth session activation and local `AuthForm` handoff consumption.

Feature flags:

- `RENT_AUTH_ADAPTER_ENABLED`: required before any route trusts Auth `/auth/validate`.
- `RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED`: off unless explicitly approved for bounded email-candidate onboarding.

Forbidden until approval:

- Product-code route migration, enabling Auth route dependencies in production, transitional onboarding, local login/register retirement, admin RBAC migration, live DB migration/backfill, unique or non-null enforcement, deploy, Kubernetes/Vault mutation, Auth repo changes, raw customer row inspection, password hash inspection, token/cookie inspection, contract storage inspection, dropping local credential/profile columns, or rewriting `customer_profiles.id` references.

Approval wording:

```text
Approve Rent-a-box Goal 12 route/onboarding migration window for source-controlled product route changes only.
Allow Auth-backed dependencies behind RENT_AUTH_ADAPTER_ENABLED for the explicitly listed lifecycle,
post-rental, admin, login/register/session routes.
RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED is [approved/not approved].
No live DB writes, backfill, unique constraint, deploy, secret/token/customer-data inspection,
or Auth repo changes are approved unless separately stated.
```

## Coordinator Decision

- Cliplot remains runtime-only owner-gated; no source-only implementation lane remains before live-window approval.
- Rent-a-box has source implementation remaining, but it is dependency-gated on route/onboarding owner approval and route ownership decisions.
- Auth coordinator can continue with read-only status refreshes or source-only checker/docs maintenance until one approval packet is answered.
