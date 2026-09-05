# Ecosystem Hosted Auth Rollout Index

Date: 2026-06-24
Repo: auth-microservice
Owner role: AOS identity orchestration owner
Scope: Alfares ecosystem migration to Auth-hosted login/register and centralized AOS user identity.

## IPS Chain

Vision: every Alfares application uses `auth-microservice` as the only user identity, credential, hosted login, password reset, and phone/email passwordless authority.
Goal Impact: users can sign in to Marathon, new SpeakASAP, and the wider Alfares ecosystem with the same AOS account by phone or email, while applications stop duplicating credential forms and user databases.
System: `auth-microservice`, hosted Auth web UI, JWT/refresh validation contract, Notifications delivery, consumer frontend callback adapters, consumer backend auth guards.
Feature: ecosystem-wide hosted Auth rollout with repo-by-repo migration plans and parallel execution lanes.
Task: classify each repository auth surface, migrate user-facing login/register forms to hosted Auth, keep service authorization compatible, and preserve legacy boundaries.
Execution Plan: run cluster-specific read-only handoff workers, then launch implementation workers by disjoint repo/file ownership after each handoff is validated.
Coding Prompt: do not touch legacy `speakasap-portal`; do not read secrets or live DB data; do not backfill users without explicit approval; preserve existing `/auth/validate` consumers while hosted UI adoption proceeds.
Code: this index plus cluster handoff docs; app code changes only in later repo-owned lanes.
Validation: `git diff --check` for docs; repo-specific build/test/smoke commands per handoff; runtime validation only after approved deploys.

## Authoritative Contract

Current central Auth contract: `docs/UNIFIED_AUTH_CONTRACT.md`.
Consumer migration standard: `docs/HOSTED_AUTH_CONSUMER_STANDARD.md`.

Consumer applications should prefer:

- Hosted login: `https://auth.alfares.cz/login?client_id=<app>&return_url=<https callback>`
- Hosted register: `https://auth.alfares.cz/register?client_id=<app>&return_url=<https callback>`
- Callback handling: consume `#access_token`, `#refresh_token`, `#expires_at`, `#state`, and `#auth_method`, then strip the fragment from browser history.
- Backend validation: `POST /auth/validate` unless a documented high-throughput exception follows the Auth consumer JWT validation standard.
- Password reset and phone/email passwordless: owned by hosted Auth, not consumer-local credential forms.

Consumer applications must not:

- Mint Auth JWTs locally.
- Treat `register-contact` or `login-contact` as authenticated login.
- Add new local password, phone-code, magic-link, or reset forms unless they only redirect to hosted Auth.
- Read or duplicate Auth user data into product databases except for product-owned profile references and approved backfill mappings.

## Current Completed Runtime Slice

| Repo | Status | Evidence |
| --- | --- | --- |
| `auth-microservice` | hosted email/phone login, register, reset, contact-code contract implemented and deployed | deployments `auth-microservice` and `auth-microservice-web` are `ready=1/1`; hosted `/login` contains contact-code markers |
| `marathon` | hosted Auth handoff implemented and deployed; profile loop fixed | deployment `marathon` is `ready=1/1`; read-only journey verifier returned `ok:true` |
| `speakasap` | new frontend hosted Auth adapter implemented and deployed | deployment `speakasap-frontend` is `ready=1/1`; root/admin pages expose hosted Auth controls |
| `speakasap-portal` | forbidden legacy surface | not touched |

## Global Runtime Blockers

- `vault-backend` `ClusterSecretStore` is `Ready=False` because configured Vault health reports `sealed=true`; this blocks secret refresh and deploy scripts that validate ExternalSecret readiness.
- Marathon user backfill into AOS/Auth remains approval-gated. No live DB query or backfill apply has been approved.
- Production SMS delivery for phone contact-code remains `[UNKNOWN: Notifications SMS provider readiness]` until an approved test number/provider smoke is run.
- `speakasap/certification-service` build remains blocked by existing dependency/type/prisma debt; frontend/gateway migration is deployed.

## Read-Only Inventory Snapshot

Generated from remote repo scan excluding legacy `speakasap-portal`, with generated/build folders and secrets skipped. Counts are directional, not a final code review.

| Migration class | Repos observed | Meaning |
| --- | --- | --- |
| Hosted Auth already present or referenced | `ai-microservice`, `catalog-microservice`, `marathon`, `orders-microservice`, `runlayer`, `shop-assistant`, `speakasap`, `statex` | likely needs adapter verification, redirect/callback standardization, or stale docs cleanup |
| Direct consumer login/register forms or API calls | `allegro-service`, `aukro-service`, `bazos-service`, `catalog-microservice`, `crypto-ai-agent`, `flipflop-service`, `heureka-service`, `prompts-microservice`, `rent-a-box`, `school-committee`, `statex`, `suppliers-microservice`, `warehouse-microservice` | candidate for hosted Auth redirect/callback migration |
| Consumer `/auth/validate` already present | `ai-microservice`, `allegro-service`, `aukro-service`, `bazos-service`, `flipflop-service`, `heureka-service`, `marathon`, `monitoring-microservice`, `school-committee`, `speakasap`, `statex` | keep compatible; verify role and user claim mapping |
| Local JWT verification or shared `JWT_SECRET` dependency | many backend services including commerce repos, `warehouse-microservice`, `notifications-microservice`, `monitoring-microservice`, `payments-microservice`, `speakasap/certification-service` | classify as service-token use vs user-token anti-pattern before changing |
| Legacy contact endpoints | `marathon`, `statex` | must migrate to provisioning-only semantics and verified Auth proof for login |
| Browser token storage | several frontends including commerce/admin tools | acceptable as transitional adapter only; callback sanitization and refresh/logout behavior must be standardized |

