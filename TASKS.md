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

## TASK-AUTH-EVENTS — emit domain events

**Status:** ✅ done 2026-07-21 · **Raised:** 2026-07-19 by `growth` slice S5

`auth.user.registered.v1` is published to the `auth.events` topic exchange (durable, routing key =
event type). Verified on the live service: a registration returned 201 and the event arrived in
`growth.auth-registrations` with the `correlationId` round-tripped from `state`.

**The event is generic and must stay that way.** No `gsid`, no `experimentId`, no `workspaceId` —
growth resolves its own tenancy on consumption. `correlationId` is opaque: round-tripped through
`state`, never interpreted, never stored. Guarded by `src/events/auth-event-publisher.spec.ts`,
which asserts the exact set of emitted keys, and mirrored on the consumer side in growth-core.

**Emitted on proven identity, not on a user row appearing.** This service creates users in five
places and three of them prove nothing:

| Path | Emits | Why |
|---|---|---|
| `POST /auth/register` | ✅ at creation | the person set a credential |
| OAuth callback | ✅ new users only | the provider vouched; an existing user is a login |
| Magic link | ✅ on **verification** | never on request — see below |
| `POST /auth/register-contact` | ❌ | returns `authenticated: false`, `isVerified: false` — a contact form |
| `createMagicLinkToken` | ❌ | internal helper; the verification path emits |

`requestMagicLink` creates a user row for whatever address was typed, before anyone has shown they
can read that inbox. Emitting there would let a typo — or anyone entering a stranger's address —
count as a registration.

`verifyMagicLink` runs on **every** magic-link login, so the event id is derived from the user id
(uuidv5). Repeats collide with the consumer's primary key and are discarded as duplicates. This is
why `isVerified` was left alone — admin listings filter on it.

**Nothing here can break signing up.** The publisher swallows its own failures, and
`emitRegistration()` catches again at the call site so the registration path never depends on that
guarantee.

### ⚠️ Known gap — no outbox

A failed publish is **lost**, not retried. `catalog`/`warehouse`/`orders` use an outbox table; this
service has no migration runner (`DB_SYNC=false`, no migrations directory), so adding one means
solving that first. The failure is logged with the complete envelope so it can be replayed by hand,
and RabbitMQ here is a single-replica StatefulSet, so a broker restart is a real window, not a
theoretical one.

Worth closing before registration volume matters. Until then: after any RabbitMQ downtime, grep the
auth logs for `Failed to publish auth.user.registered.v1` and replay.

**Evidence:** 71 tests before, 92 after, none of the baseline lost. The changed paths had no test
coverage at all beforehand — `src/auth/registration-events.spec.ts` adds it.

See `growth/docs/21_execution_plans/EP-005-landing-and-ingestion.md` §W3.
