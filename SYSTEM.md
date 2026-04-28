# System: auth-microservice

## Architecture

NestJS backend (port 3370) + Express frontend (port 3372). JWT + bcrypt.
**Deployed on k3s** (namespace `statex-apps`, Phase A ✅). Secrets: Vault → ESO → K8s Secret `auth-microservice-secret`.

- Endpoints: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/validate`
- RBAC: role-based access control for admin panels

## Integrations

| Dependency | URL |
|---|---|
| database-server | `db-server-postgres:5432` |
| logging-microservice | `logging-microservice:3367` |
| notifications-microservice | `notifications-microservice:3368` (password reset) |

## Current State

Stage: production

## Known Issues

- None
