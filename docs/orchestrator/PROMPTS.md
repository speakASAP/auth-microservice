# Auth Goal Prompts

Use these prompts when the owner asks to continue Auth intent-preservation work.

## Universal Session Prompt

Read `AGENTS.md`, `TASKS.md`, `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `implementation-goals/README.md`, stable Auth contract docs, and all files in `docs/orchestrator/`. If `BUSINESS.md`, `SYSTEM.md`, or `README.md` exist, read them too. Query docs-rag-microservice for the selected Auth topic when ecosystem architecture or contract context is needed. Identify the active checkpoint from `docs/IMPLEMENTATION_STATE.md`; otherwise identify the earliest active or pending chunk. Restate the preserved Auth intent and the ownership boundaries affected by the chunk. Refresh the context package, invariants, execution plan, and pre-coding gate before coding. Implement only that chunk, verify it, update `docs/IMPLEMENTATION_STATE.md`, append status evidence, and leave the next chunk clearly named.

## Goal 1 Prompt

Implement the next unfinished chunk of "Goal 1 - Admin Token Copy UX And Safety." Keep token URLs stripped, avoid logging or exposing tokens, and let authenticated admins copy the current access token from the admin page.

## Goal 2 Prompt

Implement the next unfinished chunk of "Goal 2 - Auth Intent Preservation Pack." Keep the workflow local to Auth, include DocsRAG lookup, and preserve Auth's ecosystem ownership boundaries.

## Goal 3 Prompt

Implement the next unfinished chunk of "Goal 3 - Unified Auth Contract Recovery." Use DocsRAG and git history to reconcile indexed Auth contract docs with the live repo. Do not invent contract details that cannot be verified.

## Goal 4 Prompt

Implement the next unfinished chunk of "Goal 4 - Auth Observability And Safety Checks." Improve observability only where sensitive values remain redacted and no secret or token can leak into logs.

## Goal 5 Prompt

Implement the next unfinished chunk of "Goal 5 - Goalkeeper-Style Orchestrator Workflow." Make Auth continuation state-driven with one master orchestrator, goal roadmap, execution templates, validation evidence, and next-action tracking. Do not change runtime Auth behavior.

## Goal 6 Prompt

Implement the next unfinished chunk of "Goal 6 - RBAC Consuming Services Audit." Query DocsRAG first, audit consumer JWT/RBAC expectations against the unified Auth contract, record evidence, and split remediation into owner-approvable chunks without changing cross-service code unless explicitly approved.

## IPS Compliance Prompt

Update or validate Auth documentation so it complies with the company Intent Preservation System. Preserve the compact service-local mapping in `docs/orchestrator/MASTER_PROMPT.md`; do not introduce broad top-level IPS folders unless the owner asks for a full repository migration. Ensure every future coding chunk has upstream traceability, invariant impact, sensitive-data classification, contract impact, context package, execution plan, pre-coding gate, readiness checks, status evidence, and compressed continuation state.
