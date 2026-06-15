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

## Knowledge Retrieval — docs-rag-microservice (MANDATORY, query before reading files)

**Query the RAG before reading source files** — saves 2000-5000 tokens per answer.

```bash
kubectl -n statex-apps exec deployment/auth-microservice -- curl -s -X POST http://docs-rag-microservice:3397/retrieval/agent-context \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat ~/.claude/rag-token)" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

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
