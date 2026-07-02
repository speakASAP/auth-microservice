# Auth Context Package

```yaml
id: AUTH-CONTEXT-PACKAGE
status: validated
owner: owner-selected-profile-single-source-audit
created: 2026-07-01
last_updated: 2026-07-01
completeness_level: bounded
upstream:
  - user production request
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/PROJECT_INVARIANTS.md
downstream:
  - docs/orchestrator/EXECUTION_PLAN.md
  - docs/orchestrator/STATUS.md
```

## Target Task

Verify and tighten the Auth-owned single source of truth for registered user profile data so consuming services can initialize or refresh profile views from Auth, including email, first name, last name, phone, contact info, and Auth-owned source/preference metadata.

## Upstream Traceability

- Original Auth intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Auth contract surface: `docs/UNIFIED_AUTH_CONTRACT.md`
- Verification standard: `docs/UNIFIED_AUTH_VERIFICATION.md`
- Operational environment: `docs/ENV_CORS_AND_AUTH_CHECK.md`
- Readiness checks: `docs/orchestrator/READINESS_GATES.md`
- DocsRAG: queried from the running Auth pod with projected `JWT_TOKEN`; HTTP 200 returned no matching context or sources for the specific Hevrike/Bazos profile query.

## Included Documents

- `AGENTS.md`
- `TASKS.md`
- `STATE.json`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/ENV_CORS_AND_AUTH_CHECK.md`
- `docs/UNIFIED_AUTH_VERIFICATION.md`
- `docs/orchestrator/MASTER_PROMPT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/PROMPTS.md`
- `docs/orchestrator/PROJECT_INVARIANTS.md`
- `docs/orchestrator/PRE_CODING_GATE.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/orchestrator/READINESS_GATES.md`
- `implementation-goals/README.md`

## Included Source

- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth-contract.spec.ts`
- `src/auth/jwt.strategy.ts`
- `src/users/entities/user.entity.ts`
- `src/auth/dto/register.dto.ts`
- `src/auth/dto/contact-register.dto.ts`
- Read-only consumer spot check: `alfares:/home/ssf/Documents/Github/bazos-service/shared/auth/jwt-auth.guard.ts`, `shared/auth/auth.service.ts`, `services/aukro-service/src/ui/ui.controller.ts`, and `prisma/schema.prisma`.

## Excluded Documents And Data

Do not read, print, or record:

- Decoded Vault or Kubernetes secret values.
- JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, internal-service tokens, API keys, passwords, or Authorization header values.
- Raw production user records or production logs containing user data.
- Bazos production DB rows or Bazos platform session/cookie payloads.

## Auth Constraints

- Keep Auth as the identity, credential, hosted login, JWT, refresh token, contact-code, OAuth, magic-link, registered-user preferences, and service authentication authority.
- Do not move Bazos platform account/session/identity ownership into Auth.
- Do not move catalog, warehouse, orders, payment, lead, marketing, notification, logging, database, or gateway ownership into Auth.
- Do not change JWT shape, RBAC semantics, OAuth, magic-link, CORS, internal-service contracts, database schema, or production user data.
- Do not deploy to production without owner approval.

## Allowed Changes

- Make `/auth/profile` explicitly return a fresh sanitized Auth database profile for the authenticated subject.
- Document `/auth/profile` as the canonical post-handoff profile read for consuming applications.
- Add focused contract regression coverage with synthetic user data.
- Update orchestrator status/state evidence.

## Forbidden Changes

- Production DB mutation, user merge, backfill, or raw user-data inspection.
- Consumer service code changes in this Auth session.
- Secrets, decoded tokens, JWT payload changes, refresh-token behavior changes, RBAC assignment changes, OAuth/magic-link behavior changes, or database schema changes.

## Current Task Addendum - 2026-07-02 Hosted Auth Form Fail-Closed Hardening

Target task: owner-reported Catalog hosted Auth loop/blank-submit behavior on `https://auth.alfares.cz/login?return_url=https%3A%2F%2Fcatalog.alfares.cz%2Fauth%2Fcallback&client_id=catalog-microservice&state=...`.

