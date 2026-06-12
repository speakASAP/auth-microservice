# Auth Pre-Coding Gate

```yaml
id: AUTH-PRE-CODING-GATE
status: approved
owner: Auth owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: validated
upstream:
  - docs/orchestrator/PROJECT_INVARIANTS.md
  - docs/orchestrator/GOALS.md
  - docs/orchestrator/EXECUTION_PLAN.md
downstream:
  - docs/orchestrator/STATUS.md
```

## Purpose

This gate blocks coding until the selected Auth task has traceable intent, bounded context, invariant review, sensitive-data classification, contract impact, and a validation plan.

## Required Inputs

- `TASKS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/orchestrator/MASTER_PROMPT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/PROJECT_INVARIANTS.md`
- `docs/orchestrator/CONTEXT_PACKAGE.md`
- `docs/orchestrator/EXECUTION_PLAN.md`
- `docs/UNIFIED_AUTH_CONTRACT.md`
- `docs/UNIFIED_AUTH_VERIFICATION.md`
- `docs/ENV_CORS_AND_AUTH_CHECK.md`

## Gate Checklist

| Check | Requirement | Evidence location |
| --- | --- | --- |
| Goal selection | Earliest active or pending goal is selected, unless state or owner overrides it. | `docs/orchestrator/EXECUTION_PLAN.md` |
| Intent preservation | Affected Auth ownership and non-ownership boundaries are named. | `docs/orchestrator/EXECUTION_PLAN.md` |
| Context package | Included and excluded docs are listed. | `docs/orchestrator/CONTEXT_PACKAGE.md` |
| Invariants | Applicable `AUTH-INV-*` rules are listed with preservation notes. | `docs/orchestrator/EXECUTION_PLAN.md` |
| Sensitive data | Data classification is `none`, `synthetic`, `masked`, or `sensitive`, with handling rules. | `docs/orchestrator/EXECUTION_PLAN.md` |
| Contract impact | API, JWT, RBAC, OAuth, magic-link, redirect, CORS, and internal-service impact is stated. | `docs/orchestrator/EXECUTION_PLAN.md` |
| Validation plan | Exact commands or runtime checks are listed. | `docs/orchestrator/EXECUTION_PLAN.md` |
| Missing markers | No unresolved IPS missing or unknown markers remain in gate-critical docs unless documented as a blocker. | command output |
| Secret scan | Documentation and planned code changes contain no raw secret values or token examples. | command output |

## Local Documentation Commands

Use these for documentation-only IPS changes:

```bash
find docs/orchestrator -maxdepth 1 -type f -name '*.md' -print
rg '\[(MISSING|UNKNOWN):' docs/orchestrator AGENTS.md TASKS.md docs/UNIFIED_AUTH_CONTRACT.md docs/UNIFIED_AUTH_VERIFICATION.md docs/ENV_CORS_AND_AUTH_CHECK.md
rg -n 'Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}|(access[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[:=]\s*['"'"'\"]?[A-Za-z0-9_./+=:-]{12,}' docs AGENTS.md TASKS.md
```

## Runtime Commands

Use the narrowest runtime checks relevant to the selected task:

```bash
node --check web/public/js/admin.js
npm run build
npm test
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin
```

## DocsRAG Requirement

For ecosystem architecture, cross-service contract, or broad source-tree work, query docs-rag-microservice before implementation and record retrieved source headings in `docs/orchestrator/STATUS.md`.

If no service JWT is available in the session, do not invent RAG evidence. Record that DocsRAG was unavailable and proceed only with local source-of-truth docs or ask the owner for credentials when the missing context blocks the task.

## Decision Policy

- `pass`: all checklist items are satisfied; coding may start.
- `pass-with-exception`: owner accepts a documented unavailable check and compensating evidence is recorded.
- `fail`: missing traceability, missing validation, invariant conflict, unresolved sensitive-data risk, or unsupported contract change blocks coding.
