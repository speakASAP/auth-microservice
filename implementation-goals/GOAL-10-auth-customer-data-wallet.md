# GOAL-10 Auth Customer Data Wallet

Status: active; Auth + FlipFlop source prepared, Rent-a-box plan/verifier created, ChytraKoupe plan/verifier/callback cleanup created, live SQL/deploy/runtime smoke approval-gated

## Intent

Auth becomes the single source of truth for registered-user profile data,
delivery address books, and invoice/billing profiles across the Statex
ecosystem.

## Goal Impact

Users enter reusable personal, delivery, and invoice data once. Every integrated
checkout can prefill and select from Auth-owned entries. Any authenticated edit
from another service writes back to Auth. Orders and storefronts may store
order-specific snapshots, but not reusable profile truth.

## System

- `auth-microservice`: Auth-owned profile, delivery address book, invoice
  profile APIs and optional hosted profile-management UI.
- `flipflop`: first customer-facing checkout/profile consumer.
- `orders-microservice`: immutable order snapshot receiver.
- `rent-a-box`: high-risk duplicate local auth/profile/billing consumer that
  needs a separate hosted Auth migration lane.
- `chytrakoupe`: hosted Auth checkout consumer that still duplicates checkout
  contact/address payloads.
- `cliplot`: future gated checkout consumer.
- `catalog`, `allegro`, `aukro`, `bazos`, `payments`, `leads`, `marketing`,
  `warehouse`, `heureka`, `shop-assistant`: no reusable profile ownership;
  only integrate where a real customer checkout/account surface exists.

## Feature

Auth customer data wallet:

- canonical profile fields;
- multi-entry delivery address book;
- multi-entry invoice/billing profile library;
- default entry selection;
- checkout aggregate read;
- consumer selectors and save-back flows.

## Chunks

- [x] 10.0 Planning and cross-repo readiness docs.
- [x] 10.1 Auth schema-path decision and storage model.
- [x] 10.2 Auth delivery address book API.
- [x] 10.3 Auth invoice profile API.
- [x] 10.4 Auth checkout aggregate and legacy `profileAddress` projection.
- [x] 10.5 Auth contract docs and tests.
- [x] 10.6 FlipFlop shared Auth client and user-service bridge source prep.
- [x] 10.7 FlipFlop checkout/profile selectors source prep with checkout manual-edit guard.
- [x] 10.8 Orders snapshot compatibility audit; no source change before provenance decision.
- [x] 10.9 Rent-a-box hosted Auth/profile migration plan and readiness verifier created in commits `fcfeb48` and `09dce2f`.
- [x] 10.10 ChytraKoupe checkout selector plan, readiness verifier, and safe callback cleanup created in commits `a1dabca` and `2838ebf`.
- [x] 10.11 Cross-repo validation and deployment plan.

## Acceptance Criteria

- Auth supports multiple delivery addresses per authenticated user.
- Auth supports multiple invoice profiles per authenticated user.
- Auth enforces per-user ownership and default selection.
- Auth returns sanitized checkout data without passwords, tokens, secrets, raw
  audit data, or provider/payment details.
- FlipFlop authenticated checkout can select saved Auth delivery and invoice
  entries.
- FlipFlop can add/edit Auth entries from checkout/profile management.
- FlipFlop guest checkout still works.
- Orders receives immutable snapshots and does not become profile source of
  truth.
- No lifecycle events, logs, prompts, docs, or reports contain raw secrets,
  tokens, passwords, or full production customer data.

## Boundary Check

Auth owns registered-user profile, delivery address book, invoice profiles,
identity, login, JWT, refresh token, OAuth, magic link, RBAC, service auth, and
registered-user preferences.

Auth does not own products, stock, order lifecycle, payments, lead records for
non-registered contacts, marketing campaign execution, notification sending,
logging storage, database infrastructure, gateway routing, or channel-specific
marketplace operations.

## Parallel Execution

| Workstream                         | Status             | Owner role               | Files                                    | Dependencies              | Merge order |
| ---------------------------------- | ------------------ | ------------------------ | ---------------------------------------- | ------------------------- | ----------- |
| A0 Planning                        | complete           | Auth coordinator         | Auth docs only                           | None                      | 1           |
| A1 Auth backend                    | source-implemented | Auth backend worker      | Auth source/docs/tests                   | SQL apply/deploy approval | 2           |
| A2 Auth profile UI                 | dependency-gated   | Auth frontend worker     | hosted Auth/profile UI                   | A1                        | 3           |
| F1 FlipFlop backend bridge         | source-prepared    | FlipFlop backend worker  | shared Auth client, user-service         | runtime smoke gated       | 4           |
| F2 FlipFlop checkout UX            | source-prepared    | FlipFlop frontend worker | checkout/profile UI                      | Auth deploy/runtime smoke incl. manual-edit guard | 5           |
| O1 Orders compatibility            | audit-complete     | Orders worker            | create-order contract/docs               | provenance decision       | 6           |
| R1 Rent-a-box Auth migration plan  | plan+verifier-created | Rent-a-box coordinator | `rent-a-box/docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`, `rent-a-box/scripts/check_goal12_auth_wallet_readiness.py` | Auth deploy + migration approval | 7 |
| CK1 ChytraKoupe checkout selectors | plan+verifier-created | ChytraKoupe worker | `chytrakoupe/implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`, `chytrakoupe/scripts/verify-auth-wallet-checkout-selectors.mjs`, `chytrakoupe/app/auth/callback/AuthCallbackClient.tsx` | Auth deploy + client-id decision | 8 |
| C1 Cliplot plan                    | blocked            | Cliplot coordinator      | docs only                                | checkout approval         | later       |
| M1 marketplace audit               | ready read-only    | explorer                 | Catalog/Allegro/Aukro/Bazos/Heureka docs | none                      | no code     |

