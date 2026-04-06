# System: auth-microservice

## Architecture

NestJS backend (port 3370) + Express frontend (port 3372). JWT + bcrypt.

- Endpoints: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/validate`
- RBAC: role-based access control for admin panels

## Integrations

| Dependency | URL |
|-----------|-----|
| database-server | db-server-postgres:5432 |
| logging-microservice | logging-microservice:3367 |
| notifications-microservice | notifications-microservice:3368 (password reset) |

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
- None
