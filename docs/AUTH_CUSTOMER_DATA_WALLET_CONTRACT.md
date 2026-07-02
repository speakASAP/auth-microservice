# Auth Customer Data Wallet Contract

Status: Auth API, hosted profile UI, live wallet schema, deployment, and unauthenticated runtime 401 gate complete; authenticated synthetic smoke and consumer product-code migrations remain gated
Owner: auth-microservice
Created: 2026-07-02

Validation/deployment plan:
`docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`

## Intent

Auth is the Statex ecosystem source of truth for registered-user identity,
profile/contact data, delivery address book entries, and invoice/billing
profiles.

Users must enter reusable personal, delivery, and invoice data once through
Auth-owned surfaces or Auth APIs. Consumer applications may display selectors
and submit immutable snapshots to order/payment flows, but they must not become
the editable source of truth for registered-user profile data.

## Current Verified State

Implemented now:

- `POST /auth/register` stores `email`, `firstName`, `lastName`, and `phone` in
  the Auth `users` table.
- `GET /auth/profile` returns a fresh sanitized Auth database profile for the
  authenticated subject.
- `PATCH /auth/profile` updates Auth-owned profile fields and one
  `canonicalProfile.address` document under `users.perApplicationPreferences`.
- Source now defines Auth-owned `user_delivery_addresses` and
  `user_invoice_profiles` tables through idempotent SQL for deployments where
  `DB_SYNC=false`.
- Source now exposes authenticated CRUD/default-selection endpoints for
  delivery address books and invoice profiles under `/auth/profile/...`.
- Source now exposes `GET /auth/profile/checkout-data` for checkout prefill and
  selector hydration.
- FlipFlop already reads and updates Auth profile data through its shared Auth
  client and mirrors one default address into its local `delivery_addresses`
  table as a compatibility snapshot.
- Orders accepts `customer`, `shippingAddress`, and `billingAddress` as order
  creation snapshots. Orders is allowed to store these snapshots for order
  history and legal/fulfillment evidence, but not as editable user profile
  truth.
- FlipFlop source now includes typed Auth wallet clients, defensive
  checkout/profile selectors, and a checkout manual-edit guard that fall back
  to existing local/manual flows when wallet data is unavailable; authenticated
  runtime proof remains gated on synthetic account/token approval.
- Auth hosted `/profile` source now includes wallet management for canonical
  profile fields, delivery address book entries, and invoice profiles.
- Auth source now includes `npm run check:customer-data-wallet-runtime` for the
  predeploy 404 and post-deploy 401 wallet route gate.

Live rollout state:

- `scripts/create-customer-data-wallet-tables.sql` was applied in one approved
  transaction after schema-only metadata preflight. Post-apply verification
  found `user_delivery_addresses` and `user_invoice_profiles`, 45 wallet
  columns, and 8 wallet indexes.
- Auth was deployed from Source Preflight HEAD
  `2871a6f345f7d33aeaaa2f41350d67a6b50c1d7d` with backend/web images tagged
  `2871a6f-20260702210100`.
- `npm run check:customer-data-wallet-runtime -- --expect=deployed` passed:
  `/health` returned HTTP 200 and wallet endpoints returned HTTP 401
  unauthenticated without sending auth headers, cookies, request bodies,
  printing response bodies, or reading the database.
- FlipFlop non-mutating post-deploy checks passed, but authenticated synthetic
  checkout/profile smoke remains approval-gated.
- Cross-repository runtime proof that Auth-selected delivery/invoice entries
  reach immutable order snapshots is still gated on an owner-approved synthetic
  account/token and non-production customer data.
- Some repos still duplicate more than profile snapshots. `rent-a-box` was
  found with local email/password auth, local JWTs, local profile storage, and
  billing address fields. This remains a separate hosted Auth/session/admin-role
  migration risk, not just an address selector upgrade.

## Data Ownership

