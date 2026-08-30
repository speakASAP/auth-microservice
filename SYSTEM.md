# System: auth-microservice

status: reviewed
completeness_level: complete

## Purpose
Provide the ecosystem identity and access authority through a NestJS backend and Express frontend.

## Responsibilities
Registration, login, tokens, RBAC, OAuth, magic links, password recovery, and registered-user preference ownership.

## Non-Responsibilities
No commerce ownership, notification sending, logging storage, database infrastructure, or gateway ownership.

## Inputs
Client authentication requests, internal user-existence requests, and password-reset requests.

## Outputs
JWT responses, validation decisions, user-existence responses, and notification requests for password resets.

## Dependencies
database-server PostgreSQL and Redis; logging-microservice; notifications-microservice; Vault and ESO secrets.

## Upstream Traceability
BUSINESS.md and docs/UNIFIED_AUTH_CONTRACT.md define intent and endpoint expectations.

## Downstream Artifacts
docs/06_architecture/INTEGRATION_CONTRACT.md and the bootstrap planning chain record adoption.

## Validation Criteria
GET /health and documented endpoint checks validate behavior without revealing credentials.

## Open Questions
No domain events are currently emitted; a generic registration event is separately tracked.
