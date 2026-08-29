# Claude Instructions

Shared rules live here:

- Claude profile: `/home/ssf/.claude/CLAUDE.md`
- Shared ecosystem instructions: `/home/ssf/Documents/Github/CLAUDE.md`
- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# CLAUDE.md (auth-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

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

- **Secrets**: `secret/prod/auth-microservice`
- **Kubernetes**: [`../shared/docs/KUBERNETES_SETUP_GUIDE.md`](../shared/docs/KUBERNETES_SETUP_GUIDE.md)
- **Deploy standard**: [`../shared/docs/DEPLOY_STANDARD.md`](../shared/docs/DEPLOY_STANDARD.md)

**Ops**: `curl http://auth-microservice:3370/health` · `kubectl logs -n statex-apps -l app=auth-microservice -f` · `./scripts/deploy.sh`

### Quick ops

```bash
curl http://auth-microservice:3370/health
docker compose logs -f
./scripts/deploy.sh
```
