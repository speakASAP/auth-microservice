# Auth Customer Data Wallet Contract

Status: planned
Owner: auth-microservice
Created: 2026-07-02

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
- FlipFlop already reads and updates Auth profile data through its shared Auth
  client and mirrors one default address into its local `delivery_addresses`
  table as a compatibility snapshot.
- Orders accepts `customer`, `shippingAddress`, and `billingAddress` as order
  creation snapshots. Orders is allowed to store these snapshots for order
  history and legal/fulfillment evidence, but not as editable user profile
  truth.

Not implemented yet:

- Auth does not expose a first-class multi-address delivery address book.
- Auth does not expose invoice/billing profile CRUD.
- Auth does not expose default delivery and default invoice profile selection.
- Auth does not expose stable address/profile IDs for checkout selectors.
- Consumer checkout forms still enter billing/delivery data inline, even when a
  user is authenticated.
- Cross-repository checkout contracts do not yet require Auth address/profile
  selectors before creating order snapshots.
- Some repos still duplicate more than profile snapshots. `rent-a-box` was
  found with local email/password auth, local JWTs, local profile storage, and
  billing address fields. This is a separate credential/profile migration risk,
  not just an address selector upgrade.

## Data Ownership

| Data | Owner | Notes |
| --- | --- | --- |
| Registered user identity | Auth | `email`, `firstName`, `lastName`, `phone`, contact info, verification state. |
| Editable registered-user profile | Auth | `/auth/profile` and future profile UI/API. |
| Delivery address book | Auth | Multiple named recipient/destination entries per user. |
| Invoice/billing profile library | Auth | Multiple named personal or company billing entries per user. |
| Order customer/address snapshot | Orders | Immutable snapshot for the specific order, copied from Auth or guest checkout payload. |
| Guest checkout one-off data | Channel checkout/Orders | Guest data may create an order snapshot; it is not reusable Auth profile data unless the user authenticates and saves it. |
| Products/prices/stock/payments | Catalog/Warehouse/Payments | Auth must not take over these domains. |

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

- `companyName`
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

Optional future fields:

- `electronicInvoiceEmail`
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
- Submit selected address/invoice profile IDs and resolved snapshots to their
  order creation flow.
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
address sources after Auth is deployed and validated.

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

- `[MISSING: Auth production-safe schema migration path for new profile tables]`
- `[MISSING: approved list of first consumer repositories to mutate after Auth API deploy]`
- `[MISSING: cross-service decision for exact billing fields Auth owns versus Orders, Payments, or accounting-owned invoice issuance]`
- `[UNKNOWN: whether all marketplace/channel services have customer checkout surfaces or only operator publishing surfaces]`
- `[UNKNOWN: whether live users already have legacy perApplicationPreferences.canonicalProfile.address data requiring migration or backfill]`
- `[MISSING: owner-approved test account for live address/invoice checkout smoke]`
