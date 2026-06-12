# Auth Execution Plan

```yaml
id: AUTH-EXECUTION-PLAN
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: validated
upstream:
  - docs/orchestrator/GOALS.md
  - docs/orchestrator/CONTEXT_PACKAGE.md
  - docs/orchestrator/PROJECT_INVARIANTS.md
downstream:
  - docs/orchestrator/STATUS.md
```

## Metadata

This is the reusable Auth execution-plan frame. For each implementation chunk, update the selected goal, scope, contract impact, validation plan, and completion checklist before coding. Goal-specific execution plans may also be created from `implementation-goals/templates/EXECUTION_PLAN.md`.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Backlog and goal source: `TASKS.md`, `docs/orchestrator/GOALS.md`, `implementation-goals/README.md`
- Contract source: `docs/UNIFIED_AUTH_CONTRACT.md`
- Environment source: `docs/ENV_CORS_AND_AUTH_CHECK.md`
- Verification source: `docs/UNIFIED_AUTH_VERIFICATION.md`

## Goal Impact

Each chunk must state how it strengthens or preserves Auth as the identity and access-control authority. If a task does not affect Auth ownership, explain why it belongs in this repo before coding.

## Project Invariants

Evaluate all invariants from `docs/orchestrator/PROJECT_INVARIANTS.md`.

Minimum required entries for every chunk:

- `AUTH-INV-001`: Auth ownership preserved.
- `AUTH-INV-002`: non-Auth domain ownership excluded.
- `AUTH-INV-004`: sensitive data protected.
- `AUTH-INV-006`: status evidence recorded.

Add `AUTH-INV-003`, `AUTH-INV-005`, or `AUTH-INV-007` when contract, hosted-auth, or DocsRAG scope applies.

## Sensitive-Data Handling

Classification must be one of:

- `none`: no data-bearing examples or runtime output.
- `synthetic`: fake values only.
- `masked`: production-shaped values are masked before capture.
- `sensitive`: sensitive values are involved and must not be printed, persisted, or copied into docs.

Auth tasks involving passwords, JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, internal-service tokens, client secrets, or raw production user records are sensitive by default.

## Contract Validation Plan

State whether the chunk changes or validates:

- API endpoint paths or response shapes.
- JWT claims, expiry, issuer, signing, or refresh behavior.
- RBAC roles or role claim mapping.
- OAuth provider behavior.
- Magic-link request or verify behavior.
- Redirect allowlist behavior.
- CORS behavior.
- Internal service headers or trusted service names.
- Registered-user preferences and consent APIs.

If none apply, state `No Auth contract change`.

## Replay/Determinism Plan

Auth tasks usually require idempotent validation rather than replay. State how repeated validation avoids creating duplicate users, tokens, or notifications. Use synthetic accounts and avoid direct production table writes.

## Scope

Define exact files and behavior included in the chunk. Keep scope to one goal chunk unless the owner explicitly expands it.

## Non-Goals

Always exclude:

- Moving catalog, warehouse, orders, payment, leads, marketing, notification sending, log storage, database infrastructure, or gateway ownership into Auth.
- Printing or persisting decoded secrets.
- Direct production user-table writes.
- Unplanned JWT/RBAC/API breaking changes.

## Files to Inspect

Start with the context package. Add source files only when relevant, for example:

- `src/auth/auth.service.ts`
- `src/auth/admin-users.controller.ts`
- `src/admin/admin-roles.controller.ts`
- `src/roles/roles.service.ts`
- `src/users/users.service.ts`
- `web/public/admin.html`
- `web/public/js/admin.js`

## Files to Create

Name expected new files before coding. Documentation-only IPS additions belong under `docs/orchestrator/`, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `TASKS.md`, `AGENTS.md`, or `implementation-goals/` unless the owner asks for a full company IPS tree.

## Files to Modify

Name exact files allowed for the selected chunk before coding.

## Files That Must Not Be Modified

Unless owner-approved for the selected task, do not modify:

- Secret files or decoded K8s/Vault output.
- Unrelated service domains.
- Historical supersession docs under `docs/agents/` except to correct broken links.
- Contract docs without a matching contract validation plan.

## Implementation Steps

1. Read the context package and selected goal.
2. Restate intent and affected Auth boundary.
3. Fill scope, non-goals, invariant impact, sensitive-data classification, contract impact, and validation plan.
4. Run the pre-coding gate.
5. Implement the smallest complete chunk.
6. Run validation and readiness checks.
7. Append evidence and next chunk to `docs/orchestrator/STATUS.md`.
8. Update `docs/IMPLEMENTATION_STATE.md`.

## Test Plan

Use the narrowest sufficient tests. Examples:

- Documentation checks for documentation-only changes.
- `node --check web/public/js/admin.js` for admin JS changes.
- `npm test -- --runTestsByPath <file>` for focused backend checks.
- `npm run build` for TypeScript/backend changes.
- Production reachability or smoke checks only when deployment is requested.

## Validation Plan

Validation evidence must include command, result, and relevant output summary. Do not paste secrets, tokens, passwords, or raw user data.

## Gate Commands

Use `docs/orchestrator/PRE_CODING_GATE.md` before coding and `docs/orchestrator/READINESS_GATES.md` before deployment or closure.

## Documentation Updates

Update `docs/orchestrator/STATUS.md` after every completed chunk. Update `docs/IMPLEMENTATION_STATE.md` before ending the session. Update contract docs only when the selected chunk changes or clarifies the Auth contract.

## Rollback Plan

For documentation-only changes, revert the changed docs. For code changes, prefer a normal Git revert or targeted patch that restores previous behavior while preserving unrelated user changes.

## Agent Handoff Prompt

Read the Auth orchestrator pack and contract docs. Select the active state goal, earliest active or pending goal, or owner-selected goal. Refresh the execution plan, run the pre-coding gate, implement the smallest complete chunk, validate it, and record evidence in `docs/orchestrator/STATUS.md` plus `docs/IMPLEMENTATION_STATE.md`.

## Completion Checklist

- [ ] Selected goal and chunk named.
- [ ] Intent and boundary impact stated.
- [ ] Context package reviewed.
- [ ] Invariants evaluated.
- [ ] Sensitive-data classification stated.
- [ ] Contract impact stated.
- [ ] Validation plan stated.
- [ ] Pre-coding gate passed or exception recorded.
- [ ] Implementation complete.
- [ ] Verification evidence recorded.
- [ ] Next unfinished chunk named.