Evidence gathered:

- Clean headless Chrome CDP run from `https://catalog.alfares.cz/login` successfully completed hosted register and hosted login to `https://catalog.alfares.cz/dashboard`; `auth_token` was present and `/api/auth/profile` returned HTTP 200.
- Internal Catalog pod probe confirmed `/api/auth/register` returns `accessToken` and `/api/auth/profile` returns HTTP 200 with nested `user`.
- A premature/native form-submit race reproduced a fail-open fallback: before hosted UI JS was ready, the browser performed a default GET form submit, dropped `return_url/state`, and returned to `/login` with `Redirect target: (required by application)`.

Included source for this task:

- `web/public/index.html`
- `src/auth/hosted-auth-web.spec.ts`

Excluded data:

- No production user rows, decoded JWTs, refresh tokens, OAuth tokens, reset tokens, magic-link tokens, secrets, or passwords are recorded. Browser evidence records token presence only, never token values.

Boundary: Auth hosted login/register UI remains Auth-owned. No Catalog, warehouse, orders, payment, leads, notifications, logging, gateway, database schema, JWT payload, RBAC, OAuth, magic-link, CORS, or internal-service ownership changes.

## Current Task Addendum - 2026-07-02 Auth Customer Data Wallet Planning

Target task: owner-selected cross-repo plan for making Auth the single source of truth for registered-user profile/contact data, delivery address books, and invoice/billing profiles, with consumer checkouts selecting Auth-owned entries and Orders storing immutable snapshots.

Included source:

- Auth `src/auth/auth.controller.ts`
- Auth `src/auth/auth.service.ts`
- Auth `src/auth/dto/update-profile.dto.ts`
- Auth `src/users/entities/user.entity.ts`
- Auth `src/auth/auth-contract.spec.ts`
- FlipFlop `services/frontend/app/checkout/page.tsx`
- FlipFlop `services/frontend/lib/api/auth.ts`
- FlipFlop `services/frontend/lib/api/addresses.ts`
- FlipFlop `services/user-service/src/users/users.service.ts`
- FlipFlop `prisma/schema.prisma`
- Orders `src/orders/create-order.dto.ts`
- Orders `src/orders/order.entity.ts`
- Orders `docs/orchestrator/CHANNEL_ORDER_CREATE_CONTRACT.md`

Included read-only subagent evidence:

- Auth data-wallet readiness scan.
- FlipFlop checkout/profile integration scan.
- Non-FlipFlop commerce consumer scan.

Excluded data:

- No production user rows, order rows, customer addresses, invoice rows, decoded JWTs, secrets, token values, passwords, raw logs with customer data, or DB writes.

Boundary:

- Auth owns reusable registered-user profile, address book, invoice profile, hosted identity, tokens, RBAC, and preferences.
- Orders owns order snapshots and lifecycle.
- Payments owns provider/payment state.
- Consumer storefronts own UX and guest checkout orchestration, not reusable profile truth.
- Catalog, Warehouse, Leads, Marketing, Notifications, Logging, database infrastructure, and gateways remain out of Auth ownership.

## Current Task Addendum - 2026-07-02 Auth Customer Data Wallet A1 Source Implementation

Target task: implement the Auth-owned delivery address book, invoice profile
storage model, authenticated CRUD/default-selection endpoints, and checkout
aggregate read after resolving the production schema path as source-only
idempotent SQL for `DB_SYNC=false`.

Included source:

- `scripts/create-customer-data-wallet-tables.sql`
- `src/users/entities/user-delivery-address.entity.ts`
- `src/users/entities/user-invoice-profile.entity.ts`
- `src/auth/dto/delivery-address.dto.ts`
- `src/auth/dto/invoice-profile.dto.ts`
- `src/users/users.module.ts`
- `src/users/users.service.ts`
- `shared/database/database.module.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth-contract.spec.ts`
- `src/info/info.controller.ts`

Included subagent evidence:

