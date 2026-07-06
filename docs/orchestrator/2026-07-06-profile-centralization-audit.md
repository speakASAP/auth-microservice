# 2026-07-06 Profile Centralization Audit

## Intent Preservation Chain

- Vision: Auth remains the Statex ecosystem source of truth for registered-user identity, credentials, profile/contact data, profile image metadata, user-visible profile settings, delivery address books, and invoice profiles.
- Goal Impact: a registered user can edit reusable profile data through Auth-owned APIs/surfaces and see the same data reflected in consumer applications that read Auth profile data.
- System: Auth owns user identity, password change/reset/set, canonical profile read/update, delivery address CRUD, invoice profile CRUD, registered-user communication preferences, and service-authentication boundaries. Consumer applications may render profile editors/selectors, but reusable account/profile writes must flow back to Auth.
- Feature: central profile audit and source-side remediation for profile image/settings plus verified email change.
- Task: inspect Auth profile capabilities, add explicit Auth-owned `avatarUrl` and `settings` support to `PATCH /auth/profile`, expose sanitized profile image/settings aliases from `GET /auth/profile`, add verified one-time email-change request/confirm endpoints, wire hosted `/profile`, and record remaining runtime gates.
- Execution Plan: remote-only edits in `auth-microservice`; no database schema migration; no JWT shape change; no consumer repo mutation; no production deploy without owner deploy gate.
- Coding Prompt: keep Auth boundaries, avoid secrets/user data, validate source contract and build, document blockers as `[MISSING: ...]`.
- Code: changed Auth DTO/entity/service/controller/tests, hosted profile assets, static checker markers, source SQL migration script, unified contract docs, and orchestrator status.
- Validation: `npm run test:auth-contract`, `npm run build`, `git diff --check`, and hosted profile script syntax checks passed remotely on `alfares`.

## Audit Blocks

1. Auth backend canonical profile API
   - Status: partial before this session; remediated for avatar/settings.
   - Evidence: `GET /auth/profile`, `PATCH /auth/profile`, delivery-address CRUD, invoice-profile CRUD, password change/set/reset existed before this session.
   - Gap addressed: no first-class avatar/profile-image field and no user-facing settings field in the self-service profile DTO/UI.

2. Hosted Auth profile surface
   - Status: partial before this session; source-remediated.
   - Evidence: hosted `/profile` already loaded `/auth/profile` and `/auth/profile/checkout-data`, then wrote profile fields through `PATCH /auth/profile`.
   - Gap addressed: hosted `/profile` now includes profile image URL and profile settings JSON fields.

3. Email change
   - Status: source-prepared with verified one-time token flow; production DB apply/deploy remains gated.
   - Policy: authenticated request, new-email uniqueness check, current-password proof for password accounts, one-time token sent to the new email, confirm updates Auth `users.email` and primary email contact, existing JWT email claims refresh on re-login/refresh.
   - Boundary: `PATCH /auth/profile` still does not mutate email; no production DB apply or deploy occurred.

4. Consumer applications
   - Status: audited and parallel source lanes executed where safe.
   - Boundary: no consumer repo was edited in this Auth source-side remediation.

## Parallel Execution

| Workstream | Status | Owner | Scope | Validation/Handoff |
| --- | --- | --- | --- | --- |
| Auth API/UI remediation | ready now, executed | orchestrator | `auth-microservice` DTO/service/tests/web/docs | `npm run test:auth-contract`; `npm run build`; `git diff --check` |
| Auth backend audit | complete | subagent | read-only Auth API/DTO/entity/docs inspection | confirmed avatar/settings/email-change gaps and existing core profile/wallet/password support |
| Consumer integration audit | complete | subagent | read-only scan of consumer repos | repo-by-repo centralization matrix recorded below |
| Email-change source implementation | dependency-gated | orchestrator | Auth token/entity/API/UI/tests/docs | source validated; runtime activation requires SQL apply/deploy gate |
| Email-change runtime activation gate | dependency-gated | orchestrator | root TypeORM entity registration, source verifier, guarded smoke harness, runtime gate docs | source preflight passes; SQL apply/deploy/live smoke remain gated |
| Production deploy/live static smoke | dependency-gated | owner/deploy gate | `./scripts/deploy.sh`, then hosted `/profile` live static smoke | requires deploy approval per repo workflow |

## Current Verdict

Auth now has source-level first-class support for central profile image metadata, user-visible profile settings, and verified email-change source/runtime-gate preparation through Auth-owned APIs, without moving ownership to consumers. The broader ecosystem guarantee still depends on consumer apps reading/writing Auth profile APIs and on approved runtime activation of the Auth email-change table/deploy/smoke gate.

## Consumer Audit Matrix

