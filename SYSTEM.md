# System: auth-microservice

## Architecture

NestJS backend (port 3370) + Express frontend (port 3372). JWT + bcrypt.
**Deployed on k3s** (namespace `statex-apps`, Phase A ✅). Secrets: Vault → ESO → K8s Secret `auth-microservice-secret`.

- Public endpoints: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/validate`
- Internal endpoints include `GET /internal/users/:userId/existence`, guarded by the internal service capability and returning only `200 { exists: true, userId }` or `404`; cv-tuning uses it for fail-safe offboarding reconciliation.
- RBAC: role-based access control for admin panels

## Integrations

| Dependency | URL |
|---|---|
| database-server | `db-server-postgres:5432` |
| logging-microservice | `logging-microservice:3367` |
| notifications-microservice | `notifications-microservice:3368` (password reset) |

## Domain events

> ⚠️ **This service currently emits NO domain events.** Verified 2026-07-19: no RabbitMQ client, no `amqp` dependency, no publisher anywhere in `src/`. A successful registration produces a log line (`auth.service.ts:1065`) and nothing more.

### Why this matters beyond auth

Auth is the ecosystem's registration and login authority. Applications delegate to it — `bazos-service`, for example, has no registration backend of its own and redirects to `/register` here (`bazos/services/bazos-service/src/ui/ui.assets.ts:1764`).

Because no event is emitted, **no other service can react to a user registering.** Any feature that needs to know a user signed up must poll, scrape logs, or duplicate the registration flow. Consumers already blocked on this:

| Consumer | Needs |
|---|---|
| `growth` — conversion measurement | registration as the conversion signal for paid-acquisition experiments |
| `growth` — lead creation | trigger for creating a lead record from a registration |
| `marketing-microservice` | onboarding journeys triggered by signup |
| `leads-microservice` | linking a registration to an existing lead |

### Design constraint when events are added

The event must stay **generic**: user id, timestamp, application context, correlation id.

It must **not** carry consumer-specific concepts — no marketing attribution identifiers, no experiment ids, no campaign data. Auth serves every application; embedding one consumer's domain into its events couples all future consumers to that consumer's model, and that is not quietly reversible.

Consumers correlate on their own side.

Proposed shape (not yet implemented):

```
auth.user.registered.v1
  { userId, registeredAt, applicationId?, correlationId }
```

Tracked in `TASKS.md`. First consumer: `growth` slice S5 — see `growth/docs/21_execution_plans/EP-005-landing-and-ingestion.md` §W3.

## Current State

Stage: production

## Known Issues

- None
