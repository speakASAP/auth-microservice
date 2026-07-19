# Tasks: auth-microservice

## Backlog

- Goal 10.1 Auth customer data wallet schema migration path decision and implementation plan (priority: 2)
- Goal 10.2 Auth delivery address book and invoice profile API implementation after schema path is approved (priority: 2)
- Goal 10 consumer rollout: FlipFlop first, then Orders compatibility, Rent-a-box plan, Chytrakoupe plan, Cliplot gated plan, marketplace audit (priority: 3)

## Completed

- Added admin access-token copy UX without requiring token reveal
- Added Auth intent preservation orchestrator pack under `docs/orchestrator/`
- Deployed Auth frontend/backend and verified DocsRAG ingestion for the orchestrator pack
- Recovered and reconciled historical unified Auth contract docs referenced by DocsRAG
- Added Auth observability and redaction safeguards for sensitive auth flows
- Audited RBAC roles across consuming services
- Completed `RBAC-REM-01` secret-source alignment review and manifest remediation for direct JWT consumers
- Completed `RBAC-REM-02` consumer JWT validation standardization
- Completed `RBAC-REM-03` Catalog frontend role-aware admin guard and stale comment cleanup
- Completed `RBAC-REM-04` SpeakASAP scoped-role normalization review
- Completed `RBAC-REM-05` School Committee local-role contract note
- Completed `RBAC-REM-06` internal service-token/API-key bypass inventory and Auth boundary review
- Completed `RBAC-REM-07` Logging admin role-enforcement verification
- Completed `AUTH-ALPHA-01` hosted token handoff URL normalization
- Completed Goal 09 Auth contract production smoke verification after AUTH-ALPHA-01 and RBAC-REM-07 deployment
- Source-validated Goal 11 first-visit application access assignment for hosted Auth client_id flows

## Project Completion Marker

- 2026-06-21: Project marked completed/frozen after remote inventory. There are no active goals, active plans, open tasks, blockers, or pending human/AI actions. Do not ask for a new goal during routine status checks unless the owner explicitly creates one.

## TASK-AUTH-EVENTS — emit domain events (currently emits none)

**Status:** open · **Raised:** 2026-07-19 by `growth` slice S5 · **Priority:** blocks growth MS-002

Auth emits no domain events at all — verified, no RabbitMQ/amqp/publisher in `src/`. Registration produces only a log line.

**Deliverable:** `auth.user.registered.v1` on successful registration, published to RabbitMQ using the outbox pattern already proven in `catalog`, `warehouse` and `orders`.

**Hard constraint:** the event stays generic — `{ userId, registeredAt, applicationId?, correlationId }`. No consumer-specific fields. Auth serves the whole ecosystem; embedding one consumer's domain model into its events couples every future consumer to it.

**Risk:** shared infrastructure. A regression breaks login for every application. Requires full regression evidence and should not be a cold agent's first task.

**Blast radius limit:** changes confined to `src/auth/**` and a new `src/events/**`. Do not touch `src/{admin,roles,users,applications}/**`.

See `growth/docs/21_execution_plans/EP-005-landing-and-ingestion.md` §W3.