| Repo | Verdict | Evidence Summary | Gap |
| --- | --- | --- | --- |
| `auth-microservice` | centralized/proven | Hosted `/profile` reads `/auth/profile` and `/auth/profile/checkout-data`; writes canonical profile, delivery addresses, invoice profiles. | Source-remediated avatar/settings in this checkpoint; live deploy pending. |
| `marathon` | partial | Hosted Auth login/register exists; app profile still reads/writes local Marathon API and `MarathonUserProfile`. | Reusable profile/settings are still Marathon-local until lane A completes or bounds them as domain-only. |
| `runlayer` | partial | Admin uses hosted Auth and links users to `https://auth.alfares.cz/profile`. | No native profile read/write integration; link-only behavior may be acceptable if product has no local profile editor. |
| `marketing-microservice` | centralized/proven for preferences | Registered-user preferences flow through Auth-owned APIs; non-registered leads remain Leads-owned. | No user profile screen found. |
| `payments-microservice` | partial/missing profile | Hosted Auth config and token validation exist. | Admin/settings UI has no Auth `/profile`/wallet read-write integration. |
| `catalog-microservice` | partial | Backend/frontend proxy Auth profile read. | Profile/wallet writes not found. |
| `aukro` | partial | Hosted login/register URLs and Auth service URL exist. | No Auth `/profile`, checkout-data, delivery-address, or invoice-profile integration found. |
| `flipflop` | partial/proven | Auth profile read/write and wallet APIs exist. | Local user/profile/address snapshots and fallback behavior remain dependency-gated for reduction. |
| `orders-microservice` | partial/acceptable boundary | Auth validation and docs preserve invoice/profile truth in Auth. | No profile screen; Orders should keep immutable snapshots only. |
| `cliplot` | partial/proven read surface | Hosted Auth URLs and guarded Auth wallet reads exist. | No profile/wallet write surface found; lane G decides whether one is needed. |
| `rent-a-box` | blocked | Hosted Auth helper and adapter contract exist. | Product-code migration/backfill still blocked on owner-approved migration plan. |
| `chytrakoupe` | centralized/proven | Auth profile validation/cache and checkout wallet read exist; docs say no local profile/address table. | Browser cache only; no local persistent profile store found. |

## Spawned Follow-Up Workers

| Lane | Repo | Status | Write Ownership | Stop Conditions |
| --- | --- | --- | --- | --- |
| A | `marathon` | complete | Marathon profile API/client/tests/docs only | DB backfill, destructive schema/data removal, Auth repo edits |
| B | `payments-microservice` | complete | Payments admin/profile UI/auth docs/checkers only | provider/bank/live money mutation, DB writes, deploy |
| D | `aukro` | complete | Aukro UI/shared Auth/profile docs/tests only | buyer identity inference from email, order/payment mutation, DB writes |
| G | `cliplot` | complete | Cliplot integrations/profile/checkout wallet docs/tests only | live checkout/order/payment mutation, DB writes, deploy |


## Worker Results

| Lane | Repo | Outcome | Validation | Remaining Gate |
| --- | --- | --- | --- | --- |
| A | `marathon` | Source-changed profile flow so Auth-provided `email`/`phone` are read-only and Marathon writes stay bounded to local `displayName`, `avatarUrl`, and `bio`. | `git diff --check`; `npm run build`; `npm run build:frontend`; live `check:journey` failed on pre-existing/deployed `/api/v1/marathons/analytics` HTTP 500. | `[MISSING: approved migration plan]`; `[MISSING: confirmed Auth /auth/profile runtime adoption by Marathon beyond token validation payload]`; deploy blocked by live analytics validation debt. |
| B | `payments-microservice` | Added safe `GET /auth/profile` wrapper validating bearer token through Auth and returning sanitized admin profile state; UI displays linked Auth profile state and sign-out. | `npm run check:hosted-auth`; `npm run build`. | `[MISSING: owner-approved admin test session packet]` for authenticated UI smoke. |
| D | `aukro` | Added Auth-hosted `profile`, `wallet`, and `settings` links to dashboard/account surfaces without inventing a read bridge. | `git diff --check`; pre-coding gate; targeted UI spec; service tests; build; strict doc audit; deployment readiness gate. | `[MISSING: documented Auth profile/wallet read endpoint contract]` for any future read bridge. |
| G | `cliplot` | Kept Cliplot read-only for checkout wallet scope and added verifier coverage to fail on future Auth wallet/profile write HTTP verbs or wallet save UI hooks. | `npm run readiness:auth-wallet-checkout`; node syntax checks; browser-session smoke; `npm run check`; `git diff --check`; changed-file secret scan. | `[MISSING: owner-approved Auth-owned delivery/invoice/profile mutation contract for Cliplot write surfaces]`. |

## Integration Notes

- No worker deployed.
- No worker ran DB writes, live checkout/order/payment mutations, provider/bank mutations, or Auth repo edits.
- Commit/stage must stay per repo and per lane because multiple repos contain pre-existing or parallel unrelated untracked/modified files.
- Auth source remediation and email-change activation preflight are ready for one Auth repo commit after final validation.
- Subagent activation audit found `EmailChangeToken` missing from root TypeORM entities; this checkpoint fixes that registration and adds `npm run check:auth-email-change-activation-source` to keep it covered.
