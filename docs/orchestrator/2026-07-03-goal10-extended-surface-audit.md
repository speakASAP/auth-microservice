# Goal 10 Extended Registered-User Surface Audit

Status: read-only coordinator and subagent audit
Created: 2026-07-03
Owner: Auth Goal 10 coordinator

## Intent Chain

- Vision: Auth remains the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: every real registered-user checkout/address/invoice editor is
  either integrated with Auth wallet or explicitly gated before integration.
- System: Auth owns wallet truth; consumer apps may use wallet reads/selectors
  and may store immutable domain/order snapshots only.
- Feature: extended ecosystem surface audit after the known Goal 10 consumer
  lanes became approval-gated.
- Task: search for unaccounted registered-user checkout/profile/address/invoice
  editors outside FlipFlop, ChytraKoupe, Rent-a-box, and Cliplot.
- Execution plan: read-only remote source/doc inspection using `ssh alfares`,
  `git status`, `git log`, `rg`, and targeted file reads; no runtime calls,
  deploys, DB reads/writes, env dumps, secret reads, token inspection, or
  customer-data inspection.
- Coding prompt: do not back-write marketplace, lead, billing-provider, or
  operational profile data into Auth wallet; mark unknowns instead of inventing
  integrations.
- Code: none in consumer repos; Auth coordinator documentation only.
- Validation: Auth coordinator packet checker plus `git diff --check` and
  changed-file sensitive literal scan.

## Summary

No new immediate registered-user checkout/address/invoice wallet implementation
lane was found outside the known Goal 10 consumers.

The two source-only follow-up clarifications are now closed in
`docs/orchestrator/2026-07-03-goal10-shop-assistant-invoices-clarification.md`:

- `shop-assistant` is a negative boundary for current source. Billing checkout,
  entitlement state, search-recipient profiles, and saved criteria do not store
  reusable delivery address or invoice profile wallet data.
- `invoices-microservice` is a bounded wallet-adjacent consumer. It Auth-scopes
  customer account invoice reads/download-link rotation and renders immutable
  Orders snapshots, but must not own invoice profile editing or reusable
  address/company/tax/VAT storage.

## Matrix

| Repository | State | Verdict | Evidence | Follow-up |
| --- | --- | --- | --- | --- |
| `statex` | clean `main...origin/main` at `2a76817` | No checkout/address/invoice wallet lane now | Hosted Auth login/register via `statex-website/frontend/src/lib/hostedAuth.ts`, redirect pages, callback page, local contact/submission dashboard, and user-portal contact registration were inspected. | Dependency-gated only if Auth wallet scope expands from checkout wallet data to StateX contact/profile read models. |
| `runlayer` | clean `main...origin/main` at `0417e40` | No wallet lane now | Hosted Auth login/register in `public/app.js`; profile link opens hosted Auth `/profile`; RunLayer owns orchestration projects/goals, not checkout/address/invoice wallet data. | None. |
| `allegro` | `main...origin/main`, dirty `docs/orchestrator/STATUS.md` | Negative boundary | Marketplace buyer/order data remains channel evidence and order snapshots, not reusable Auth wallet truth. | No wallet lane now; keep dirty worktree untouched. |
| `aukro` | clean `main...origin/main` | Negative boundary | Channel/product/account publishing dashboard evidence; no wallet address/invoice editor found. | None. |
| `bazos` | clean `main...origin/main` | Negative boundary | Marketplace/order replay evidence excludes reusable customer/address profile truth. | None. |
| `heureka` | clean `main...origin/main` | Negative boundary | Channel dashboard/order ingestion only. | None. |
| `shop-assistant` | clean `main...origin/main` at `82134a9` | Negative boundary | Billing checkout/entitlement state and account profiles were audited; no delivery address, invoice profile, company/tax/VAT, legal recipient, or reusable wallet storage found. | None unless a future Auth contract forbids token-derived payment customer payload fields. |
| `catalog-microservice` | clean `main...origin/main` | Negative boundary | Catalog owns products and user catalog settings, not checkout/profile wallet. | None. |
| `leads-microservice` | clean `main...origin/main` | Negative boundary | Leads owns non-registered contact/lead records. | None. |
| `marketing-microservice` | clean `main...origin/main` | Negative boundary | Marketing consumes signals/consent contracts, not editable wallet data. | None. |
| `payments-microservice` | clean `main...origin/main` | Negative boundary | Provider/payment/Stripe Connect fields only. | None. |
| `invoices-microservice` | clean `main...origin/main` at `1990618` | Bounded wallet-adjacent consumer | Auth-guarded account invoice access scopes by Auth subject/id with email fallback; invoice rendering consumes immutable Orders billing snapshots; no profile editor route found. | Keep invoice-profile editing in Auth; runtime proof remains on Orders/storefront snapshot gates. |
| `suppliers-microservice` | clean `main...origin/main` | Negative boundary | Supplier/stock import ownership. | None. |
| `marathon` | clean `main...origin/main` | Already documented Goal 10-adjacent; no new wallet lane | Auth client/register-contact context exists; no address/invoice editor found. | None from this audit. |
| `speakasap-portal` | clean `main...origin/main` | Negative boundary / legacy | Legacy student/teacher/admin profile and invoice-like app-local fields inspected. | No Auth wallet lane from this audit; legacy production mutation remains separately governed. |

## Boundaries

- Marketplace buyer/contact/order payloads must not be used to create or update
  Auth delivery addresses, invoice profiles, or registered-user profile truth.
- Lead/contact/submission records are not checkout wallet data unless a future
  approved contract says otherwise.
- Payment provider, Stripe Connect, entitlement, project, supplier, and catalog
  settings are not Auth customer wallet data.
- StateX and RunLayer may use hosted Auth login/profile links without becoming
  Auth wallet consumers.

## Remaining Unknowns

- `[UNKNOWN: future registered-user checkout/address/invoice editors introduced after this audit]`

## Validation Evidence

Read-only commands and inspections included:

```bash
ssh alfares 'find /home/ssf/Documents/Github -maxdepth 1 -mindepth 1 -type d -printf "%f\n" | sort'
ssh alfares 'cd /home/ssf/Documents/Github/statex && git status --short --branch && git log -1 --oneline'
ssh alfares 'cd /home/ssf/Documents/Github/runlayer && git status --short --branch && git log -1 --oneline'
ssh alfares 'cd /home/ssf/Documents/Github/<repo> && rg -n -i "checkout|billing|invoice|address|wallet|profile" ...'
```

Subagents performed independent read-only audits for StateX/RunLayer, for
marketplace/channel/dashboard repositories, and for the follow-up
Shop Assistant/Invoicing clarifications recorded in
`docs/orchestrator/2026-07-03-goal10-shop-assistant-invoices-clarification.md`.

No consumer repo files were edited. No runtime calls, live checkout/order
mutation, DB reads/writes, env dumps, secret reads, token inspection, deploys,
or customer-data output were performed. One broad marketplace scan encountered
a legacy credential file in `speakasap-portal`; its contents were not used or
recorded and are excluded from this evidence.
