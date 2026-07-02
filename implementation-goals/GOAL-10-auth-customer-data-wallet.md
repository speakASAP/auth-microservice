# GOAL-10 Auth Customer Data Wallet

Status: active; Auth A1 source implemented, live SQL apply/deploy approval-gated

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
- [ ] 10.6 FlipFlop shared Auth client and user-service bridge.
- [ ] 10.7 FlipFlop checkout/profile selectors.
- [ ] 10.8 Orders snapshot contract compatibility.
- [ ] 10.9 Rent-a-box hosted Auth/profile migration plan.
- [ ] 10.10 Chytrakoupe checkout selector integration plan.
- [ ] 10.11 Cross-repo validation and deployment plan.

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
| F1 FlipFlop backend bridge         | dependency-gated   | FlipFlop backend worker  | shared Auth client, user-service         | A1                        | 4           |
| F2 FlipFlop checkout UX            | dependency-gated   | FlipFlop frontend worker | checkout/profile UI                      | F1                        | 5           |
| O1 Orders compatibility            | dependency-gated   | Orders worker            | create-order contract/docs               | A1 + F1                   | 6           |
| R1 Rent-a-box Auth migration plan  | dependency-gated   | Rent-a-box coordinator   | docs first                               | A1                        | 7           |
| CK1 Chytrakoupe checkout selectors | dependency-gated   | Chytrakoupe worker       | checkout/auth client                     | A1                        | 8           |
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
- `[MISSING: customer invoice profile/selection contract for company ID, tax ID, VAT ID, and invoice email fields]`
- `[UNKNOWN: final customer-checkout consumer repo set beyond FlipFlop, Chytrakoupe, Rent-a-box, and Cliplot]`

## Coding Prompt

Implement only the assigned chunk. Preserve Auth as the source of truth for
registered-user profile, delivery addresses, and invoice profiles. Keep Orders
as order snapshot owner only. Preserve hosted Auth login/register and existing
JWT/RBAC/OAuth/magic-link contracts. Do not print secrets, token values,
passwords, decoded JWTs, raw production user data, or full customer address
payloads. Mark missing facts as `[MISSING: ...]` or `[UNKNOWN: ...]`.
## 2026-07-02 Goal 10.6 Source Prep Result

- 2026-07-02: Goal 10.6 FlipFlop client bridge source prep completed in
  `flipflop` commit `515f4b7`. This adds typed shared/frontend Auth wallet
  clients only. Checkout/profile selector wiring and runtime smoke remain gated
  on Auth SQL/deploy and stable backend health.