## Cluster Handoffs

Parallel workers own these disjoint docs:

| Cluster | Worker scope | Handoff file | Status |
| --- | --- | --- | --- |
| Commerce/marketplace | `allegro-service`, `aukro-service`, `bazos-service`, `flipflop-service`, `heureka-service`, `orders-microservice`, `payments-microservice`, `warehouse-microservice`, `catalog-microservice` | `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md` | launched |
| Platform/ops/admin | `ai-microservice`, `backups-microservice`, `database-server`, `docs-rag-microservice`, `logging-microservice`, `monitoring-microservice`, `notifications-microservice`, `prompts-microservice`, `runlayer`, `suppliers-microservice`, `minio-microservice` | `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md` | launched |
| Product/education/public apps | `school-committee`, `statex`, `statex-ecosystem`, `shop-assistant`, `rent-a-box`, `crypto-ai-agent`, `leads-microservice`, `marketing-microservice`, `speakasap`, `marathon` | `docs/orchestrator/2026-06-24-ecosystem-auth-rollout-product-education.md` | launched |

## Parallel Implementation Model

### Wave 0 - Infrastructure And Contract Gates

Status: dependency-gated.

Owner: infrastructure/Auth integration owner.
Allowed files: Auth docs, deployment runbooks, Vault readiness runbook references, non-secret Kubernetes metadata docs.
Forbidden files: secret values, Vault unseal keys, live DB data, legacy `speakasap-portal`.
Dependencies: Vault unsealed; Auth hosted contract remains deployed and healthy.
Validation: `vault-backend Ready=True`, ExternalSecrets reconcile, `auth-microservice` and `auth-microservice-web` `ready=1/1`, hosted `/login` smoke.

### Wave 1 - Consumer UI Redirects

Status: ready per repo after handoff review.

Owner: one worker per repo/frontend.
Allowed files: frontend login/register pages, auth session helpers, callback pages, consumer smoke scripts, repo-local migration plan docs.
Forbidden files: backend schema changes, DB migrations, secret files, legacy portal, shared Auth contract changes.
Dependencies: hosted Auth URL and return_url allowlist known.
Validation: frontend build, static marker check, callback fragment sanitization test, read-only production route smoke after deploy.
Merge order: low-traffic/admin tools first, then commerce/public apps, then high-traffic product flows.

### Wave 2 - Backend Validation Standardization

Status: dependency-gated by repo classification.

### Wave 3 - User Identity Backfill And Reconciliation

Status: approval-gated.

Owner: DB/backfill owner plus Auth owner.
Allowed files: runbooks, dry-run scripts, mapping reports with counts only, repo-local docs.
Forbidden files: live query/apply without explicit approval, raw PII exports, password hash import unless explicitly designed and approved.
Dependencies: Vault ready; DB profile approved; Auth API healthy; owner approves exact dry-run command, then exact apply command.
Validation: dry-run counts, duplicate/conflict report, idempotency proof, rollback/forward-fix plan.

### Wave 4 - Remove Consumer Credential Forms

Status: final integration.

Owner: ecosystem integration owner.
Allowed files: repo-local cleanup of obsolete login/register forms after hosted Auth adapter is live.
Forbidden files: removing emergency/admin access without replacement; deleting unrelated auth validation code.
Dependencies: deployed hosted Auth redirect/callback in that repo; user journey smoke passed.
Validation: no remaining local password/phone-code/reset form except hosted redirect; app protected route redirects centrally; logout clears local session only.

## Required Repo-Local Plan Template

Every migrated repo must receive a repo-local plan before code changes:

```md
# AOS Hosted Auth Migration Plan

Date: 2026-06-24
Repo: <repo>
Owner role: <frontend/backend/backfill owner>

## IPS Chain
Vision: ...
Goal Impact: ...
System: ...
Feature: ...
Task: ...
Execution Plan: ...
Coding Prompt: ...
Code: ...
Validation: ...

## Current Auth Surface
- Login/register UI: ...
- Backend validation: ...
- Local JWT/signing: ...
- User data ownership: ...
- External dependencies: ...

## Migration Tasks
1. ...

## Safety Boundaries
- Do not touch legacy `speakasap-portal`.
- Do not read secrets or live DB data.
- Do not run deploy/backfill without explicit approval.

## Validation Gates
- ...
```

## Next Integration Actions

1. Wait for the three cluster handoff workers to finish and validate their doc diffs.
2. Review handoff docs and choose first implementation wave candidates with disjoint frontend write scopes.
3. After Vault is unsealed, re-run ExternalSecret readiness checks before any deploy requiring secret refresh.
4. Request explicit approval for Marathon Gate 1 live read-only backfill dry-run only after Vault readiness is restored or the required DB/Auth runtime profile is otherwise verified.
