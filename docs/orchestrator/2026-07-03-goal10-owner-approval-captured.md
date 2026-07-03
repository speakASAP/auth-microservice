# Goal 10 Owner Approval Captured

Status: owner approval captured; execution evidence still pending
Created: 2026-07-03
Owner: Auth Goal 10 coordinator

## Intent Chain

- Vision: Auth remains the only editable source of truth for registered-user profile, delivery address book, and invoice profile data.
- Goal impact: remove the owner-answer blocker and open the two bounded execution lanes while keeping completion gated on actual evidence.
- System: Cliplot may execute a bounded live commerce/runtime proof; Rent-a-box may implement source-controlled route/onboarding migration to hosted Auth.
- Feature: approval capture for the two remaining Goal 10 lanes.
- Task: record approved lane scope, generated non-secret identifiers, forbidden output rules, and remaining evidence requirements.
- Execution plan: dispatch Cliplot and Rent-a-box workers in parallel with disjoint repo ownership; update Auth only after evidence returns.
- Coding prompt: do not mark Goal 10 complete until both worker evidence sets pass and Auth checkers are updated.
- Code: Auth coordinator documentation only.
- Validation: pending worker validation and final Auth completion-gap/runtime-gate checkers.

## Owner Approval

The owner approved both remaining Goal 10 lanes and authorized the agent to generate the required non-secret approval identifiers and idempotency keys.

## Cliplot Generated Non-Secret Values

- `CLIPLOT_LIVE_ORDER_APPROVAL_ID=CLIPLOT-GOAL10-ORDER-20260703T195836Z-E3B82F9F`
- `CLIPLOT_LIVE_PAYMENT_APPROVAL_ID=CLIPLOT-GOAL10-PAYMENT-20260703T195836Z-4271570F`
- `CLIPLOT_LIVE_NOTIFICATION_APPROVAL_ID=CLIPLOT-GOAL10-NOTIFY-20260703T195836Z-AFED6F8C`
- `CLIPLOT_LIVE_ORDER_WAREHOUSE_SMOKE_APPROVAL_ID=CLIPLOT-GOAL10-OWH-20260703T195836Z-A612AA60`
- `CLIPLOT_LIVE_CHECKOUT_EXECUTION_WINDOW=2026-07-03T19:58:36Z/PT30M`
- `CLIPLOT_PAYMENT_CREATE_EXECUTION_WINDOW=2026-07-03T19:58:36Z/PT30M`
- `CLIPLOT_NOTIFICATION_SEND_EXECUTION_WINDOW=2026-07-03T19:58:36Z/PT30M`
- `approved operator id=codex-goal10`
- `orderIdempotencyKey=cliplot-goal10-order-D65D60A6`
- `paymentIdempotencyKey=cliplot-goal10-payment-1EF3A6D2`
- `notificationIdempotencyKey=cliplot-goal10-notification-30D78D6B`
- `duplicateCheck=IDEMPOTENCY_KEYS_NOT_USED`
- `rollback owners assigned=yes`

Cliplot may temporarily open only the documented `ENABLE_LIVE_*` flags during the bounded window if the repo runbook/preflight proves the safe command path. All flags must be restored to false and proven after execution.

## Rent-a-box Approval Decisions

- `RENT_AUTH_ADAPTER_ENABLED` route migration window: approved for source-controlled route/onboarding migration.
- `RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED`: approved for bounded compatibility/onboarding where the existing adapter requires it.
- Approved route ownership list:
  - `apps/api/app/api/auth.py`
  - `apps/api/app/api/lifecycle.py`
  - `apps/api/app/api/post_rental.py`
  - `apps/api/app/api/admin/admin.py`
  - `apps/web/src/app/auth/**`
  - `apps/web/src/lib/auth/hosted-auth.ts`
  - `apps/web/src/lib/customer-flow/session.ts`
  - `apps/web/src/components/customer/AuthForm.tsx`
- Admin RBAC mapping: Auth admin roles/permissions already modeled in adapter, including `rent-a-box:admin`, may authorize Rent admin context.
- Local login/register policy: compatibility/hosted handoff period; no destructive local credential/profile column removal.
- Live DB/backfill: no-backfill waiver for this window unless the repo runbook proves an aggregate-zero non-destructive verification path. No unique/non-null enforcement in this window.

## Forbidden Output And Safety Rules

- Do not print secrets, bearer tokens, JWTs, cookies, passwords, raw customer data, request/response bodies, provider payloads, database rows, password hashes, or contract storage.
- Do not mark Goal 10 complete until both lane evidence sets are recorded and Auth checkers prove the completion state.
- Do not revert unrelated worktree changes.

## Remaining Evidence Required

- Cliplot: bounded execution or explicit fail-closed proof, flag restoration evidence, idempotency evidence, and sanitized report/commit if any files change.
- Rent-a-box: source migration evidence, feature-flag behavior, local compatibility policy, validation commands, sanitized report/commit if files change, and no unapproved deploy/backfill.
