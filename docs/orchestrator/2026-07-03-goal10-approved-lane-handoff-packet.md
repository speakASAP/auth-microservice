# Goal 10 Approved Lane Handoff Packet

Status: inactive source-only handoff; owner approval required before use
Created: 2026-07-03
Owner: Auth Goal 10 coordinator

## Intent Chain

- Vision: Auth remains the only editable source of truth for registered-user profile, delivery address book, and invoice profile data.
- Goal impact: once an owner answers a remaining approval packet, the next worker can start from a bounded, conflict-safe prompt without re-opening scope decisions.
- System: Auth owns reusable wallet truth; Cliplot may run a bounded live commerce proof, and Rent-a-box may migrate route/session ownership only after explicit owner approval.
- Feature: subagent-ready execution handoffs for the two remaining Goal 10 lanes.
- Task: define lane objective, scope, allowed files, forbidden files, validation, stop conditions, evidence contract, and merge order.
- Execution plan: source-only coordinator document and checker references; do not edit consumer repos, open runtime flags, deploy, or read secrets.
- Coding prompt: prompts in this packet are dormant until the matching owner approval is supplied.
- Code: Auth coordinator documentation only.
- Validation: completion-gap checker and runtime-gate packet checker.

## Global Rules

- This packet is not approval.
- Use only after the owner answers the relevant section of `docs/orchestrator/2026-07-03-goal10-owner-decision-packet.md`.
- Preserve the Intent Preservation chain in the worker branch/reports.
- Do not print secrets, bearer tokens, JWTs, cookies, passwords, raw customer data, raw request/response bodies, provider payloads, or database rows.
- Do not revert unrelated dirty worktree changes.
- Stop immediately if the approved inputs are incomplete, if a repo is dirty in files the worker must edit, or if the runtime behavior deviates from the allowed evidence contract.

## Parallel Execution Matrix

| Lane | Status | Owner role | Can run in parallel? | Integration owner | Merge/deploy order |
| --- | --- | --- | --- | --- | --- |
| Cliplot bounded live commerce | Blocked on owner approval | Cliplot runtime validation worker | Yes, only if Rent lane is source-only and no shared runtime flags are touched | Auth coordinator | Runtime window first, then evidence commit only |
| Rent-a-box route/onboarding migration | Blocked on owner approval | Rent-a-box migration worker | Yes, only if no live DB/deploy approval is included and Cliplot uses separate repo/runtime | Auth coordinator | Source branch, validation, then owner deploy/backfill decision |

## Lane A - Cliplot Bounded Live Commerce Worker Prompt

Status: `[MISSING: owner answer to Cliplot bounded live commerce approval packet]`

Objective:

- Execute exactly one bounded Cliplot live checkout/live commerce proof after owner approval, then restore all live flags and commit sanitized evidence only.

Allowed repo:

- `/home/ssf/Documents/Github/cliplot`

Allowed files after execution:

- Sanitized validation reports under existing Cliplot reports/docs locations.
- Cliplot implementation state/status docs that record sanitized evidence.
- No source changes unless the approved runtime window reveals a fail-closed bug and the owner explicitly approves a separate source-fix lane.

Required owner inputs before start:

- `CLIPLOT_LIVE_ORDER_APPROVAL_ID`
- `CLIPLOT_LIVE_PAYMENT_APPROVAL_ID`
- `CLIPLOT_LIVE_NOTIFICATION_APPROVAL_ID`
- `CLIPLOT_LIVE_ORDER_WAREHOUSE_SMOKE_APPROVAL_ID`
- `CLIPLOT_LIVE_CHECKOUT_EXECUTION_WINDOW`
- `CLIPLOT_PAYMENT_CREATE_EXECUTION_WINDOW`
- `CLIPLOT_NOTIFICATION_SEND_EXECUTION_WINDOW`
- approved operator id
- one unused `orderIdempotencyKey`
- one unused `paymentIdempotencyKey`
- one unused `notificationIdempotencyKey`
- duplicate confirmation `IDEMPOTENCY_KEYS_NOT_USED`
- rollback owners assigned

Forbidden files/actions:

- Do not edit Auth source.
- Do not edit Rent-a-box source.
- Do not persist or print tokens, cookies, JWTs, provider payloads, request/response bodies, or customer PII.
- Do not leave any `ENABLE_LIVE_*` flag enabled after the bounded window.
- Confirm `ENABLE_LIVE_ORDER_SUBMIT=false` after cleanup.
- Do not rerun with the same idempotency keys after a partial success.

