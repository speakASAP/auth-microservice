# Payments Admin Smoke Service Token Provisioning

Date: 2026-07-06
Owner role: Auth/Payments runtime smoke operator
Repository: `auth-microservice`
Mode: approved runtime provisioning for Payments admin authenticated smoke. No raw token/JWT/cookie/session output, decoded JWT output, raw production user/email output, provider call, payment/refund/payout/transfer/connected-account mutation, or Payments DB query.

## Intent Preservation Chain

- Vision: Auth remains the Statex identity and RBAC authority while Payments owns payment admin configuration.
- Goal Impact: provide a no-print/no-decode/no-persist admin bearer for bounded Payments admin smoke.
- System: Auth service-principal JWT issuance and role assignment; Payments protected admin API validation.
- Feature: Payments admin authenticated smoke unblocker.
- Task: create or identify a service principal with `internal:payments-microservice:admin`, issue a temporary token file, run sanitized Payments smoke, and destroy the token source.
- Execution Plan: run existing `scripts/provision-internal-service-token.ts` helper in check-only and apply mode inside the Auth pod; never print token material; run Payments smoke with sanitized output; delete the token file.
- Coding Prompt: owner approved resolving the missing Payments admin test session packet; use existing guarded helper only and preserve no-print/no-decode/no-persist handling.
- Code: no Auth source code changed.
- Validation: sanitized command evidence below.

## Verdict

Provisioning succeeded and the temporary token source was destroyed after Payments smoke.

Auth helper:

- `scripts/provision-internal-service-token.ts`
- contract: `auth-internal-service-token-provisioning.v1`
- service name: `payments-admin-smoke`
- role: `internal:payments-microservice:admin`
- token output path inside pod: `/tmp/payments-admin-smoke.jwt`
- token file mode: `0600`
- token TTL: `2h`

Check-only result:

- `applicationFound=true`
- `roleFound=true`
- `principal=null`
- `wouldCreateUser=true`
- `wouldAssignRole=true`
- `mutatesDatabase=false`
- `emitsToken=false`

Apply result:

- `mutatesDatabase=true`
- `emitsToken=true`
- `tokenPrinted=false`
- service principal `userType=service`
- principal active and verified
- role assignment created
- stdout redacted principal id/email before recording

Payments smoke result:

- `profileHttpStatus=200`
- `requiredRolePresent=true`
- `adminApplicationsHttpStatus=200`
- `adminApplicationsArray=true`
- `adminApplicationsCount=0`
- `tokenSourceDestroyedOrInvalidated=true`

## Boundary

- Token/JWT/cookie/session value was not printed, decoded, committed, or persisted.
- Raw profile/admin API response bodies were not printed.
- Raw service-principal id/email is not recorded in this report.
- No provider call or payment/refund/payout/transfer/connected-account mutation occurred.
- No Auth deploy occurred.
- No Payments deploy occurred in this provisioning step.

## Next Step

Use the Payments-side report `reports/validation/VAL-2026-07-06-payments-admin-authenticated-smoke.md` as the authenticated smoke evidence, then proceed to first real admin configuration only after owner supplies service/company/account inputs.
