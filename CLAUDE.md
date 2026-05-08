# CLAUDE.md (auth-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## auth-microservice

**Purpose**: Centralized JWT authentication and user management for all Statex services.
**Ports**: 3370 (backend API) · 3372 (frontend)
**Domain**: [https://auth.alfares.cz](https://auth.alfares.cz)
**Stack**: NestJS · PostgreSQL · Redis · bcrypt

### Key constraints

- Never expose or log JWT secrets — K8s Secret `auth-microservice-secret` from Vault via ESO
- Password hashing: bcrypt only — no alternatives
- No direct DB writes to the `users` table by AI agents
- All other services authenticate through this service via JWT

### Infrastructure refs

- **Secrets**: [`../shared/docs/VAULT.md`](../shared/docs/VAULT.md) — path `secret/prod/auth-microservice`
- **Kubernetes**: [`../shared/docs/KUBERNETES_SETUP_GUIDE.md`](../shared/docs/KUBERNETES_SETUP_GUIDE.md) — Phase A ✅
- **Deploy standard**: [`../shared/docs/DEPLOY_STANDARD.md`](../shared/docs/DEPLOY_STANDARD.md)

**Ops**: `curl http://auth-microservice:3370/health` · `kubectl logs -n statex-apps -l app=auth-microservice -f` · `./scripts/deploy.sh`

### Quick ops

```bash
curl http://auth-microservice:3370/health
docker compose logs -f
./scripts/deploy.sh
```