Required command shape:

```bash
ssh -o HostName=192.168.88.53 alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:owner-bounded-window-handoff -- https://cliplot.alfares.cz'
```

After owner approval only:

```bash
ssh -o HostName=192.168.88.53 alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:live-checkout-execution-window -- https://cliplot.alfares.cz'
```

Required evidence:

- live flags opened only inside approved window;
- exactly one order/payment/notification result by idempotency key;
- Orders/Warehouse create/replay/cancel smoke result;
- all live flags restored to `false`;
- no secret/customer/provider payload output.

Stop conditions:

- Missing approval id/window/operator/idempotency input.
- Any live flag already open before the window.
- Duplicate idempotency key found.
- Any output attempts to include forbidden data.
- Cleanup/flag restoration cannot be proven.

## Lane B - Rent-a-box Route/Onboarding Migration Worker Prompt

Status: `[MISSING: owner answer to Rent-a-box route/onboarding approval packet]`

Objective:

- Implement source-controlled Rent-a-box route/onboarding migration behind explicit feature flags after owner approval, while preserving local-auth compatibility where required and without live DB/backfill/deploy unless separately approved.

Allowed repo:

- `/home/ssf/Documents/Github/rent-a-box`

Allowed files after approval:

- `apps/api/app/auth/adapter.py`
- `apps/api/app/auth/dependencies.py`
- `apps/api/app/api/auth.py`
- `apps/api/app/api/lifecycle.py`
- `apps/api/app/api/post_rental.py`
- `apps/api/app/api/admin/admin.py`
- `apps/web/src/app/auth/**`
- `apps/web/src/lib/auth/hosted-auth.ts`
- `apps/web/src/lib/customer-flow/session.ts`
- `apps/web/src/components/customer/AuthForm.tsx`
- Goal 12 docs, validation reports, and verifier scripts.

Required owner inputs before start:

- approved `RENT_AUTH_ADAPTER_ENABLED` route migration window;
- decision for `RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED`;
- approved route ownership list;
- live DB migration/backfill plan or explicit no-backfill waiver for this window;
- admin RBAC mapping policy for `rent-a-box:admin`;
- local login/register retirement or compatibility-period policy.

Forbidden files/actions:

- Do not edit Auth source.
- Do not run live DB migration/backfill or unique/non-null enforcement unless separately approved.
- Do not deploy unless separately approved.
- Do not read raw customer rows, password hashes, tokens, cookies, secrets, or contract storage.
- Do not drop local credential/profile columns.
- Do not rewrite `customer_profiles.id` references.

Required validation:

```bash
ssh -o HostName=192.168.88.53 alfares 'cd /home/ssf/Documents/Github/rent-a-box && python3 -B scripts/check_goal12_route_onboarding_gate.py --root .'
ssh -o HostName=192.168.88.53 alfares 'cd /home/ssf/Documents/Github/rent-a-box && python3 -B scripts/check_goal12_auth_wallet_readiness.py --root .'
ssh -o HostName=192.168.88.53 alfares 'cd /home/ssf/Documents/Github/rent-a-box && ./scripts/intent_preflight.sh'
ssh -o HostName=192.168.88.53 alfares 'cd /home/ssf/Documents/Github/rent-a-box && git diff --check'
```

Expected evidence:

- product route migration remains feature-gated;
- transitional onboarding state matches owner decision;
- admin RBAC maps only approved Auth roles;
- no production backfill or unique enforcement unless separately approved;
- local compatibility/retirement policy is documented and tested;
- no secret/customer-data output.

Stop conditions:

- Owner approval does not name route ownership list.
- `RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED` decision is ambiguous.
- Backfill plan/waiver is missing.
- Required route files are dirty with unrelated work.
- Tests or verifiers mutate runtime or expose sensitive values.

## Coordinator Handoff

- Do not start either lane from this packet alone.
- After one lane completes, update Auth Goal 10 status and rerun:
  - `npm run check:customer-data-wallet-completion-gap`
  - `npm run check:customer-data-wallet-runtime-gate-packet`
- Keep Goal 10 active until both owner-gated lanes are complete or explicitly removed from scope by the owner.
