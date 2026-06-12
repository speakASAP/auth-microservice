# GOAL-05: Goalkeeper-Style Orchestrator Workflow

```yaml
id: GOAL-05
status: done
owner: orchestrator
completed: 2026-06-12
```

## Intent

Auth should organize implementation work the same way Goalkeeper does: one master orchestrator agent coordinates goals, plans, workers, validation, status, and continuation from repository state.

## Scope

- Add `docs/IMPLEMENTATION_ORCHESTRATOR.md`.
- Add `docs/IMPLEMENTATION_STATE.md`.
- Add `implementation-goals/README.md`.
- Add completed goal files for existing Auth work and a ready goal file for the next backlog item.
- Add execution, context, coding prompt, and validation report templates.
- Update `AGENTS.md` and the existing `docs/orchestrator/*` pack to prefer state-driven continuation.

## Non-Goals

- No runtime Auth behavior changes.
- No production deployment.
- No RBAC consuming-service audit implementation.

## Acceptance Criteria

- Future sessions have a single Auth continuation command.
- The orchestrator can select the next goal from state without asking the owner.
- Completed goals and next ready goal are visible in `docs/IMPLEMENTATION_STATE.md`.
- Templates exist for execution plans, context packages, coding prompts, and validation reports.
- Auth ownership and secret-safety rules remain mandatory.

## Validation Evidence

See `docs/IMPLEMENTATION_STATE.md` and `docs/orchestrator/STATUS.md` entries for 2026-06-12 Goal 05.

## Boundary Check

This documentation-only change strengthens orchestration and does not move any non-Auth ownership into Auth.
