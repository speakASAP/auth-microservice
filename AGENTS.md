# Agents: auth-microservice

## Intent Preservation Workflow (mandatory)

Before implementation work, read the Auth orchestrator pack:

- `docs/orchestrator/MASTER_PROMPT.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/PLAN.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/PROMPTS.md`

Work on the earliest active or pending goal unless the owner explicitly selects another goal. Preserve Auth ownership: identity, login, JWT, refresh tokens, RBAC, OAuth, magic links, registered-user communication preferences, and service authentication boundaries. Do not move catalog, warehouse, orders, payment, lead, marketing, notification sending, logging, database, or gateway ownership into Auth.

Record verification evidence in `docs/orchestrator/STATUS.md` after each completed chunk. If a task needs ecosystem architecture context, query docs-rag-microservice first and summarize the retrieved source headings before editing.

## Knowledge Retrieval (query before reading files)
Query the RAG service first — saves 2000-5000 tokens per query:
- URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Endpoint: `POST /retrieval/agent-context` with `{"query": "...", "maxTokens": 3000}`
- Auth: `Authorization: Bearer <JWT_TOKEN>`

N/A — infrastructure service. No AI agent coordination.

## Active Agents
<!-- Coordinator-maintained -->
None.