| Data                             | Owner                      | Notes                                                                                                                     |
| -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Registered user identity         | Auth                       | `email`, `firstName`, `lastName`, `phone`, contact info, verification state.                                              |
| Editable registered-user profile | Auth                       | `/auth/profile` and future profile UI/API.                                                                                |
| Delivery address book            | Auth                       | Multiple named recipient/destination entries per user.                                                                    |
| Invoice/billing profile library  | Auth                       | Multiple named personal or company billing entries per user.                                                              |
| Order customer/address snapshot  | Orders                     | Immutable snapshot for the specific order, copied from Auth or guest checkout payload.                                    |
| Guest checkout one-off data      | Channel checkout/Orders    | Guest data may create an order snapshot; it is not reusable Auth profile data unless the user authenticates and saves it. |
| Products/prices/stock/payments   | Catalog/Warehouse/Payments | Auth must not take over these domains.                                                                                    |

## Target Auth API Shape

All endpoints require bearer authentication unless marked internal.

Profile:

- `GET /auth/profile`
- `PATCH /auth/profile`

Delivery address book:

- `GET /auth/profile/delivery-addresses`
- `POST /auth/profile/delivery-addresses`
- `GET /auth/profile/delivery-addresses/:addressId`
- `PATCH /auth/profile/delivery-addresses/:addressId`
- `DELETE /auth/profile/delivery-addresses/:addressId`
- `POST /auth/profile/delivery-addresses/:addressId/default`

Invoice/billing profiles:

- `GET /auth/profile/invoice-profiles`
- `POST /auth/profile/invoice-profiles`
- `GET /auth/profile/invoice-profiles/:profileId`
- `PATCH /auth/profile/invoice-profiles/:profileId`
- `DELETE /auth/profile/invoice-profiles/:profileId`
- `POST /auth/profile/invoice-profiles/:profileId/default`

Checkout summary:

- `GET /auth/profile/checkout-data`

`checkout-data` returns sanitized profile fields, delivery addresses, invoice
profiles, and default IDs in one read optimized for storefront checkout
prefill. It must not return passwords, tokens, secrets, raw audit data, or
provider/payment details.

## Target Delivery Address Fields

Minimum fields:

- `id`
- `label`
- `firstName`
- `lastName`
- `street`
- `city`
- `postalCode`
- `country`
- `phone`
- `isDefault`
- `createdAt`
- `updatedAt`

Optional future fields:

- `company`
- `street2`
- `region`
- `email`
- `deliveryInstructions`
- `pickupPointId`
- `sourceApplication`
- `lastUsedAt`

## Target Invoice Profile Fields

Minimum fields:

- `id`
- `label`
- `type`: `person` or `company`
- `firstName`
- `lastName`
- `companyName`
- `companyId`
- `taxId`
- `vatId`
- `street`
- `city`
- `postalCode`
- `country`
- `email`
- `phone`
- `isDefault`
- `createdAt`
- `updatedAt`

Field semantics:

- `companyId` is the company registration identifier, including Czech ICO-style
  values.
- `vatId` is the VAT/DIC-style identifier when applicable.
- `taxId` is a separate tax identifier for storefront/accounting flows that
  require one.
- `email` is the invoice recipient email. `invoiceEmail` and
  `electronicInvoiceEmail` are not Auth v1 aliases.

Optional future fields:

- `street2`
- `region`
- `sourceApplication`
- `lastUsedAt`

## Registration And Profile Editing Rule

Registration through Auth should collect only account/profile fields needed for
identity and contact. Checkout-specific data should be saved when the user
actually provides it in profile or checkout context:

- If an authenticated user edits profile fields, Auth updates `/auth/profile`.
- If an authenticated user adds or edits a delivery address, Auth updates the
  delivery address book.
- If an authenticated user adds or edits invoice data, Auth updates invoice
  profiles.
- If a guest enters one-off checkout data, the consumer may submit it to Orders
  as an order snapshot. It must not silently create Auth profile data without
  authentication and explicit save intent.

## Consumer Responsibilities

Consumer applications must:

- Use hosted Auth login/register for identity.
- Read `GET /auth/profile/checkout-data` after login before rendering checkout
  fields.
- Show selectors for delivery addresses and invoice profiles when the user has
  saved entries.
- Provide "add new" and "edit" actions that call Auth APIs, not local profile
  persistence.
- Submit resolved address/invoice snapshots to their order creation flow. Submit
  selected Auth wallet IDs only after an approved immutable provenance contract
  defines field names and idempotency semantics.
- Preserve guest checkout when required by the product.
- Avoid logging full addresses, billing data, tokens, passwords, or raw
  customer payloads.

