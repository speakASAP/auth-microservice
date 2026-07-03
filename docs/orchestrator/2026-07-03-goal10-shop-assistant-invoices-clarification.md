# Goal 10 Shop Assistant And Invoices Clarification Audit

Status: source-only coordinator and subagent audit completed
Created: 2026-07-03
Owner: Auth Goal 10 coordinator

## Intent Chain

- Vision: Auth remains the only editable source of truth for registered-user profile, delivery address book, and invoice profile data.
- Goal impact: possible billing/profile-adjacent services are classified before any consumer work is dispatched.
- System: Auth owns reusable wallet data; services may keep bounded domain records, entitlement state, invoice documents, and immutable order/invoice snapshots.
- Feature: close the two source-only follow-up unknowns from the extended Goal 10 surface audit.
- Task: audit `shop-assistant` billing/account-profile fields and `invoices-microservice` account invoice access against the Auth wallet boundary.
- Execution plan: remote read-only source/docs inspection plus two parallel subagent audits; no source edits in consumer repos, no runtime calls, no deploys, no DB reads/writes, no env dumps, no token/secret inspection, and no customer-data output.
- Coding prompt: mark wallet lanes only where reusable profile, delivery address, or invoice profile ownership exists; do not move entitlement, payment-provider, invoice-document, or order-snapshot ownership into Auth.
- Code: Auth coordinator documentation only.
- Validation: Auth runtime gate packet checker, `git diff --check`, and changed-file sensitive literal scan.

## Shop Assistant Verdict

Verdict: negative boundary for current source.

Evidence:

- Remote state was clean on `main...origin/main` at `82134a9 docs: record stripe webhook completion smoke`.
- `BillingCheckout` stores `userId`, plan/order/payment/status/amount/currency/method/redirect/expiry/metadata state. No delivery address, invoice profile, tax/VAT, company, legal recipient, or reusable wallet profile fields were found.
- `UserEntitlement` stores subscription/entitlement state keyed by hosted Auth `user.id`.
- `BillingService.createCheckout()` builds provider payloads from Auth-derived `email`, composed name, and `phone`; it does not read or write local delivery address, invoice address, company, or tax profile data.
- `AccountProfile` has only `userId`, `name`, and optional `role`; dashboard profile forms expose only name/role for search recipients and saved criteria.
- Public delivery wording is shopping intent/search criteria, not persisted delivery-address wallet data.

Boundary decision:

- Do not create a Goal 10 consumer lane for Shop Assistant now.
- Shop Assistant remains allowed to own search-recipient profiles, saved criteria, billing checkout records, entitlement state, and payment-provider handoff metadata.
- If a future Auth contract forbids using validated token/user profile fields for payment customer payloads, create a bounded follow-up limited to `src/billing/**` and `src/auth/auth.interface.ts`. That is not required by current Goal 10 evidence.

## Invoices Microservice Verdict

Verdict: bounded wallet-adjacent consumer boundary, no profile-editor ownership.

Evidence:

- Remote state was clean on `main...origin/main` at `1990618 docs: record cliplot invoices final smoke evidence`.
- `GET /invoices/account` and `POST /invoices/account/:invoiceId/download-link` are Auth-guarded customer account read/download-link routes.
- `CustomerAuthGuard` validates bearer tokens through Auth `/auth/validate`, normalizes Auth `sub`/`id`/email, and attaches the result to the request.
- `InvoicesService` scopes account reads to stored `orderSnapshot` Auth subject/id fields first, with email fallback for legacy rows.
- Invoice rendering consumes immutable buyer/legal data from Orders snapshots, including billing address and company/tax/VAT fields.
- Targeted search found no `PUT`/`PATCH`/`DELETE` profile or wallet editor routes.
- Invoices docs explicitly state reusable customer profile/address/invoice-profile truth is not owned by Invoices.

Boundary decision:

- Invoices must not implement invoice profile editing, customer reusable profile storage, address/company/tax/VAT wallet storage, or Auth subject ownership.
- Invoices remains a read/render/account-document consumer: it issues and serves invoice documents from immutable Orders snapshots and scopes customer account access through Auth subject/id.
- The producer path for reusable invoice profile data is Auth wallet -> checkout/storefront selector -> Orders immutable billing snapshot -> Invoices rendering/read access.
- Remaining runtime proof stays on the existing consumer gates: FlipFlop order snapshot smoke and Cliplot authenticated checkout subject/session contract.

## Parallel Execution Result

- `shop-assistant` subagent: completed read-only audit; no edits; negative boundary.
- `invoices-microservice` subagent: completed read-only audit; no edits; bounded consumer boundary.
- Coordinator: integrated both findings into Auth Goal 10 docs.

## Remaining Gates

- FlipFlop authenticated central Orders create/read/cancel smoke proving persisted `customer.authSubject` and billing snapshot remains owner-approved runtime work.
- Cliplot checkout submit/live commerce and hosted Auth callback/session contract remain separately gated.
- Rent-a-box route/onboarding migration, backfill, and product-code migration remain owner-approved gates.
- Future registered-user checkout/address/invoice editors introduced after this audit remain `[UNKNOWN]` until separately inspected.
