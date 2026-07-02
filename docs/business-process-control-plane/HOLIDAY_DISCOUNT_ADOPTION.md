# BPCP Holiday Discount Adoption

Status: service-local adoption contract
Date: 2026-07-02
Service: `auth-microservice`
Central contract pack: `statex-ecosystem/docs/business-process-control-plane/`

## Role

Identity and authorization owner for BPCP admin UI and service-to-service access.

## Responsibilities

- Provide hosted auth/RBAC for visual process editor.
- Provide service identity validation for BPCP adapter calls.
- Keep process definitions out of Auth storage.

## Required interfaces

- Admin roles for view/edit/validate/publish/pause.
- Service identity JWT validation.
- Audit-friendly actor identity.

## Boundaries

- This service must not become the global owner of BPCP process definitions.
- This service must fail closed on invalid or unknown BPCP process versions.
- This service must keep existing domain ownership and invariants.
- This service must expose or document dry-run behavior before live execution.
- This service must not overwrite existing service contracts without an
  explicit integration owner and validation owner.

## Holiday Discount pilot expectations

- Recognize `holiday-discount-2026` only through versioned BPCP contracts.
- Preserve `processId`, `processVersion`, and `policyId` in every relevant
  decision, event, snapshot, log, or rendered experience.
- Support rollback by respecting BPCP pause and retired states.
- Keep process display and process execution separate where applicable.

## Blockers and unknowns

- [MISSING: exact RBAC role names]
- [MISSING: BPCP service identity registration]

## Validation evidence required before implementation is accepted

- RBAC matrix test for view/edit/publish/pause.
- Service identity verification for BPCP calls.
- Hosted auth flow remains the shared auth surface.

## Parallel handoff

This adoption doc is safe for a focused service owner to implement in parallel
after the central BPCP schemas are accepted. The service owner must not edit
shared BPCP schemas directly; schema changes go through the BPCP integration
owner.
