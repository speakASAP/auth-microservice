# Auth Implementation Goals

This directory contains executable goal prompts for Auth implementation sessions.

Use the master command from `../docs/IMPLEMENTATION_ORCHESTRATOR.md` in a fresh session:

```text
AUTH ORCHESTRATOR: continue implementation
```

To select a specific goal:

```text
AUTH ORCHESTRATOR: implement goal number 6
```

## Goals

1. `GOAL-01-admin-token-copy.md` - admin token copy UX and safety.
2. `GOAL-02-auth-intent-preservation-pack.md` - Auth orchestrator pack and AGENTS workflow.
3. `GOAL-03-unified-auth-contract-recovery.md` - restored current Auth contract docs.
4. `GOAL-04-auth-observability-safety.md` - auth-flow observability and redaction safeguards.
5. `GOAL-05-goalkeeper-style-orchestration.md` - Goalkeeper-style master orchestrator state, templates, and continuation workflow.
6. `GOAL-06-rbac-consuming-services-audit.md` - completed RBAC role audit across consuming services.

## Execution Order

Safe default:

```text
01 -> 02 -> 03 -> 04 -> 05 -> owner-selected 06 (done)
```

Goal 06 touches ecosystem consumers and should start only when the owner confirms scope or requests it explicitly.

## Source Documents

Every implementation session must read:

```text
AGENTS.md
TASKS.md
STATE.json
docs/IMPLEMENTATION_STATE.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
docs/UNIFIED_AUTH_CONTRACT.md
docs/ENV_CORS_AND_AUTH_CHECK.md
docs/UNIFIED_AUTH_VERIFICATION.md
docs/orchestrator/MASTER_PROMPT.md
docs/orchestrator/INTENT.md
docs/orchestrator/GOALS.md
docs/orchestrator/PLAN.md
docs/orchestrator/STATUS.md
docs/orchestrator/PROMPTS.md
```

When available, also read `README.md`, `BUSINESS.md`, and `SYSTEM.md`.

## Required Workflow For Every Goal

Every goal session must:

1. Read the source documents and selected `GOAL-XX-*.md`.
2. Query docs-rag-microservice before broad ecosystem architecture or contract work.
3. Run `git status --short --branch` before editing.
4. Create or update a local execution plan before coding, using `templates/EXECUTION_PLAN.md`.
5. Keep implementation within the selected goal scope.
6. Split work into workers only when ownership is disjoint.
7. Generate or update a context package and coding prompt when delegating coding work.
8. Run the narrowest relevant validation.
9. Produce an Intent Compliance Report.
10. Update `docs/IMPLEMENTATION_STATE.md` and `docs/orchestrator/STATUS.md`.

## Local Process Templates

Use these templates for goal execution artifacts:

- `templates/EXECUTION_PLAN.md`
- `templates/CONTEXT_PACKAGE.md`
- `templates/CODING_PROMPT.md`
- `templates/VALIDATION_REPORT.md`

## Required Final Report Shape

Every goal, merge, or validation session must end with:

```markdown
## Intent Compliance Report

### Goal
...

### Implemented
...

### Not Implemented
...

### Boundary Check
...

### Subagents Used
...

### Validation Evidence
...

### Risks
...

### Files Changed
...

### Next Action
...
```

## Global Non-Goals

Do not implement:

```text
catalog, warehouse, order, payment, lead, marketing-sending, notification-sending, logging-storage, database-infrastructure, or gateway ownership inside Auth
direct production user-table writes by agents
secret, token, password, OAuth, reset-token, or magic-link-token exposure
JWT/RBAC breaking changes without explicit compatibility planning
production deployment without owner approval
```
