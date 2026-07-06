# GOAL-11 First-Visit Application Access Assignment

id: GOAL-11
status: source-validated
owner: Auth RBAC contract owner

## Intent

Auth must grant baseline access to an ecosystem application the first time a centrally registered user authenticates through that application's hosted Auth flow, without duplicating identity or moving product/domain authorization into Auth.

## Scope

Allowed:

- Add optional `client_id` and `return_url` propagation for hosted password login/register.
- Reuse existing `applications`, `roles`, and `user_roles` data.
- Assign only the active application-scoped `user` role as `app:<client_id>:user`.
- Keep assignment idempotent and before token signing.
- Update Auth contract docs, hosted consumer standard, focused tests, and orchestrator state.

Forbidden:

- No application or role auto-creation during login.
- No admin-role assignment.
- No product entitlement, order, payment, subscription, marathon participant, school approval, domain profile, or consumer-local onboarding ownership moves into Auth.
- No JWT shape change beyond current `roles` content.
- No production DB row inspection/mutation outside normal runtime role assignment behavior after deploy.
- No deployment without owner approval.

## Acceptance Criteria

- Hosted password login/register send `client_id` and validated `return_url`.
- Contact-code, magic-link, and OAuth flows use persisted `client_id`.
- Auth validates `client_id`, active application, active app `user` role, optional application domain/return URL match, and expired assignment fail-closed.
- Token roles include `app:<client_id>:user` after first successful hosted flow.
- Focused tests, build, lint, and diff-check pass.
