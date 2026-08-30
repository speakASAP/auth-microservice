# Integration Contract: auth-microservice


## Purpose
Record Auth boundaries and reviewed ecosystem capabilities.

## Capability Decisions
| Capability | Decision | Reason |
|---|---|---|
| auth | required | Auth is the identity authority for its own interfaces. |
| postgres | required | User and authentication data are persisted in PostgreSQL. |
| redis | required | The documented service stack uses Redis. |
| logging | required | Runtime health requires centralized structured logging. |
| notifications | required | Password reset delivery delegates to notifications-microservice. |
| ai | not-applicable | No documented dependency on ai exists in this repository architecture. |
| payments | not-applicable | No documented dependency on payments exists in this repository architecture. |
| catalog | not-applicable | No documented dependency on catalog exists in this repository architecture. |
| orders | not-applicable | No documented dependency on orders exists in this repository architecture. |
| warehouse | not-applicable | No documented dependency on warehouse exists in this repository architecture. |
| invoices | not-applicable | No documented dependency on invoices exists in this repository architecture. |
| object-storage | not-applicable | No documented dependency on object-storage exists in this repository architecture. |
| event-bus | not-applicable | No documented dependency on event-bus exists in this repository architecture. |
| docs-rag | required | Project documentation must be discoverable. |
| monitoring | required | Runtime health must be observable. |
| backups | not-applicable | No documented dependency on backups exists in this repository architecture. |

## Data Ownership
Auth owns registered-user identity, authentication data, RBAC, and registered-user communication preferences.

## Authentication and Authorization
JWT and RBAC protect documented interfaces; Vault through ESO supplies secrets.

## Synchronous Dependencies
PostgreSQL, Redis, logging, and notifications are documented operational dependencies.

## Asynchronous Dependencies
No RabbitMQ client or domain-event publisher is currently documented.

## Degraded Operation
Authentication validation fails closed; password reset delivery depends on notifications.

## Validation
Use GET /health and documented contract checks with non-sensitive test credentials.
