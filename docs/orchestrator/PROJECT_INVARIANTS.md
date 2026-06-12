# Auth Project Invariants

```yaml
id: AUTH-PROJECT-INVARIANTS
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: validated
upstream:
  - docs/orchestrator/INTENT.md
  - docs/UNIFIED_AUTH_CONTRACT.md
downstream:
  - docs/orchestrator/PRE_CODING_GATE.md
  - docs/orchestrator/EXECUTION_PLAN.md
  - docs/orchestrator/READINESS_GATES.md
```

## Purpose

These invariants translate Auth's preserved intent into checks that must run before coding and before deployment. They are the Auth-local equivalent of the company IPS `PROJECT_INVARIANTS.md`.

## Applicability

All Auth implementation, documentation, deployment, contract, and operations changes must evaluate these invariants. Documentation-only changes may mark runtime checks as not applicable, but may not skip intent, traceability, contract, or sensitive-data checks.

## Invariants

| ID | Level | Source | Rule | Forbidden outcome | Validation method | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-INV-001 | intent | `docs/orchestrator/INTENT.md` | Auth remains the ecosystem authority for identity, credentials, JWTs, refresh tokens, OAuth, magic links, RBAC claims, registered-user preferences, consent flags, and service-authentication boundaries. | Moving Auth-owned behavior into another service or treating another service as token issuer/identity authority without an approved contract change. | Intent review in execution plan and status evidence. | pre-coding, readiness |
| AUTH-INV-002 | boundary | `docs/orchestrator/INTENT.md` | Auth does not own catalog, warehouse, orders, payment, non-registered leads, marketing campaign execution, notification sending, log storage, database infrastructure, or gateway routing. | Adding non-Auth domain ownership to Auth or bypassing the owning service contract. | Scope and non-goals review in execution plan. | pre-coding |
| AUTH-INV-003 | contract | `docs/UNIFIED_AUTH_CONTRACT.md` | JWT payload, RBAC roles, API endpoints, OAuth, magic-link, redirect, CORS, and internal-service contracts remain compatible unless the plan names migration and validation steps. | Silent breaking change to token claims, endpoint behavior, redirect safety, CORS, or internal headers. | Contract impact section and targeted verification commands. | pre-coding, readiness |
| AUTH-INV-004 | sensitive-data | `docs/UNIFIED_AUTH_VERIFICATION.md` | Secrets, passwords, JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, internal-service tokens, and raw production user data must not appear in docs, prompts, logs, frontend bundles, examples, tests, or reports. | Credential leakage or raw production data leakage. | Sensitive-data scan and redaction review. | pre-coding, readiness |
| AUTH-INV-005 | hosted-auth | `docs/UNIFIED_AUTH_CONTRACT.md` | Applications use Auth-hosted login, registration, OAuth, magic-link, and token validation flows instead of copying credential systems. | Duplicated credential forms or local token minting in consuming applications. | Consumer-contract review when integration changes are made. | pre-coding |
| AUTH-INV-006 | evidence | `docs/orchestrator/STATUS.md` | Every completed chunk records dated evidence, commands or checks run, deployment status when relevant, and the next unfinished task. | Closing work without reproducible verification evidence. | Status update review. | readiness |
| AUTH-INV-007 | docsrag | `AGENTS.md` | Ecosystem architecture or broad contract work queries docs-rag-microservice before broad source-tree reading when a service token is available. | Large architecture changes made from local assumptions only. | Retrieved source headings recorded in status or blocker noted when token is unavailable. | pre-coding |

## Exceptions

No standing exceptions are approved. If a gate cannot run because credentials, network access, or a runtime environment is unavailable, record the blocker and the compensating local check in `docs/orchestrator/STATUS.md`.

## Review Cadence

Review these invariants whenever Auth ownership, token contracts, OAuth/magic-link behavior, RBAC behavior, internal service authentication, or documentation workflow changes.
