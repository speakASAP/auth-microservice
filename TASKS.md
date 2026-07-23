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

## TASK-AUTH-RECOVERY — forced password recovery after code login

**Status:** ✅ done 2026-07-23, deployed `967749c` and verified in production · **Raised:** 2026-07-23 by owner

**The bug.** `auth.alfares.cz` offered two independent flows. "Send sign-in code" is a
passwordless login: it issues a JWT and redirects to `return_url` without touching the
password. "Forgot password?" emailed a reset link. A user who had forgotten their password
used the first, reached `catalog.alfares.cz` signed in, and still had no working password.
The code flow carried no notion of recovery intent.

**The fix.** "Forgot password?" now sends a recovery-purpose 6-digit code. Verifying it does
**not** mint application tokens — it mints a single-use grant in `password_reset_tokens`
authorizing exactly one action: set a password. Completing that mints the tokens and performs
the normal handoff to the original `return_url`. Because no application token exists before
the password is set, enforcement needs no cooperation from any consumer, and none changed.

Also fixed: the email-link reset was a dead end that showed success and never used the
`return_url` it threaded through the whole flow.

**One TTL variable.** `AUTH_PASSWORD_RECOVERY_TTL_MINUTES` (default 15) governs the recovery
code, the code-derived grant, and the email-link grant — which drops from 60 minutes to 15.
The value is shown to the user in all four places it applies. The hosted page cannot read
backend env, so the endpoints return `ttlMinutes` and the en/cs/ru strings interpolate it;
nothing states a lifetime as a literal.

### Production rollout — done 2026-07-23

1. `docs/sql/2026-07-23-password-recovery-columns.sql` applied to the production `auth`
   database. 112 existing `magic_link_tokens` rows backfilled to `purpose='login'`; the 13
   existing `password_reset_tokens` rows have `NULL returnUrl` and so take the message-only
   path — nothing in flight broke.
2. `AUTH_PASSWORD_RECOVERY_TTL_MINUTES=15` set and confirmed present in the pod.
3. Deployed `967749c`; both `auth-microservice` and `auth-microservice-web` healthy.
4. Verified end to end against a test account: recovery code → grant → set password →
   handoff to `https://catalog.alfares.cz/orders` with `auth_method=password_recovery` and
   `state` round-tripped. A login-purpose verify rejects a recovery code (401); a replayed
   grant (400) and a reused code (401) both fail; the new password works on normal login.

### Three traps found — two in implementation, one in production

**`configmap_vars` is envsubst's allow-list, not the key list.** The variable was allow-listed
in `deploy.config.sh` but absent from `k8s/configmap.yaml.template`, so it never reached the
pod and silently fell back to the default. Caught by checking `printenv` in the pod rather
than trusting the deploy's success message. Fixed in `08c7281`.

**A failed handoff reported a failed reset.** The password write and the grant burn are
committed before the handoff runs, so a throw there — reproduced with an unregistered
`client_id` — left the user with a changed password, a consumed grant, and a message saying it
failed. Setting the password is the goal and the auto-login is a convenience, so a handoff
failure now degrades to the message-only response. The disallowed-origin test was retargeted
to assert the actual security property (nothing is handed to that origin) rather than that the
call throws, since throwing tells the same lie. Fixed in `967749c`.

### Two traps found during implementation

`contactCodeHash` derives the token deterministically from identifier + code + secret, and
`token` is `UNIQUE`. Without `purpose` in the hash, a login code and a recovery code drawing
the same six digits for the same person collide on insert. `'login'` still produces the
byte-identical legacy string, so codes in flight survive the deploy — pinned by a test.

`src/main.ts:27` is a **second** route list serving the hosted pages under Kubernetes;
`web/server.js:172` serves them under compose. `/set-password` added to only one of them 404s
in the other environment — and the compose-only version passes every test. Both lists are now
asserted together.

**Evidence:** 130 tests before, 138 after. Typecheck by path (never `npx tsc`), `nest build`
clean. The TTL test was verified falsifiable: pinning `resetTtlMinutes` back to `60` makes it
fail.

**Spec:** `docs/superpowers/specs/2026-07-23-forced-password-recovery-design.md`
**Plan:** `docs/superpowers/plans/2026-07-23-forced-password-recovery.md`

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