- Auth schema/deploy-path explorer confirmed `DB_SYNC=false`, no formal
  TypeORM migration runner, deploy script does not run migrations, and the
  existing safe precedent is idempotent checked-in SQL.
- Consumer readiness monitor confirmed FlipFlop is the first clean
  dependency-gated consumer candidate; Orders is blocked by unrelated dirty
  event/order changes; other consumer lanes remain dependency-gated.

Excluded data:

- No live SQL was applied.
- No production user rows, customer addresses, invoices, decoded JWTs, secrets,
  token values, passwords, or raw logs with customer data were read or recorded.

Boundary:

- Auth owns reusable registered-user profile, delivery address book, and invoice
  profile data.
- Orders and consumer services keep only order-specific snapshots and UX/guest
  checkout orchestration.
- Live DB migration apply and deployment require separate owner approval.

## Current Task Addendum - 2026-07-02 Goal 10.9 And 10.10 Consumer Planning

Target task: create repo-local, dependency-gated plans for Rent-a-box hosted
Auth/profile migration and ChytraKoupe Auth wallet checkout selectors without
changing consumer runtime code.

Included read-only source evidence:

- Rent-a-box local auth/profile/token findings from `apps/api/app/api/auth.py`,
  `apps/api/app/auth/security.py`, `apps/api/app/models/domain.py`,
  `apps/api/app/services/auth.py`, `apps/api/app/services/post_rental.py`,
  `apps/web/src/components/customer/AuthForm.tsx`, and session helpers.
- ChytraKoupe hosted Auth and checkout findings from `lib/config/env.ts`,
  `lib/auth/session.ts`, `app/auth/callback/AuthCallbackClient.tsx`,
  `app/login/page.tsx`, `components/checkout/CheckoutClient.tsx`, and
  `db/schema.ts`.

Included documents:

- `rent-a-box` commit `fcfeb48`, file `docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`
- `chytrakoupe` commit `a1dabca`, file `implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`

Excluded data:

- No production DB rows, customer records, address records, invoice records,
  password hashes, decoded JWTs, token values, cookies, secrets, contract
  storage contents, or live checkout payloads.

Boundary:

- Auth remains reusable registered-user identity/profile/address/invoice owner.
- Rent-a-box remains owner of storage-box domain, reservations, rentals,
  contracts, mock payments, PIN/access-code state, and immutable snapshots.
- ChytraKoupe remains owner of checkout UX, guest checkout, and snapshot
  submission, not reusable profile truth.


## Current Task Addendum - 2026-07-02 Auth Customer Data Wallet Pre-Approval Fixes

Target task: address deployment-review findings before requesting approval for
live SQL apply and Auth deploy.

Included source:

