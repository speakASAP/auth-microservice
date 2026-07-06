# 2026-07-06 Profile Centralization Owner-Approved Execution Packet

Status: source-only packet prepared; execution remains blocked until all listed owner inputs are present.

## Intent Preservation Chain

- Vision: Auth remains the Statex ecosystem source of truth for registered-user identity, profile, wallet, and reusable account data.
- Goal Impact: remaining consumer evidence can be collected without ambiguous authority, secret leakage, or accidental live mutation.
- System: Marathon Auth reconciliation and Cliplot Auth wallet/profile browser-session read evidence.
- Feature: owner-approved execution packets for the two remaining profile-centralization gates.
- Task: preserve exact command templates, required inputs, forbidden outputs/actions, stop conditions, and validation evidence.
- Execution Plan: source-only Auth documentation and checker update; no live DB write, no session smoke, no deploy.
- Coding Prompt: fail closed, preserve `[MISSING: ...]`, do not invent approvals, tokens, fixtures, mapping policies, rollback details, or runtime infrastructure.
- Code: this packet, `scripts/check-profile-centralization-owner-approved-execution-packet.js`, package script, status/current-state docs.
- Validation: `npm run check:profile-centralization-owner-approved-execution-packet`; `npm run check:profile-centralization-current-state -- --no-write-report`; `git diff --check`.

## Gate A - Marathon Reconciliation Apply And Migrated-User Smoke

Current repo evidence:

- Remote repo: `/home/ssf/Documents/Github/marathon`.
- Current observed head after worker refresh: `4977534 (HEAD -> main, origin/main) fix: optimize marathon reconciliation apply phase`.
- Worktree: clean at final worker check.
- Source/static and dry-run packet inspection was read-only.
- No DB write, apply run, secret/env read, raw user output, token output, email output, phone output, or raw customer-data output occurred.

### Read-Only Preflight Commands

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && git status --short --branch && git log -1 --oneline --decorate'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && git diff --check'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node --check scripts/dry-run-marathon-auth-reconciliation.js'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node --check scripts/apply-marathon-auth-reconciliation.js'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && python3 -m py_compile scripts/check-marathon-hosted-auth-contract.py'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && python3 scripts/check-marathon-hosted-auth-contract.py --json-report -'
```

### Read-Only Plan/Dry-Run Commands

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node scripts/dry-run-marathon-auth-reconciliation.js --plan-only'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node scripts/dry-run-marathon-auth-reconciliation.js'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node scripts/apply-marathon-auth-reconciliation.js --plan-only'
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node scripts/apply-marathon-auth-reconciliation.js'
```

### Approval-Gated Apply Template

Do not run until every required owner input below is present.

Phase 1, Auth role/marker assignment batch:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && \
  MARATHON_AUTH_RECONCILIATION_APPLY=OWNER_APPROVED_MARATHON_AUTH_RECONCILIATION_2026_07_06 \
  MARATHON_AUTH_RECONCILIATION_TICKET=<ticket-change-id> \
  node scripts/apply-marathon-auth-reconciliation.js --apply --phase=auth --limit=<positive-integer>'
```

Phase 2, Marathon participant/user reference batch, only after Phase 1 validation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && \
  MARATHON_AUTH_RECONCILIATION_APPLY=OWNER_APPROVED_MARATHON_AUTH_RECONCILIATION_2026_07_06 \
  MARATHON_AUTH_RECONCILIATION_TICKET=<ticket-change-id> \
  node scripts/apply-marathon-auth-reconciliation.js --apply --phase=marathon --limit=<positive-integer>'
```

`--phase=both` exists in the consumer helper, but this packet keeps the first execution phased because there is no cross-DB transaction.

### Post-Batch Aggregate Validation

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && node scripts/apply-marathon-auth-reconciliation.js'
```

Expected aggregate-only evidence:

- Auth `missingRoleAssignmentsBefore` decreases by the batch target count after the Auth phase.
- Auth `missingMarkersBefore` decreases by the batch target count after the Auth phase.
- Marathon numeric participant/user rows decrease by mapped participant rows after the Marathon phase.
- UUID-like rows, non-user data, and unmapped rows remain untouched.
- Output must stay aggregate-only.

Recovery policy:

- Forward-fix is the allowed recovery model for this packet.
- Direct rollback requires a separate owner-approved rollback packet.
- Exact target IDs must not be printed in chat, docs, or reports.

### Migrated-User Smoke Template

There is no dedicated migrated-user smoke script in Marathon. The smoke uses the existing journey checker with an approved known migrated completed-user fixture.

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && \
  MARATHON_SMOKE_AUTH_TOKEN=<approved-known-migrated-user-jwt> \
  npm run check:journey -- --base-url https://marathon.alfares.cz --auth-token <approved-known-migrated-user-jwt> --json'
```

