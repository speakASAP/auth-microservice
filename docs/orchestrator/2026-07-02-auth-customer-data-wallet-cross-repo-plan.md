# Auth Customer Data Wallet Cross-Repo Plan

Status: planning
Created: 2026-07-02
Coordinator: auth-microservice orchestrator

## Vision

Registered users have one reusable profile, delivery address book, and invoice
profile library across the Statex ecosystem. Auth is the editable source of
truth. Commerce services use Auth data to prefill forms and create immutable
order snapshots without owning reusable profile data.

## Goal Impact

A user can register once, save their profile, save multiple delivery addresses,
save multiple invoice profiles, and then choose the right entry in FlipFlop or
any future checkout surface. If the user changes their name, phone, default
delivery address, or invoice profile in any integrated service, the update is
stored in Auth and is available to other services on next login/checkout.

## System Boundaries

Auth owns:

- identity, hosted login/register, JWT/refresh validation;
- registered-user profile/contact data;
- delivery address book;
- invoice/billing profile library;
- registered-user communication preferences and consent flags.

Orders owns:

- order records and immutable order customer/address/billing snapshots;
- idempotency and lifecycle events without raw customer/address payloads.

Consumer storefronts own:

- UX for selecting, adding, or editing Auth-owned data;
- guest checkout forms where business rules allow guest checkout;
- local order/cart flow orchestration.

Auth must not own product truth, stock, order lifecycle, payment identity,
lead records for non-registered contacts, marketing campaign execution,
notification sending, logging storage, database infrastructure, or gateway
routing.

## Source Evidence

Auth:

- `POST /auth/register` stores `email`, `firstName`, `lastName`, and `phone` in
  `users`.
- `GET /auth/profile` returns a sanitized Auth DB user.
- `PATCH /auth/profile` updates profile fields and one
  `canonicalProfile.address`.
- No Auth multi-address or invoice-profile CRUD exists yet.

FlipFlop:

- `services/frontend/app/checkout/page.tsx` collects contact, billing, and
  optional delivery data inline.
- `services/frontend/lib/api/auth.ts` already models `profileAddress` and
  calls `/users/profile`.
- `services/frontend/lib/api/addresses.ts` calls `/users/addresses`.
- `services/user-service/src/users/users.service.ts` bridges profile/address
  writes to Auth `PATCH /auth/profile` and mirrors one default address into the
  local `DeliveryAddress` table.
- `prisma/schema.prisma` still has `User.delivery_addresses` and
  `DeliveryAddress` local storage.
- `POST /orders/guest` is public and creates a local user/order/address
  snapshot for guest checkout. Authenticated account data still passes through
  the same checkout fields.
- Important gap: when billing and delivery differ, the local order path stores
  one delivery address row, and central Orders currently receives the same
  bounded address as both `shippingAddress` and `billingAddress`.
- No active checkout/profile path was found for customer invoice fields such as
  company ID or VAT/tax ID, even though invoice/proforma models exist.

Orders:

- `src/orders/create-order.dto.ts` accepts `customer`, `shippingAddress`, and
  `billingAddress`.
- `src/orders/order.entity.ts` stores customer, shipping, and billing snapshots
  as JSONB.
- `docs/orchestrator/CHANNEL_ORDER_CREATE_CONTRACT.md` documents that these
  fields map to Orders snapshots.
- Events explicitly exclude raw customer/address/payment payloads, so address
  and invoice selectors must not leak into order lifecycle events.

Additional consumer discovery:

- `rent-a-box` has local email/password auth, local JWTs, local user/customer
  profile storage, and billing address fields. This is the highest duplicate
  Auth risk found by the read-only scan.
- `chytrakoupe` uses hosted Auth redirects/profile validation, but checkout
  still collects and duplicates first/last/email/phone/street/city/postal data
  in frontend payloads. Its default Auth client id fallback was reported as
  `flipflop`; this needs verification before code changes.
- `cliplot` has hosted Auth links and guarded checkout, but live order/payment
  mutation is approval-gated.
- `allegro`, `aukro`, `bazos`, and `heureka` have channel order ingestion or
  forwarding surfaces that carry buyer/contact/address snapshots to Orders.
  They should preserve marketplace evidence and not turn marketplace buyer data
  into Auth profile truth.
- `payments-microservice` accepts payment customer fields for provider/payment
  needs only; it must not become reusable profile storage.

DocsRAG:

