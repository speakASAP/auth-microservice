# 2026-07-06 Profile Centralization Completion Audit

## Scope

This audit checks the user's requested end state:

- Auth is the central store for registered-user name, surname, email, password, profile image metadata, profile settings, delivery addresses, invoice profile data, and reusable profile/contact data.
- A user can edit reusable account/profile data through Auth-owned APIs or hosted Auth profile surfaces.
- Consumer applications must either use Auth-owned profile APIs/surfaces or keep only domain-local fields/snapshots with explicit boundaries.
- Findings must be split into goal-driven workstreams, executed in parallel where safe, and backed by validation evidence.

## Current Evidence

| Requirement | Current Evidence | Verdict |
| --- | --- | --- |
| Canonical Auth profile read/update exists | `GET /auth/profile`, `PATCH /auth/profile`, `avatarUrl`, `profileImageUrl`, `profileSettings`, hosted `/profile`, contract tests, build, lint | Source-proven |
| Auth-owned password changes exist | `POST /auth/password-change`, `POST /auth/password-set`, password reset request/confirm, existing contract tests | Source-proven |
| Auth-owned delivery/invoice wallet exists | delivery address CRUD, invoice profile CRUD/default, checkout-data aggregate, deployed Goal 10 evidence in status docs | Source/runtime-proven for existing wallet scope |
| Verified email change exists | commits `ba17910` and `081d764`; `EmailChangeToken`, request/confirm endpoints, hosted form, source SQL, root TypeORM entity registration, activation source checker | Source-proven, runtime-gated |
| Hosted `/profile` exposes central profile controls | hosted profile static checker contains canonical profile, wallet, avatar/settings, and email-change markers | Source-proven; live post-deploy static smoke pending for latest email-change changes |
| Consumers audited and split into workstreams | matrix in `docs/orchestrator/2026-07-06-profile-centralization-audit.md`; lanes A/B/D/G for Marathon, Payments, Aukro, Cliplot | Source-proven |
| Completed consumer lanes are pushed and clean | Read-only subagent audit reported Marathon, Payments, Aukro, and Cliplot clean on `origin/main` with no unpushed work | Source-proven |
| Runtime activation for email change | `docs/orchestrator/2026-07-06-auth-email-change-runtime-gate.md`, `npm run check:auth-email-change-activation-source`, `npm run check:auth-email-change-runtime` fail-closed | Prepared, not executed |

## Not Complete Yet

The full user-facing runtime guarantee is not proven until these approved runtime gates pass:

1. Apply `scripts/create-email-change-table.sql` in an approved Auth DB change window.
2. Deploy Auth from clean `main` at `081d764` or later.
3. Run GET-only hosted `/profile` static smoke against deployed Auth.
4. Run bounded synthetic email-change request smoke using file-based bearer/new-email/password inputs.
5. Obtain the one-time email-change token through the approved operator/inbox path without printing the token/email body.
6. Run bounded synthetic confirm smoke and prove sanitized success status only.

## Source-Only Completion Checker

Run:

```bash
npm run check:profile-centralization-current-state
```

Expected current status:

- `pass_profile_centralization_current_state_source_audit`
- `goalComplete=false`
- no runtime call, deploy, DB read/write, environment read, or secret output

## Boundary

No SQL apply, deploy, live static smoke, live email-change request/confirm, production DB read/write, secret/token/password/email output, notification payload output, or raw customer-data output occurred in this checkpoint.