Optional saved-submission proof, only with owner-approved synthetic or approved fixture identifiers:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/marathon && \
  npm run check:journey -- --base-url https://marathon.alfares.cz \
  --auth-token <approved-known-migrated-user-jwt> \
  --marathoner-id <approved-marathoner-id> \
  --step-id <approved-step-id> \
  --json'
```

### Required Owner Inputs

- Exact production mutation approval phrase: `OWNER_APPROVED_MARATHON_AUTH_RECONCILIATION_2026_07_06`.
- Ticket/change id: proposed non-secret id `MAR-AUTH-RECON-2026-07-06`.
- Batch limit: `25` for the first bounded run.
- Phase order: `auth` first, then `marathon` after aggregate validation.
- Known migrated completed user/test account token for post-apply smoke.
- Approved `marathoner-id` and `step-id` only if saved-submission smoke is required.
- Proposed policy for the one numeric legacy id without Auth mapping: do not synthesize a mapping and do not rewrite it; leave it quarantined/unmigrated until an Auth-owned identity source proves the mapping, then handle through a targeted owner-approved forward-fix.
- Proposed policy for 348 UUID-like Marathon user ids missing in Auth: do not rewrite, delete, or role-mark automatically; treat them as orphaned imported Auth references and resolve only through Auth-owned restore/provisioning or a targeted correction packet with sanitized aggregate evidence.
- Current apply candidate confirmed by source/dry-run workers: `4977534`.

### Forbidden Outputs And Actions

- Do not print raw user IDs, emails, phones, names, JWTs, cookies, DSNs, `.env` values, DB rows, raw Auth responses, or raw customer data.
- Do not run direct DB rollback.
- Do not perform direct Auth DB correction outside the repo-owned helper.
- Do not strip roles.
- Do not rewrite UUID-like Marathon rows.
- Do not mutate non-participant data.
- Do not deploy unless a separate deploy approval exists.

### Execution Readiness

Blocked for production execution. The helper and command templates are present and fail closed, and the ticket id, first batch limit, phase order, apply candidate head, and conservative mapping policies are now proposed. Live apply still needs explicit production mutation approval for these exact values and a migrated completed-user smoke fixture path/token source that does not expose token or customer data.

## Gate B - Cliplot Synthetic Browser-Session Wallet/Profile Read

Current repo evidence:

- Remote repo: `/home/ssf/Documents/Github/cliplot`.
- Current observed head after file-based bearer source hardening: `25f90e0 (HEAD -> main, origin/main) fix: support file-based auth wallet smoke bearer`.
- Worktree: clean at final worker check.
- Read-only validators passed.
- Default browser-session smoke remained blocked with `liveExecutionAllowed=false`, `authWalletFetch=false`, and `browserSessionRead=false`.

### Read-Only Readiness Commands

```bash
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:auth-wallet-runtime-checkout-evidence'
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:auth-wallet-browser-session-smoke'
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:auth-wallet-checkout'
```

Expected read-only evidence:

- `authWalletFetch=false`.
- `checkoutSubmit=false`.
- `mutation=false`.
- `persistence=false`.
- `providerCall=false`.
- `writeHttpReferenceCount=0`.
- `saveUiReferenceCount=0`.
- `walletWriteDecision=read_only_checkout_scope_selected`.

### Approval-Gated Browser-Session Wallet/Profile Fetch Template

Do not run until every required owner input below is present.

```bash
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && \
  ENABLE_AUTH_WALLET_BROWSER_SESSION_SMOKE=true \
  CLIPLOT_AUTH_WALLET_SMOKE_APPROVAL_ID=CLIPLOT-AUTH-WALLET-SMOKE-<ID> \
  AUTH_WALLET_SYNTHETIC_BEARER_FILE=<0600-approved-token-file> \
  npm run smoke:auth-wallet-browser-session -- <base-url>'