- `src/auth/auth.controller.ts`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-live-gate.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`

Included evidence:

- Read-only Auth deploy reviewer found missing UUID path-param validation,
  stale Goal 10 state in `docs/orchestrator/GOALS.md`, and a required
  `gen_random_uuid` preflight gate.
- Read-only FlipFlop reviewer found staged checkout changes owned by another
  session, so consumer UI wiring remains gated.
- Runtime read-only checks found current Auth production runtime unhealthy on
  old image `0d4282b-20260702102426`, with cluster-wide slow image pull and
  container creation backlog. No Goal 10 deploy was run.

Excluded data:

- No live SQL, deploy, customer row reads, secret values, token values, decoded
  JWTs, or consumer source edits.

## Current Task Addendum - 2026-07-02 Goal 10.11 Validation And Deployment Plan

Target task: create the approval-gated cross-repo validation and deployment
plan for Auth customer data wallet rollout without executing live SQL, deploys,
rollback mutation, production DB access, consumer code edits, or live checkout
smoke.

Included source and documents:

- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- Read-only subagent evidence for Auth live gate and consumer validation matrix.

Included read-only runtime evidence:

- Auth source HEAD `54743ed`, SQL checksum
  `0a9b984ac0641d20b0a345c80b372fef43942364ecb2fe5d5a8ab9155ca0e081`,
  and deploy script checksum
  `6f182a01d428bb7631af0ca4c780a5e11691264cbcede43e60c8e4eb81d8078d`.
- Live Auth backend/web `1/1` on old image `0d4282b-20260702102426`.
- Public `/health` HTTP 200.
- Wallet endpoints still HTTP 404 unauthenticated, confirming Goal 10 source is
  not deployed and SQL is not applied.

Excluded data:

- DB connection values, Vault/Kubernetes secret values, JWTs, refresh tokens,
  OAuth tokens, magic-link tokens, reset tokens, passwords, raw production user
  records, customer rows, address rows, invoice rows, password hashes, and live
  checkout payloads.

Boundary:

- This chunk is documentation/status only. Auth SQL preflight, SQL apply,
  deploy, rollback mutation, synthetic authenticated smoke, FlipFlop runtime
  smoke, Orders provenance changes, and Rent-a-box/ChytraKoupe code lanes remain
  separately approval-gated.

## Current Task Addendum - 2026-07-02 Auth Hosted Profile Wallet UI

Target task: implement source-only hosted `/profile` management for Auth-owned
canonical profile, delivery address book, and invoice profiles after A1 wallet
API source implementation.

Included source and documents:

- `web/public/profile.html`
- `web/public/js/profile.js`
- `web/public/css/style.css`
- `src/auth/hosted-auth-web.spec.ts`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/IMPLEMENTATION_STATE.md`

Included evidence:

- Hosted web route `/profile` is served by `web/server.js` from
  `web/public/profile.html`.
- Existing backend wallet endpoints are under `/auth/profile`,
  `/auth/profile/checkout-data`, `/auth/profile/delivery-addresses`, and
  `/auth/profile/invoice-profiles`.
- Existing client pattern uses same-origin fetch, bearer auth, and
  `sessionStorage`; hosted profile code preserves that pattern and clears
  token-bearing snake-case or camel-case hash fragments from browser history
  even when a handoff is malformed or empty.
- Direct hosted `/profile` password login uses the central Auth
  `{ identifier, password }` contract instead of an email-only payload.
- Validation passed for hosted web contract, Auth wallet contract suite, build,
  lint, JS syntax, diff-check, and targeted dangerous literal-secret scan.

Excluded data:

- No production DB access, live customer row/address/invoice inspection, live
  checkout payload inspection, secret/token/password/JWT value inspection,
  deploy, SQL apply, Kubernetes mutation, or consumer repo edit.

Boundary:

- Auth hosted profile UI may edit reusable Auth-owned registered-user profile,
  delivery address, and invoice profile records after the API is deployed.
- Storefront checkout UIs and Orders snapshot semantics remain separately
  owned and dependency-gated.

## Current Task Addendum - 2026-07-02 Auth Wallet Runtime Gate Verifier

Target task: add a source-only public runtime verifier for the Goal 10
post-deploy wallet endpoint 401 smoke gate.

Included source and documents:

- `scripts/check-customer-data-wallet-preflight.js`
- `scripts/check-customer-data-wallet-runtime-smoke.js`
- `package.json`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-live-gate.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/IMPLEMENTATION_STATE.md`

Included evidence:

- Existing preflight helper validates SQL shape only; it does not verify public
  wallet route availability.
- Existing runbooks expected wallet routes to return HTTP 401 unauthenticated
  after deploy and current live evidence shows HTTP 404 before deploy.
- Read-only runtime verifier subagent confirmed a standalone status-only
  verifier is the missing artifact and that public unauthenticated GET probes
  are low data risk when bodies, headers, tokens, and cookies are omitted.

Excluded data:

- No live SQL, deploy, DB connection values, secret values, token values,
  decoded JWTs, cookies, response bodies, production customer rows, address
  rows, invoice rows, or authenticated smoke data.

Boundary:

- The verifier proves public route availability and guard behavior only. It
  does not prove DB schema correctness, authenticated CRUD, consumer checkout
  behavior, Orders snapshot semantics, or migration/backfill safety.