- Source headings confirmed Auth identity/profile boundary, Catalog product
  truth, Orders order truth, Payments payment/VS truth, and FlipFlop as a
  consumer that should not duplicate identity.
- No already-complete address-book/invoice-profile Auth contract was found.

## Current Repository State

Clean and safe for planning docs:

- `auth-microservice`: live wallet routes deployed from Source Preflight HEAD
  `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`; coordinator docs are being
  refreshed after consumer blocker refinement.

Dirty or ahead; future workers must inspect before editing:

- `flipflop`: dirty worktree with current product/detail work.
- `orders-microservice`: dirty worktree with order event contract work.
- `catalog-microservice`: dirty worktree with product relation work.
- `allegro`: ahead and dirty.
- `aukro`: ahead and dirty.
- `bazos`: ahead and dirty.
- `marketing-microservice`: dirty.
- `warehouse-microservice`: dirty.
- `rent-a-box`: ahead at `eb2eb02`; repo-local Goal 12 now includes
  source-backed hosted Auth `/auth/start` and `/auth/callback` scaffolding with
  `client_id=rent-a-box`,
  `return_url=https://rent-a-box.alfares.cz/auth/callback`, and Auth wallet
  schema/response-shape evidence while preserving customer session
  adapter/local profile binding, admin role, consent/profile migration, and
  backfill blockers.
- `chytrakoupe`: clean and ahead at `b280f75`; repo-local Goal 06 source
  prepares Auth wallet checkout-data reading, delivery/invoice selectors, and
  immutable billing/delivery snapshots, while retaining final client-id and
  optional Auth subject linkage gates before runtime claim.
- `heureka`: reported dirty by read-only explorer.
- `shop-assistant`: reported dirty by read-only explorer; lower priority
  because no local login/register controller was found.

Clean but gated by its own checkout approvals:

- `cliplot`: ahead 3 at `c8e99ac`, but checkout mutation remains guarded and
  approval-gated; runtime wallet integration is absent. Stable checkout-data
  version `auth.customer-data-wallet.checkout-data.v1` and response field
  shapes are now consumed by Cliplot-owned readiness docs/verifier;
  selector/session/PII, approved field mapping, and guest fallback gates remain
  open.

## Target Architecture

Auth exposes an additive customer data wallet:

- Profile: `/auth/profile`, `/auth/profile` PATCH.
- Delivery address book:
  - `GET /auth/profile/delivery-addresses`
  - `POST /auth/profile/delivery-addresses`
  - `GET /auth/profile/delivery-addresses/:addressId`
  - `PATCH /auth/profile/delivery-addresses/:addressId`
  - `DELETE /auth/profile/delivery-addresses/:addressId`
  - `POST /auth/profile/delivery-addresses/:addressId/default`
- Invoice profiles:
  - `GET /auth/profile/invoice-profiles`
  - `POST /auth/profile/invoice-profiles`
  - `GET /auth/profile/invoice-profiles/:profileId`
  - `PATCH /auth/profile/invoice-profiles/:profileId`
  - `DELETE /auth/profile/invoice-profiles/:profileId`
  - `POST /auth/profile/invoice-profiles/:profileId/default`
- Checkout aggregate:
  - `GET /auth/profile/checkout-data`

Orders continues to receive order snapshots:

- `customer`
- `shippingAddress`
- `billingAddress`
- optional future metadata:
  - `authUserId`
  - `authDeliveryAddressId`
  - `authInvoiceProfileId`

The metadata must not make Orders the source of reusable profile data.

## Execution Phases

### Phase 0 - Planning And Readiness

Status: active in this document.

Tasks:

- Document the target Auth customer data wallet contract.
- Record current implementation gaps.
- Assign repo-specific workstreams.
- Keep all runtime code unchanged.

Validation:

- Documentation presence scan.
- Missing-marker scan with intentional blockers.
- Secret-pattern scan.

### Phase 1 - Auth Contract And Storage

Owner role: Auth backend worker.

Allowed repositories:

- `auth-microservice` only.

Allowed files:

- `src/auth/**`
- `src/users/**` only when profile projection needs entity wiring.
- `shared/database/database.module.ts`
- schema migration files once the repo-approved migration path is confirmed.
- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `src/auth/auth-contract.spec.ts`
- `src/info/info.controller.ts`
- orchestrator status/state docs.

Forbidden files:

- Consumer service source.
- Payment, order, catalog, warehouse, notification, marketing, logging code.
- Runtime secrets, Vault values, production user data, or direct DB writes by
  agents.

Tasks:

1. Confirm the production-safe schema migration path.
2. Add Auth-owned delivery address and invoice profile storage.
3. Add DTOs with validation and sanitization.
4. Add ownership checks scoped to authenticated `req.user.id`.
5. Add CRUD/default-selection endpoints.
6. Add `GET /auth/profile/checkout-data`.
7. Preserve legacy `profileAddress` projection.
8. Document the contract and run tests.

Acceptance:

- A user can have multiple delivery addresses.
- A user can have multiple invoice profiles.
- Exactly one default delivery address and one default invoice profile can be
  selected per user, or none if no entries exist.
- Deleted entries cannot be read/updated by the same or another user.
- No password/token/secret fields are returned.

Validation:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`

Deployment:

- Run only after source validation and owner approval for production deploy.

### Phase 2 - FlipFlop Consumer Integration

Owner role: FlipFlop checkout/profile worker.

Dependencies:

- Phase 1 Auth API source complete.
- Prefer Auth deployed before live checkout smoke.
- Must inspect current dirty worktree and avoid unrelated product/detail files.

Allowed files:

- `services/frontend/lib/api/auth.ts`
- `services/frontend/lib/api/addresses.ts`
- `services/frontend/lib/api/orders.ts`
- `services/frontend/app/checkout/page.tsx`
- `services/frontend/app/profile/addresses/page.tsx`
- `services/frontend/app/profile/page.tsx`
- `shared/auth/auth.interface.ts`
- `shared/auth/auth.service.ts`
- `services/user-service/src/users/users.controller.ts`
- `services/user-service/src/users/users.service.ts`
- focused tests/scripts/reports for this goal.

Forbidden files:

- Product browsing/product detail files currently dirty from unrelated work.
- Catalog/Orders/Payments/Warehouse service source unless explicitly assigned.
- FlipFlop Prisma schema migration unless the worker is explicitly doing the
  compatibility cleanup lane after Auth integration is validated.

Tasks:

1. Extend FlipFlop shared Auth client for delivery address and invoice profile
   endpoints.
2. Change `/users/addresses` compatibility API to proxy Auth address book for
   authenticated users.
3. Keep local `DeliveryAddress` only as a migration snapshot/cache until
   compatibility cleanup is approved.
4. Update checkout to show selectors for saved delivery addresses and invoice
   profiles.
5. Support adding/editing entries from checkout/profile by calling Auth.
6. Preserve guest checkout. Guest payloads still submit one-off snapshots.
7. Submit selected snapshots to FlipFlop order creation / Orders as immutable
   order data.
8. Add UI copy that does not claim local ownership of reusable data.

Validation:

- Focused frontend type/build check.
- Focused user-service tests or source-level contract checks.
- Checkout smoke for authenticated user with saved Auth address/invoice profile.
- Guest checkout smoke.
- Sensitive-output scan.

### Phase 3 - Orders Contract Compatibility

Owner role: Orders contract worker.

Dependencies:

- Phase 1 Auth API target stable.
- FlipFlop payload shape proposed.
- Current Orders dirty event-contract work must be resolved or isolated.

Allowed files:

- `src/orders/create-order.dto.ts`
- `src/orders/order.entity.ts` only if additive metadata is approved.
- `docs/orchestrator/CHANNEL_ORDER_CREATE_CONTRACT.md`
- order contract verifiers/fixtures/tests.

Forbidden files:

- Payment provider code.
- Warehouse mutation behavior.
- Event payloads with raw customer/address/billing data.

Tasks:

1. Confirm whether existing `customer`, `shippingAddress`, and
   `billingAddress` snapshots are sufficient for Phase 2.
2. If useful, add optional bounded metadata fields:
   `authUserId`, `authDeliveryAddressId`, `authInvoiceProfileId`.
3. Ensure idempotency comparison still uses snapshots and bounded fields only.
4. Document that Auth remains reusable profile source and Orders stores order
   snapshots only.

Validation:

- `npm run build`
- `npm run verify:create-order-contract`
- `npm run verify:event-contracts`
- `npm test`
- sensitive-output scan.

### Phase 4 - Other Consumer Repository Plans

Owner role: per-repo consumer workers.

#### Cliplot

Status: dependency-gated.

Reason:

- Cliplot checkout is currently guarded and approval-gated for live mutation.

Plan:

- Add an Auth customer-data-wallet integration plan first.
- Only implement selectors when live or guarded checkout UX is approved for
  account users.
- Preserve guest checkout and guarded no-mutation behavior.

#### Rent-a-box

Status: plan-created; code migration dependency-gated.

Reason:

- Read-only discovery found local email/password auth, local JWT issuance,
  local password hash storage, local customer profiles, billing address fields,
  and domain foreign keys coupled to local `customer_profiles.id`.

Plan:

- Repo-local migration plan and callback scaffold: `rent-a-box` commit
  `6ecd76e`, files `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`
  and `apps/web/src/app/auth/**`.
- Do not treat this as only an address selector upgrade.
- Source-backed Rent-a-box hosted Auth callback route with concrete
  `client_id=rent-a-box` and
  `return_url=https://rent-a-box.alfares.cz/auth/callback` is complete; next
  replace local credential/session ownership with hosted Auth and
  `POST /auth/validate` behind a compatibility boundary only after customer
  session adapter/local profile binding is approved.
- Resolve admin role mapping and consent/profile migration mapping before
  product-code migration.
- Preserve Rent-a-box domain ownership for boxes, reservations, rentals,
  contracts, mock payments, PIN/access-code state, and immutable snapshots.
- Do not drop or backfill local user/profile columns without owner-approved
  reversible migration evidence.
- Then integrate Auth address/invoice selectors for registered users.

#### Chytrakoupe

Status: plan-created; selector implementation dependency-gated.

Reason:

- Hosted Auth is present, but checkout is still guest-first/manual and duplicates
  profile/contact/address payloads into order snapshots.
- Read-only audit found no Auth wallet selector and no local profile/address DB
  table, but did find Auth callback hardening and client-id decisions that must
  be settled first.

Plan:

- Repo-local selector implementation: `chytrakoupe` commit `b280f75`, files
  `lib/auth/wallet.ts`, `components/checkout/CheckoutClient.tsx`, and
  `implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`.
- Decide whether ChytraKoupe keeps `client_id=flipflop` or receives a new Auth
  client id before production runtime claim.
- Decide whether central Orders must persist `customer.authSubject` for
  signed-in ChytraKoupe orders. Snapshot mapping through `/api/orders/guest` is
  source-resolved and source-prepared, but the current guest path leaves Auth
  subject unset.
- Remove query-token callback fallback during implementation unless an owner
  approves a legacy compatibility exception.
- Replace registered-user checkout entry with Auth checkout-data selectors.
- Preserve guest checkout and one-off order snapshots.

#### Heureka

Status: marketplace/channel order ingestion lane.

Reason:

- Order ingestion surfaces forward customer/shipping/billing snapshots to
  Orders. External e-shop registration details remain `[UNKNOWN]`.

Plan:

- Preserve marketplace order evidence and Orders snapshots.
- Do not back-write marketplace buyer data into Auth unless the buyer is an
  authenticated ecosystem user and explicitly saves it.

#### Catalog

Status: not a checkout owner.

Plan:

- No address or invoice profile implementation unless Catalog has a customer
  checkout/account surface later.
- Continue using Auth for admin/operator identity only.

#### Allegro, Aukro, Bazos

Status: likely operator/channel publishing surfaces, not customer checkout
surfaces.

Plan:

- Do not implement customer address/invoice selectors until a real customer
  checkout surface is confirmed.
- Keep hosted Auth for operator identity.
- If a customer checkout is later introduced, follow the same Auth address and
  invoice selector contract.

#### Payments

Status: no reusable profile ownership.

Plan:

- Payments may receive billing/order/payment references through approved order
  or payment creation contracts.
- Payments must not store reusable invoice profile truth.

#### Leads And Marketing

Status: event consumers only.

Plan:

- Do not ingest raw addresses or billing profiles.
- Continue using Auth APIs for registered-user preferences and Orders events for
  order lifecycle segmentation.

#### Warehouse

Status: no reusable profile ownership.

Plan:

- Warehouse may receive shipment/reservation data through Orders/fulfillment
  contracts only.
- Warehouse must not own registered-user address books.

## Parallel Execution Plan

| Workstream                                             | Status           | Owner role               | Scope                                                      | Dependencies        | Validation owner           | Merge order                  |
| ------------------------------------------------------ | ---------------- | ------------------------ | ---------------------------------------------------------- | ------------------- | -------------------------- | ---------------------------- |
| A0 Auth planning docs                                  | active           | Coordinator              | Auth docs only                                             | None                | Coordinator                | 1                            |
| A1 Auth data wallet backend                            | ready after A0   | Auth backend worker      | Auth endpoints, DTOs, entities, docs, tests                | Confirm schema path | Auth coordinator           | 2                            |
| A2 Auth hosted/profile UI                              | dependency-gated | Auth frontend worker     | Auth-hosted account/profile management UI                  | A1 API              | Auth coordinator           | 3                            |
| F1 FlipFlop shared Auth client and user-service bridge | dependency-gated | FlipFlop backend worker  | Auth client, `/users/*` bridge                             | A1 API              | FlipFlop integration owner | 4                            |
| F2 FlipFlop checkout/profile UX                        | dependency-gated | FlipFlop frontend worker | Checkout selectors, profile addresses UI                   | F1                  | FlipFlop integration owner | 5                            |
| O1 Orders contract note/additive metadata              | dependency-gated | Orders worker            | Create-order contract docs/DTO if needed                   | A1 + F1 payload     | Orders owner               | 6                            |
| R1 Rent-a-box hosted Auth migration plan               | live-evidence-refreshed; session/admin/migration-gated | Rent-a-box coordinator | `rent-a-box/apps/web/src/app/auth/**`, `rent-a-box/apps/web/src/lib/auth/hosted-auth.ts`, `rent-a-box/docs/goals/GOAL-12-auth-customer-data-wallet-migration.md` | Customer session adapter/local profile binding, admin role mapping, consent/profile migration mapping, migration approval | Rent-a-box owner | 7 |
| CK1 Chytrakoupe checkout selector integration          | response-shape-verifier-narrowed; runtime-gated | Chytrakoupe worker | `chytrakoupe/lib/auth/wallet.ts`, `chytrakoupe/implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`, `chytrakoupe/scripts/verify-auth-wallet-checkout-selectors.mjs` | Client-id and optional Auth subject linkage | Chytrakoupe owner | 8 |
| C1 Cliplot plan                                        | live-evidence-refreshed; runtime-gated | Cliplot coordinator | Docs/guarded plan only | Selector/session/PII approvals, approved field mapping, and guest fallback decisions | Cliplot owner | After live checkout approval |
| M1 Marketplace order-snapshot audit                    | ready read-only  | Explorer                 | Allegro/Aukro/Bazos/Heureka/Catalog surface classification | None                | Coordinator                | No code merge                |

Shared contracts:

- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- Orders `orders.create.v1`
- Hosted Auth login/register token handoff contract.

Integration owner:

- Original Auth coordinator until Auth API is deployed.
- FlipFlop integration owner after A1/A2 when consumer changes begin.

Validation owner:

- Each repo worker validates its own repo.
- Coordinator validates the cross-repo happy path after Auth + FlipFlop source
  integration.

Conflict policy:

- No worker edits shared public contracts while another worker edits dependent
  consumers unless the contract worker has landed first.
- Dirty worktrees must be inspected and preserved before worker edits.
- Consumers must not change Orders, Payments, Warehouse, Catalog, or Auth files
  unless that repo is explicitly assigned to the same worker.

## Agent-Ready Workstreams

### Worker A1 - Auth Backend

Objective:

- Implement Auth-owned delivery address book and invoice profile APIs.

Allowed files:

- `auth-microservice/src/auth/**`
- `auth-microservice/src/users/**`
- `auth-microservice/shared/database/database.module.ts`
- `auth-microservice/docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
- `auth-microservice/docs/orchestrator/*`

Forbidden:

- Consumer repos, production DB direct writes, secrets/tokens/raw user data.

Expected output:

- Source changes, tests, docs, validation evidence, deploy readiness note.

Blockers:

- Auth live DB migration apply and Auth deploy were completed in Goal 10.25
  from Source Preflight-captured HEAD
  `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`; this worker lane now only
  retains synthetic authenticated smoke and dependent consumer gates.

### Worker F1 - FlipFlop Backend Bridge

Objective:

- Replace authenticated local address-book source with Auth API bridge while
  retaining compatibility wrappers.

Allowed files:

- `flipflop/shared/auth/**`
- `flipflop/services/user-service/src/users/**`
- focused tests/reports.

Forbidden:

- Product/detail dirty files, Prisma destructive migration, live deploy.

Expected output:

- API bridge using Auth delivery/invoice endpoints and validation evidence.

Dependencies:

- Auth A1 endpoint contract.

### Worker F2 - FlipFlop Checkout UX

Objective:

- Add delivery address and invoice profile selectors to checkout and profile
  management.

Allowed files:

- `flipflop/services/frontend/app/checkout/page.tsx`
- `flipflop/services/frontend/app/profile/addresses/page.tsx`
- `flipflop/services/frontend/app/profile/page.tsx`
- `flipflop/services/frontend/lib/api/auth.ts`
- `flipflop/services/frontend/lib/api/addresses.ts`
- `flipflop/services/frontend/lib/api/orders.ts`
- focused UI tests/reports.

Forbidden:

- Backend persistence changes, product/detail dirty files, Orders code.

Dependencies:

- Worker F1.

### Worker O1 - Orders Snapshot Contract

Objective:

- Confirm or add bounded Auth selected-profile metadata while preserving Orders
  snapshot ownership.

Allowed files:

- `orders-microservice/src/orders/create-order.dto.ts`
- `orders-microservice/docs/orchestrator/CHANNEL_ORDER_CREATE_CONTRACT.md`
- contract fixtures/verifiers/tests.

Forbidden:

- Raw address data in events/logs, payment provider code, Warehouse behavior.

Dependencies:

- Auth A1 and FlipFlop F1 payload.

### Worker R1 - Rent-a-box Auth Migration Plan

Objective:

- Produce a dedicated plan to replace local credentials/JWT/profile ownership
  with hosted Auth and Auth customer data wallet integration.

Allowed files:

- `rent-a-box` docs and planning files first.
- Code only after the plan is approved in a later worker session.

Forbidden:

- Production customer DB reads, local password hash migration, token printing,
  or destructive auth changes.

Dependencies:

- Auth A1 endpoint contract.

### Worker CK1 - Chytrakoupe Checkout Selector

Objective:

- Align hosted-auth checkout with Auth profile/address/invoice selectors while
  preserving guest checkout.

Allowed files:

- `chytrakoupe/components/checkout/CheckoutClient.tsx`
- `chytrakoupe/lib/auth/session.ts`
- `chytrakoupe/lib/config/env.ts`
- focused docs/tests after repo instructions are read.

Forbidden:

- Local credential changes unless a separate hosted-auth migration issue is
  opened.

Dependencies:

- Auth A1 endpoint contract.

## Validation Matrix

Auth:

- `npm test -- --runTestsByPath src/auth/auth-contract.spec.ts`
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`

FlipFlop:

- repo-specific frontend build/type checks after inspecting package scripts.
- user-service focused tests or compile.
- authenticated checkout smoke with selected Auth address and invoice profile.
- guest checkout smoke.

Orders:

- `npm run build`
- `npm run verify:create-order-contract`
- `npm run verify:event-contracts`
- `npm test`

Cross-repo:

- Hosted Auth login to FlipFlop checkout.
- `GET /auth/profile/checkout-data` returns saved addresses/profiles.
- FlipFlop checkout preselects default entries.
- FlipFlop sends distinct billing and shipping snapshots when the user selects
  different entries.
- Order creation receives snapshots.
- Orders event fixtures contain no raw address/billing/customer payload.
- No secret/token/password/raw production user data appears in docs, logs, or
  reports.

## Not Implemented In This Planning Pass

- Runtime Auth code changes.
- Auth live schema and production deployment are now completed by Goal 10.25;
  this original planning pass did not implement them.
- Consumer repo changes.
- Backfill/migration of existing FlipFlop local addresses.
- Live test-account checkout.

## Open Blockers

- Auth live schema apply, deploy, schema-only verification, and unauthenticated
  wallet 401 smoke were completed in Goal 10.25 from Source Preflight-captured
  HEAD `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d`.
- `[MISSING: owner-approved synthetic account for live cross-repo smoke]`
- Auth invoice profile v1 field semantics are defined in
  `docs/UNIFIED_AUTH_CONTRACT.md` and
  `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`: `companyId` is the company
  registration identifier, `vatId` is the VAT/DIC-style identifier, `taxId` is
  a separate tax identifier, and invoice recipient email is `email`.
- Consumer order snapshot support/validation for optional Auth invoice fields
  `companyId`, `vatId`, and `email` was source-prepared in Orders commit
  `3c7d0c3` and FlipFlop commit `20dd1f8`; authenticated runtime proof remains
  gated on synthetic account/token approval.
- Rent-a-box, ChytraKoupe, and Cliplot readiness lanes now consume the completed
  Auth wallet 401 endpoint evidence; product-code migrations remain gated by
  repo-specific decisions.
- `[UNKNOWN: final consumer repo set beyond FlipFlop and Cliplot checkout surfaces]`