Consumer applications may:

- Store order snapshots required for legal, fulfillment, support, and
  idempotency behavior.
- Keep bounded local caches or compatibility snapshots when needed during
  migration, as long as Auth remains the update source and stale snapshots are
  not presented as reusable truth.

Consumer applications must not:

- Create app-local editable address books for authenticated users after the Auth
  address-book APIs exist.
- Update registered-user name, phone, delivery address, or billing profile only
  in local application databases.
- Put address/billing profiles into JWT claims.
- Send raw profile/address data in order lifecycle events, marketing events, or
  logs.

## Backward Compatibility

The current `/auth/profile` and `PATCH /auth/profile` contracts stay
backward-compatible. Existing `profileAddress` may continue to be returned
during migration as a projection of the default delivery address or legacy
`canonicalProfile.address`.

New endpoints are additive. Consumer rollouts should first read both the new
address book and the legacy `profileAddress`, then stop writing legacy local
address sources after the consumer-specific session, selector, and fallback
contracts are validated.

## Validation Requirements

Auth validation:

- DTO validation for profile, delivery address, and invoice profile fields.
- Unit tests for CRUD, default-selection uniqueness, sanitization, ownership
  checks, and legacy `profileAddress` projection.
- `npm run test:auth-contract`
- `npm run build`
- `npm run lint`
- `git diff --check`

Consumer validation:

- Source tests proving checkout/profile forms call Auth for reusable data.
- Checkout smoke proving selected Auth address/invoice data becomes an order
  snapshot in Orders.
- Guest checkout smoke proving unauthenticated checkout still works when in
  scope.
- Sensitive-output scan proving no secrets, tokens, full addresses, billing
  payloads, or raw customer data are logged or documented.

## Open Blockers

- `[MISSING: owner-approved synthetic account/token for authenticated Auth wallet CRUD/default/delete smoke]`
- `[MISSING: owner-approved synthetic account/token for FlipFlop authenticated checkout/profile runtime smoke]`
- `[MISSING: source-backed Rent-a-box hosted Auth callback route, concrete client_id/return_url, admin role mapping, consent/profile migration mapping, and migration/backfill decisions before product-code migration]`
- `[MISSING: ChytraKoupe final Auth client-id decision and authenticated Auth subject linkage decision if central Orders must persist customer.authSubject before production runtime claim]`
- `[MISSING: Cliplot selector behavior, authenticated browser/session, no-PII exposure, and response-contract approvals before wallet selector integration]`
- `[UNKNOWN: whether all marketplace/channel services have customer checkout surfaces or only operator publishing surfaces]`
- `[UNKNOWN: whether live users already have legacy perApplicationPreferences.canonicalProfile.address data requiring migration or backfill]`

Resolved for current Goal 10 scope:

- Live DB migration apply, schema-only verification, Auth deploy, and
  unauthenticated wallet endpoint 401 smoke are complete.
- First consumer lanes are known: FlipFlop source-prepared, Orders immutable
  snapshot support source-prepared, and Rent-a-box/ChytraKoupe/Cliplot
  dependency-gated readiness lanes refreshed against Auth 401 evidence.
- Rent-a-box commit `9e6cf38` records generic hosted Auth handoff,
  `POST /auth/validate`, Auth wallet API shape, and Auth-side wildcard
  redirect/CORS acceptance for `https://rent-a-box.alfares.cz/auth/callback`
  as resolved upstream evidence while preserving source callback route,
  `client_id`/`return_url`, admin role, consent/profile migration, and backfill
  gates.
- ChytraKoupe commit `b280f75` source-prepares Auth wallet checkout selectors
  and immutable snapshot payloads while preserving final client-id and optional
  `customer.authSubject` linkage gates before production runtime claim.
- Cliplot current observed HEAD `0e6a233` has unrelated dirty
  approval/config/integration work; wallet readiness still reports no runtime
  wallet integration and preserves selector behavior, authenticated session,
  no-PII exposure, and response-contract gates.
- Auth invoice profile v1 field ownership is defined: Auth owns reusable
  `companyId`, `taxId`, `vatId`, and invoice-recipient `email`; Orders stores
  immutable snapshots only, and Payments/accounting issuance remains outside
  Auth wallet ownership.