```

Allowed read scope:

- `/auth/profile/checkout-data`.
- `/auth/profile/delivery-addresses`.
- `/auth/profile/invoice-profiles`.

### Cleanup/Reset Validation

After any approved fetch window:

```bash
unset ENABLE_AUTH_WALLET_BROWSER_SESSION_SMOKE
unset CLIPLOT_AUTH_WALLET_SMOKE_APPROVAL_ID
unset AUTH_WALLET_SYNTHETIC_BEARER
```

Then rerun:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/cliplot && npm run readiness:auth-wallet-browser-session-smoke'
```

Expected reset evidence:

- `approval_required_auth_wallet_browser_session_fetch_source_path`.
- `liveExecutionAllowed=false`.
- `authWalletFetch=false`.

### Required Owner Inputs

- Non-secret approval id matching `CLIPLOT-AUTH-WALLET-SMOKE-<ID>`.
- Owner-approved synthetic Auth bearer/session input for the bounded evidence window, preferably through `AUTH_WALLET_SYNTHETIC_BEARER_FILE=<0600-approved-token-file>`.
- Owner-approved base URL: `https://auth.alfares.cz` for direct Auth wallet reads; Cliplot runtime base URL remains `https://cliplot.alfares.cz` for Cliplot-scoped checks.
- Explicit confirmation that checkout submit, payment, Warehouse reservation, notification send, Auth wallet mutation, DB, Kubernetes, Vault, and deploy actions are out of scope.
- Repo-owned file-based bearer input support added in Cliplot `25f90e0`; current synthetic bearer/session value source is still `[MISSING: approved current synthetic bearer/session source value]`.

### Forbidden Outputs And Actions

- Do not print Authorization headers, bearer/JWT/refresh tokens, cookies, decoded token claims, raw wallet response bodies, customer PII, service credentials, emails, customer data, or raw response bodies.
- Do not run checkout submit.
- Do not run Auth wallet/profile mutation.
- Do not create payments, Warehouse reservations, notifications, orders, or provider calls.
- Do not perform DB reads/writes for this packet.
- Do not mutate Kubernetes, Vault, runtime env, or deployments.
- Do not run browser-side direct Auth wallet calls outside the repo-owned smoke harness.

### Execution Readiness

Blocked for live execution. Read-only readiness is ready and passed, the file-based token path is source-prepared, and a conservative non-secret future approval id is `CLIPLOT-AUTH-WALLET-SMOKE-20260706-REVIEW-01`. Live browser-session fetch still needs an approved current synthetic bearer/session source value and explicit execution window. Auth-owned wallet/profile mutation remains separately blocked by `[MISSING: owner-approved Auth-owned delivery/invoice/profile mutation contract for Cliplot write surfaces]`.

## Parallel Execution Matrix

| Workstream | Status | Owner Role | Scope | Dependencies | Validation Owner | Merge/Run Order |
| --- | --- | --- | --- | --- | --- | --- |
| Marathon preflight/dry-run | ready now | Marathon runtime validation worker | read-only validators and aggregate dry-run | none | Auth orchestrator | first |
| Marathon apply phase auth | blocked | Marathon/Auth reconciliation operator | approval-gated role/marker batch | all required owner inputs | Auth orchestrator | after dry-run |
| Marathon apply phase marathon | blocked | Marathon reconciliation operator | approval-gated mapped participant/user rewrite batch | Auth phase validation | Auth orchestrator | after Auth phase |
| Marathon migrated-user smoke | blocked | Marathon runtime validation worker | known migrated user journey smoke | approved fixture token | Auth orchestrator | after apply phases |
| Cliplot read-only readiness | ready now | Cliplot runtime validation worker | readiness gates only | none | Auth orchestrator | parallel with Marathon preflight |
| Cliplot browser-session fetch | blocked | Cliplot runtime validation worker | read-only Auth wallet/profile fetch | approval id plus file-based synthetic bearer/session source | Auth orchestrator | after read-only readiness |
| Cliplot write surfaces | blocked | Contract owner | future Auth-owned mutation contract | consent/idempotency/audit/rollback/no-PII packet | Auth orchestrator | separate future lane |

## Stop Conditions

- Any dirty worktree in the target repo that overlaps scripts, docs, or runtime gate files.
- Any command would print raw PII, token/session values, DSNs, secrets, DB rows, or raw response bodies.
- Any missing owner input above.
- Any drift from the recorded target heads before a mutating or authenticated execution.
- Any request to combine Marathon phases without a renewed cross-DB transaction risk acceptance.
- Any request to run Cliplot checkout submit, payment, warehouse, notification, order, Auth wallet mutation, DB, Kubernetes, Vault, or deploy work under the browser-session read packet.
