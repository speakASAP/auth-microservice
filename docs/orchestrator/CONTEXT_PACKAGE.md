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
