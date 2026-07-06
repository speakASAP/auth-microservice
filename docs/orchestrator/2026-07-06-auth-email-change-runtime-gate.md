# 2026-07-06 Auth Email Change Runtime Gate

## Intent Preservation Chain

- Vision: Auth is the central source of truth for account email and registered-user contact identity across the ecosystem.
- Goal Impact: a user can request an email change from an app profile surface, but the actual account email update happens only in Auth after verified confirmation.
- System: Auth owns `users.email`, primary email contact data, password proof, one-time email-change tokens, and hosted `/profile` email-change UI wiring.
- Feature: approval-gated runtime activation evidence for verified email change.
- Task: prepare a non-mutating-by-default smoke harness and runtime gate packet for DB migration, deploy, static profile smoke, request smoke, and confirm smoke.
- Execution Plan: do not apply SQL, deploy, read DB rows, print tokens/passwords/email bodies, or run live email-change mutation without the owner-approved runtime window and required input files.
- Coding Prompt: keep the harness fail-closed; use token/password/confirmation-token files; emit only sanitized booleans/status codes.
- Code: `scripts/check-auth-email-change-runtime-smoke.js` and `npm run check:auth-email-change-runtime`.
- Validation: source-only guarded check, node syntax check, package script verification, Auth contract tests, build, lint, and `git diff --check`.

## Runtime Gate Order

0. Source-only activation preflight must pass before any runtime work:

```bash
npm run check:auth-email-change-activation-source
npm run check:auth-email-change-preflight
npm run check:profile-centralization-activation-packet
npm run check:profile-centralization-runtime-readiness -- --base-url=https://auth.alfares.cz --no-write-report
```

This verifies root TypeORM entity registration, feature repository wiring, SQL/entity shape, hosted profile markers, email-change SQL preflight safety, guarded runtime smoke safety, package scripts, and that `scripts/deploy.sh` does not apply SQL or enable `DB_SYNC=true`.

1. Apply `scripts/create-email-change-table.sql` in the approved Auth DB change window.
2. Deploy Auth from a clean `main` head containing the email-change source commit.
3. Run GET-only post-deploy hosted profile static smoke:

```bash
npm run check:customer-data-wallet-hosted-profile-static -- --no-write-report
```

4. Request smoke with synthetic account/new email:

```bash
RUN_AUTH_EMAIL_CHANGE_SMOKE=1 \
AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE \
AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID=<non-secret approval id> \
AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE=<0600 bearer file> \
AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL_FILE=<0600 synthetic new email file> \
AUTH_EMAIL_CHANGE_SMOKE_CURRENT_PASSWORD_FILE=<0600 current password file, only for password accounts> \
npm run check:auth-email-change-runtime -- --execute --mode=request
```

5. Confirm smoke only after the approved operator/inbox path provides the one-time confirmation token in a local 0600 file:

```bash
RUN_AUTH_EMAIL_CHANGE_SMOKE=1 \
AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE \
AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID=<same or linked non-secret approval id> \
AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE=<0600 email-change token file> \
npm run check:auth-email-change-runtime -- --execute --mode=confirm
```

## Output Contract

Allowed output:

- mode, approval-id presence, HTTP method/path/status, success booleans, expected field-presence booleans, report status, and whether Authorization/request body were sent.

Forbidden output:

- bearer tokens, passwords, email-change tokens, JWT claims, email addresses, email message bodies, request bodies, response bodies, DB rows, production customer data, notification payloads, cookies, OAuth tokens, magic-link tokens, reset tokens, API keys, connection strings, and secret values.

## Stop Conditions

- Any DB migration failure.
- Auth deploy failure or rollout health failure.
- Hosted `/profile` static smoke fails after deploy.
- Email-change request returns a non-2xx status for the approved synthetic account.
- Confirmation token cannot be obtained through the approved operator/inbox path without printing email/token contents.
- Confirmation returns a non-2xx status.
- Any command would require printing or storing secret/customer-data values in docs, git, logs, or reports.

## Current Status

- Source harness prepared and fail-closed.
- Root TypeORM entity registration preflight prepared.
- Email-change SQL source-only preflight prepared.
- SQL apply: not run.
- Deploy: not run.
- Live static smoke: current deployed image checked read-only and failed as stale; post-deploy smoke not run after email-change deployment.
- Live request/confirm smoke: not run.

## 2026-07-06 Readiness Update

Read-only runtime availability has recovered enough for the next approved activation window:

- Auth backend and web deployments are `1/1` with non-empty endpoints.
- Public `/health` returns ok.
- Live post-deploy hosted profile static smoke reaches `/profile` and `/js/profile.js` with HTTP `200`, but fails because the deployed image is still stale and does not include current profile image/settings/email-change UI markers.

This does not authorize SQL apply or deployment. The next mutable step remains an owner-approved DB/deploy window for `scripts/create-email-change-table.sql` and Auth deploy from clean `main`, followed by the static and synthetic email-change smokes defined above.

## 2026-07-06 SQL Preflight Update

`npm run check:auth-email-change-preflight` reports `pass_auth_email_change_preflight_source_gate` without reading environment, connecting to the database, applying SQL, or printing secrets. It validates `scripts/create-email-change-table.sql`, rejects destructive/data-mutating SQL lines, and emits sanitized metadata preflight, post-apply verification, and apply command templates for the owner-approved window.

## 2026-07-06 Activation Packet Checker

`npm run check:profile-centralization-activation-packet` verifies the full source-only activation packet: package scripts, gate order, approval/input gates, output restrictions, SQL/deploy boundaries, stop conditions, current blocked state, and GET-only static-smoke safety. It does not call runtime, read environment, deploy, apply SQL, or print secrets.

## 2026-07-06 Runtime Readiness Checker

`npm run check:profile-centralization-runtime-readiness -- --base-url=https://auth.alfares.cz --no-write-report` performs a GET-only runtime readiness snapshot across `/health`, `/profile`, and `/js/profile.js`. It sends no Authorization header, cookies, or request body, reads no database, prints no response body, and distinguishes Auth availability from stale hosted profile assets.
