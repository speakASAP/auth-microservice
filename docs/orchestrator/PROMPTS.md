# Auth Goal Prompts

Use these prompts when the owner asks to continue Auth intent-preservation work.

## Universal Session Prompt

Read `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, and `STATUS.md`. Query docs-rag-microservice for the selected Auth topic. Identify the earliest active or pending chunk. Restate the preserved Auth intent and the ownership boundaries affected by the chunk. Implement only that chunk, verify it, append status evidence, and leave the next chunk clearly named.

## Goal 1 Prompt

Implement the next unfinished chunk of "Goal 1 - Admin Token Copy UX And Safety." Keep token URLs stripped, avoid logging or exposing tokens, and let authenticated admins copy the current access token from the admin page.

## Goal 2 Prompt

Implement the next unfinished chunk of "Goal 2 - Auth Intent Preservation Pack." Keep the workflow local to Auth, include DocsRAG lookup, and preserve Auth's ecosystem ownership boundaries.

## Goal 3 Prompt

Implement the next unfinished chunk of "Goal 3 - Unified Auth Contract Recovery." Use DocsRAG and git history to reconcile indexed Auth contract docs with the live repo. Do not invent contract details that cannot be verified.

## Goal 4 Prompt

Implement the next unfinished chunk of "Goal 4 - Auth Observability And Safety Checks." Improve observability only where sensitive values remain redacted and no secret or token can leak into logs.

