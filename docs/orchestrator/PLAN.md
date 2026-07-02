# Auth Implementation Plan

## Execution Rule

Work one goal chunk at a time. Prefer a complete, verifiable chunk over starting multiple tracks.

No implementation begins until the Auth IPS pre-coding gate passes for the selected chunk or the owner explicitly approves a documented exception.

## Planning Stages

Auth follows the Goalkeeper/Project OS lifecycle for future implementation work:

1. `queued` - owner or coordinator has captured a goal.
2. `planning` - coordinator gathers DocsRAG context, source facts, risks, and acceptance criteria.
3. `approved` - owner or session lead accepts the plan or explicitly selects the next chunk.
4. `active` - implementation agent edits the smallest complete chunk.
5. `validation` - build, syntax, API, UI, or deployment checks run.
6. `done` - evidence is recorded and the next chunk is named.
7. `blocked` - the same blocker prevents progress and owner input is required.

## IPS Stage Checks

For each coding chunk, perform these checks in order:

1. Intent check: selected work preserves `docs/orchestrator/INTENT.md`.
2. Traceability check: selected work links to `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/GOALS.md`, `implementation-goals/README.md`, or `TASKS.md`.
3. Context check: `docs/orchestrator/CONTEXT_PACKAGE.md` names included and excluded documents.
4. Invariant check: `docs/orchestrator/PROJECT_INVARIANTS.md` lists rules affected by the work.
5. Sensitive-data check: the plan states whether secrets, tokens, credentials, production user data, or logs are involved.
6. Contract check: the plan states whether JWT, RBAC, API, redirect, CORS, OAuth, magic-link, or internal-service contracts change.
7. Validation check: the plan names exact commands or runtime checks.
8. Gate check: `docs/orchestrator/PRE_CODING_GATE.md` has a pass decision or documented exception.

## Coordinator Duties

The coordinator agent must:

- Read `AGENTS.md`, the orchestrator pack, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `implementation-goals/README.md`, and current `STATE.json`.
- Query docs-rag-microservice before broad architecture decisions.
- Select the active checkpoint from `docs/IMPLEMENTATION_STATE.md`; otherwise select the earliest active or pending goal unless the owner overrides it.
- Tell the user the current goal, current chunk, verification plan, and next task.
- Keep `docs/IMPLEMENTATION_STATE.md` and `docs/orchestrator/STATUS.md` updated with concrete evidence.
- Create or update an execution plan from `implementation-goals/templates/EXECUTION_PLAN.md` before coding.
- Use context packages, coding prompts, and validation reports when work is delegated or high risk.
- Avoid cross-service ownership drift.

## Goalkeeper-Style Orchestration Artifacts

Auth uses the same state-driven orchestration shape as Goalkeeper:

- Master prompt: `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- Continuation state: `docs/IMPLEMENTATION_STATE.md`
- Goal index: `implementation-goals/README.md`
- Execution templates: `implementation-goals/templates/`
- Historical evidence: `docs/orchestrator/STATUS.md`

## Active Work

Goal 10 - Auth Customer Data Wallet is active.

Current chunk:

- 10.1-10.5 Auth backend/customer data wallet source is implemented and source-validated.
- 10.6-10.7 FlipFlop client/selector source prep is complete and runtime-gated.
- 10.8 Orders compatibility audit is complete; no Orders source change before wallet provenance decision.
- 10.9 Rent-a-box hosted Auth/profile migration plan is committed in `rent-a-box` commit `fcfeb48`.
- 10.10 ChytraKoupe checkout selector integration plan is committed in `chytrakoupe` commit `a1dabca`.
- 10.11 cross-repo validation and deployment plan is created in
  `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`.
- 10.14 Auth hosted `/profile` wallet management UI is source-prepared in
  `4bdbd27`.
- 10.15 Auth wallet runtime 401 smoke verifier is source-prepared in
  `9ff1099`.
- Continuation update: Auth exact HEAD `9ff1099bbee18836c40d9276d3b96a15e5e522fb`
  is the current deploy candidate, source validation passed, and
  active FlipFlop target branch
  `codex/orders-lifecycle-cabinet-flipflop-clean` now contains wallet source
  commits `a8425a9`, `15fb1ee`, `f4af318`, plus validation report commit
  `223db57`.
- Next live chunk: owner-approved Auth schema-only DB preflight, SQL apply,
  Auth deploy, and wallet endpoint 401 smoke.

Planning artifacts:

- `docs/AUTH_CUSTOMER_DATA_WALLET_CONTRACT.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-cross-repo-plan.md`
- `implementation-goals/GOAL-10-auth-customer-data-wallet.md`
- `docs/orchestrator/2026-07-02-auth-customer-data-wallet-validation-deployment-plan.md`
- `rent-a-box/docs/goals/GOAL-12-auth-customer-data-wallet-migration.md`
- `chytrakoupe/implementation-goals/GOAL-06-auth-wallet-checkout-selectors.md`

Parallel execution summary:

- Auth SQL apply/deploy remains owner-approval gated.
- FlipFlop runtime smoke remains gated on Auth SQL/deploy, but its active
  target branch is source-integrated and source-validated.
- Orders remains source-unchanged and gated on final wallet provenance field
  decisions.
- Rent-a-box code migration is gated on hosted Auth/session/admin-role and live data migration decisions.
- ChytraKoupe selector implementation is gated on Auth wallet deploy, Auth client-id decision, CORS/redirect allowlist, and order snapshot payload decisions.
- Marketplace/channel services stay read-only/audit-only until a real customer checkout surface is confirmed.

## Verification Commands

Use the narrowest relevant checks:

```bash
node --check web/public/js/admin.js
npm run build
./scripts/deploy.sh
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin
```

Documentation-only IPS changes should be checked with:

```bash
find docs/orchestrator -maxdepth 1 -type f -name '*.md' -print
rg '\[(MISSING|UNKNOWN):' docs/orchestrator AGENTS.md TASKS.md docs/UNIFIED_AUTH_CONTRACT.md docs/UNIFIED_AUTH_VERIFICATION.md docs/ENV_CORS_AND_AUTH_CHECK.md
rg -n 'Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}|(access[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[:=]\s*['"'"'\"]?[A-Za-z0-9_./+=:-]{12,}' docs AGENTS.md TASKS.md
```

For DocsRAG context, query:

```bash
POST /retrieval/agent-context
{"query":"auth-microservice <topic>","maxTokens":3000}
```

## Next Goal Selection

Select the active checkpoint from `docs/IMPLEMENTATION_STATE.md`. If none exists, select the next owner-approved backlog item.
