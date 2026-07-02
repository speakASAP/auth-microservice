# Auth Wallet Marketplace And Channel Audit

Status: read-only coordinator audit
Created: 2026-07-02
Owner: Auth Goal 10 coordinator

## Intent Chain

- Vision: Auth remains the single editable source of truth for registered-user
  profile, delivery address book, and invoice profile data.
- Goal impact: consumer checkouts use Auth-owned wallet entries only where a
  real registered-user checkout/account surface exists.
- System: storefronts and account apps may consume Auth wallet data; marketplace
  connectors preserve external buyer/order evidence as channel snapshots and
  forward immutable order facts to Orders.
- Feature: Goal 10 consumer boundary audit for marketplace/channel repositories.
- Task: decide whether Catalog, Allegro, Aukro, Bazos, Heureka, and
  Shop Assistant require repo-local Auth wallet plans now.
- Execution plan: read-only repository inspection through `ssh alfares`; no
  edits, deploys, runtime calls, DB access, secret reads, or customer-data
  inspection.
- Coding prompt: do not back-write marketplace buyer data into Auth; mark
  unavailable facts as `[MISSING: ...]` or `[UNKNOWN: ...]`.
- Code: none.
- Validation: read-only repo status/head checks and bounded source/doc
  inspection.

## Result

No repo-local Auth wallet plan is required now for the inspected marketplace and
channel repositories. The negative boundary is intentional:

- Marketplace buyer/contact/order data is external channel evidence, not
  reusable Statex registered-user wallet truth.
- Channel connectors may forward immutable order snapshots to Orders.
- Channel connectors must not create or update Auth delivery address books,
  invoice profiles, or registered-user personal profiles from marketplace buyer
  payloads.

## Repository Matrix

| Repository | State | Decision | Evidence |
| --- | --- | --- | --- |
| `catalog-microservice` | clean `main` at `311030d` | No repo-local wallet plan now | Catalog is product truth only; docs keep FlipFlop as storefront/cart/checkout owner and forbid Catalog checkout/payment/customer-data ownership. |
| `allegro` | clean `main` at `6c64a30` | No wallet plan now; keep negative boundary documented | Allegro checkout-form/order snapshot ingestion contains buyer/email/address/invoice flags and raw-payload policy. Treat this as channel evidence and Orders projection, not registered-user Auth wallet source. |
| `aukro` | clean `main` at `ba61422` | No wallet plan now | Hosted/Auth-backed cabinet and Orders read/status surfaces exist, but no wallet address/invoice/checkout profile editor was found. Aukro orders are transit records forwarded to Orders. |
| `bazos` | clean `main` at `cdcd739` | No wallet plan now | `/client` seller/customer dashboard and bounded synthetic/internal order forwarding exist. Local order model stores channel contact fields only, not reusable checkout/address/invoice wallet data. |
| `heureka` | clean `main` at `976a1a8` | No wallet plan now | Feed/dashboard plus internal order ingestion. Accepted channel order facts are forwarded to Orders; public feed is read-only and not a checkout/cart surface. |
| `shop-assistant` | clean `main` at `4ed76b1` | No checkout-wallet plan now | Auth-backed profiles, criteria, sessions, choices, and dashboard history are search/preference data, not checkout/address/invoice wallet data. |

## Blockers And Unknowns

- `[MISSING: live Auth wallet endpoint contract and deployed non-404 evidence]`
- `[UNKNOWN: whether Allegro checkout-form rawData retention/deletion policy fully matches Goal 10 privacy expectations]`
- `[UNKNOWN: live Bazos marketplace webhook support]`
- `[MISSING: provider-backed Bazos customer/admin order UI requirements beyond bounded synthetic/internal read model]`
- `[MISSING: Orders lifecycle read authorization confirmation for aukro-service role]`

## Follow-Up

Keep M1 as Auth coordinator documentation only. Do not open repo-local wallet
plans for these repositories unless a future source change introduces a real
registered-user checkout/profile/address/invoice editor.

The only likely later channel follow-up is an Allegro retention/no-backwrite
hardening review after the Auth wallet contract is live and approved.

## Validation Evidence

Read-only commands and inspections were used:

```bash
ssh alfares 'find /home/ssf/Documents/Github ...'
ssh alfares 'cd /home/ssf/Documents/Github/<repo> && git status --short --branch && git log -1 --oneline'
```

Bounded source/doc inspection used `rg`, `find`, `nl -ba`, and `sed -n`.

No edits, staging, commits, deploys, database/runtime mutations, environment
dumps, secret reads, logs, or customer rows were performed in the audited
marketplace/channel repositories.
