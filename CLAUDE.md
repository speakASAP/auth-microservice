# CLAUDE.md (auth-microservice)

Ecosystem defaults: sibling [`../CLAUDE.md`](../CLAUDE.md) and [`../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md`](../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md).

Read this repo's `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json` first.

---

## auth-microservice

**Purpose**: Centralized JWT authentication and user management for all Statex services.  
**Ports**: 3370 (backend API) · 3372 (frontend)  
**Domain**: https://auth.statex.cz  
**Stack**: NestJS · PostgreSQL · Redis · bcrypt

### Key constraints
- Never expose or log JWT secrets — they live in `.env` only
- Password hashing: bcrypt only — no alternatives
- No direct DB writes to the `users` table by AI agents
- All other services authenticate through this service via JWT

### Quick ops
```bash
curl http://auth-microservice:3370/health
docker compose logs -f
./scripts/deploy.sh
```
