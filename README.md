# Auth Microservice

Centralized JWT authentication and user management for all Statex services.

> ⚠️ **Production service** — do not modify directly. Ask for permission first.

## Quick Reference

|---|---|
| Backend API | port 3370 · `http://auth-microservice:3370` |
| Frontend | port 3372 · `https://auth.alfares.cz` |
| Stack | NestJS · PostgreSQL · Redis · bcrypt |
| Health | `curl http://auth-microservice:3370/health` |
| Deploy | `./scripts/deploy.sh` |
| Logs | `kubectl logs -n statex-apps -l app=auth-microservice -f` |

## API Contract

→ [`docs/UNIFIED_AUTH_CONTRACT.md`](docs/UNIFIED_AUTH_CONTRACT.md) — all endpoints, JWT shape, OAuth, magic link, redirect allowlist.

## Features

- User registration / login (email+password and contact-based)
- JWT tokens (access + refresh), token validation
- Password reset via notifications-microservice
- RBAC, OAuth, magic link
- Admin panel at `/admin` · create test user: `./scripts/create-test-user.sh`
- Marketing preference ownership for registered users (preferred channel, fallback channels, consent/unsubscribe fields)

## Marketing Preferences Ownership

- Auth is the source of truth for registered-user communication preferences and consent flags.
- Marketing-microservice may read/update those fields only through auth APIs; no direct DB ownership bypass.
- Leads-microservice remains the source of truth for non-registered contacts.
- Notifications-microservice remains the only outbound sending layer.

## Infrastructure

- **K8s**: Running on k3s · namespace `statex-apps` · Phase A ✅
- **Secrets**: Vault → ESO → K8s Secret `auth-microservice-secret` → pod env
  See `secret/prod/auth-microservice`
- **Blue/green ports**: backend 3370/3371 · frontend 3372/3373
- **Constraints**: → [`BUSINESS.md`](BUSINESS.md) · bcrypt only · never log JWT secrets · no direct DB writes by AI

## Integrations

| Dependency | Internal URL |
|---|---|
| database-server | `db-server-postgres:5432` |
| logging-microservice | `logging-microservice:3367` |
| notifications-microservice | `notifications-microservice:3368` |