## Validation

Auth:

```bash
npm test -- --runTestsByPath src/auth/auth-contract.spec.ts
npm run test:auth-contract
npm run build
npm run lint
git diff --check
```

Orders:

```bash
npm run build
npm run verify:create-order-contract
npm run verify:event-contracts
npm test
```

Consumer validation depends on each repo package scripts and must be recorded in
that repo's status/validation report.

## Blockers

- `[MISSING: owner approval for live DB migration apply]`
- `[MISSING: owner-approved Auth deploy after source validation and SQL apply]`
- `[MISSING: approved schema-only DB verification command/session]`
- `[MISSING: owner-approved synthetic account for live cross-repo checkout smoke]`
- `[MISSING: post-deploy wallet endpoint 401 smoke]`
- `[MISSING: post-deploy FlipFlop checkout/profile runtime smoke, including manual-edit-before-wallet-response and explicit selector override]`
- `[MISSING: customer invoice profile/selection contract for company ID, tax ID, VAT ID, and invoice email fields]`
- `[MISSING: Rent-a-box hosted Auth token/session/admin-role migration decision before code changes]`
- `[MISSING: ChytraKoupe hosted Auth client_id decision before selector implementation]`
- `[UNKNOWN: final customer-checkout consumer repo set beyond FlipFlop, Chytrakoupe, Rent-a-box, and Cliplot]`

## 2026-07-02 Goal 10.11 Validation And Deployment Plan Result

- 2026-07-02: Goal 10.11 cross-repo validation and deployment plan created in
  `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`.
- Subagent read-only reviews confirmed Auth source is clean at `54743ed`, live
  Auth is healthy on old image `0d4282b-20260702102426`, wallet routes still
  return 404 unauthenticated, SQL remains unapplied, and live deployment is not
  ready without explicit approvals.
- The plan records repo-specific gates for Auth, FlipFlop, Orders,
  Rent-a-box, ChytraKoupe, and Cliplot; merge/deploy order; rollback boundary;
  sensitive-data rules; and exact `[MISSING: ...]` blockers.
- Auth coordinator validation passed: `git diff --check` and targeted
  dangerous literal-secret scan on changed Goal 10 documentation files.
- No SQL, deploy, production DB access, secret/token/password inspection, raw
  customer-data inspection, consumer code edit, or live checkout smoke was
  performed for this chunk.

## 2026-07-02 Continuation Validation And Active FlipFlop Target Result

- 2026-07-02: Auth runtime source commit `39b59d7` validation passed: focused
  Auth/User specs 2 suites/15 tests, `npm run test:auth-contract` 3 suites/25
  tests, `npm run build`, `npm run lint`, and `git diff --check`.
- Live Auth still returns wallet endpoints as HTTP 404 unauthenticated, so SQL
  apply and deploy remain pending.
- Active FlipFlop target branch
  `codex/orders-lifecycle-cabinet-flipflop-clean` now contains the Auth wallet
  source series as `a8425a9`, `15fb1ee`, and `f4af318`, with validation report
  commit `223db57`.
- FlipFlop validation passed: pre-coding gate, strict doc audit 100/100,
  `git diff --check`, shared build, frontend typecheck, and frontend build with
  existing baseline/workspace warnings only.
- Orders current clean `main` at `c5e6dd6` already supports Auth subject
  aliases and immutable shipping/billing snapshots; Orders remains unchanged
  until final wallet provenance semantics are approved.
- No live SQL, deploy, production DB access, secret/token/password inspection,
  raw customer-data inspection, Orders edit, or live checkout smoke was
  performed.

## 2026-07-02 Source-Only Wallet DB Preflight Helper Result

- Added `scripts/check-customer-data-wallet-preflight.js` and
  `npm run check:customer-data-wallet-preflight`.
- The helper validates the checked-in wallet SQL shape, rejects DML/drop-style
  lines, and prints the allowlisted schema metadata SQL plus the apply command
  template.
- The helper does not read DB environment values, connect to the database,
  apply SQL, inspect customer rows, or replace the owner-approved live
  schema-only preflight.
- Validation passed: helper syntax check, `npm run
  check:customer-data-wallet-preflight`, diff-check, targeted dangerous
  literal-secret scan, build, and lint.
- Live SQL apply, Auth deploy, wallet endpoint 401 smoke, and synthetic
  authenticated smoke remain approval-gated.

## 2026-07-02 Rent-a-box Source-Readiness Verifier Result

- 2026-07-02: Rent-a-box Goal 12 source-readiness verifier created in commit
  `09dce2f docs: add auth wallet readiness verifier`.
- Changed Rent-a-box files:
  `scripts/check_goal12_auth_wallet_readiness.py`,
  `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`,
  `docs/goals/ORCHESTRATION_STATE.md`, and `docs/goals/README.md`.
- The verifier is source-only and reports `pass_dependency_gated` when the
  expected Auth wallet blockers are present and local auth/profile surfaces are
  still consistent with the migration plan.
- Validation passed in Rent-a-box: helper compile, helper execution,
  no-Cyrillic docs check, diff-check, and targeted dangerous literal-secret
  scan on changed files.
- No Rent-a-box product auth migration, live DB query, production row,
  password-hash or contract inspection, secret/token/cookie inspection, Auth
  SQL, deploy, Kubernetes mutation, or live checkout smoke was performed.

## 2026-07-02 ChytraKoupe Source-Readiness Verifier Result

- 2026-07-02: ChytraKoupe source-readiness verifier and hosted Auth callback
  cleanup created in commit `2838ebf test: add auth wallet checkout gate
  verifier`.
- Changed ChytraKoupe files:
  `scripts/verify-auth-wallet-checkout-selectors.mjs`, `package.json`,
  `reports/validation/auth-wallet-checkout-selectors-verifier.md`, and
  `app/auth/callback/AuthCallbackClient.tsx`.
- The verifier confirms the expected dependency-gated state: explicit
  `[MISSING: ...]` blockers remain documented, wallet selector/client source is
  absent, guest checkout is still manual, and no local wallet persistence was
  introduced.
- Callback cleanup now strips token-bearing query/hash material from browser
  history after callback values are captured.
- Validation passed in ChytraKoupe: `npm run
  verify:auth-wallet-checkout-selectors`, `npm run lint`, `npm run build`,
  `node --check scripts/verify-auth-wallet-checkout-selectors.mjs && git diff
  --check`, and targeted dangerous literal-secret scan on changed files.
- No wallet selector UI, checkout behavior migration, deploy, Kubernetes
  mutation, live checkout submit, live DB query/write, Auth SQL apply,
  secret/token/cookie inspection, or production customer-data access was
  performed.

## Coding Prompt

Implement only the assigned chunk. Preserve Auth as the source of truth for
registered-user profile, delivery addresses, and invoice profiles. Keep Orders
as order snapshot owner only. Preserve hosted Auth login/register and existing
JWT/RBAC/OAuth/magic-link contracts. Do not print secrets, token values,
passwords, decoded JWTs, raw production user data, or full customer address
payloads. Mark missing facts as `[MISSING: ...]` or `[UNKNOWN: ...]`.

## 2026-07-02 Goal 10.9 And 10.10 Plan Results

- 2026-07-02: Goal 10.9 Rent-a-box hosted Auth/profile migration plan created
  in `rent-a-box` commit `fcfeb48`, with source-readiness verifier commit
  `09dce2f`, file
  `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`
  and helper `scripts/check_goal12_auth_wallet_readiness.py`.
  Read-only audit confirmed local email/password auth, local JWT minting,
  local password hash storage, local profile/contact/billing storage, and
  domain foreign keys coupled to local `customer_profiles.id`; migration is
  blocked from code changes until Auth wallet deploy and owner-approved
  migration/backfill decisions.
- 2026-07-02: Goal 10.10 ChytraKoupe checkout selector integration plan created
  in `chytrakoupe` commit `a1dabca`, with verifier/callback cleanup commit
  `2838ebf`, file `implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`
  and helper `scripts/verify-auth-wallet-checkout-selectors.mjs`.
  Read-only audit confirmed hosted Auth exists, checkout remains guest-first and
  manual, no wallet selectors or local profile/address tables exist, and code
  changes are gated on Auth wallet deploy, client-id decision, CORS/redirect
  allowlist confirmation, and order snapshot payload decisions.
- No consumer source code, live checkout submit, SQL, deploy, production DB
  access, secret/token/password inspection, or raw customer data inspection was
  performed for these planning chunks.


## 2026-07-02 Goal 10.6 Source Prep Result

- 2026-07-02: Goal 10.6 FlipFlop client bridge source prep completed in
  `flipflop` commit `515f4b7`. This adds typed shared/frontend Auth wallet
  clients only. Checkout/profile selector wiring and runtime smoke remain gated
  on Auth SQL/deploy and stable backend health.

## 2026-07-02 Goal 10.7 Source Prep And Orders Audit Result

- 2026-07-02: Goal 10.7 FlipFlop checkout/profile selector source prep completed
  in `flipflop` commit `840eff6`. It wires defensive wallet selectors and
  fallback behavior without changing order payload semantics or deploying.
- Orders compatibility audit found no immediate source change is required:
  Orders already stores separate immutable shipping/billing snapshots, and Auth
  wallet IDs should wait for an approved final provenance contract.
