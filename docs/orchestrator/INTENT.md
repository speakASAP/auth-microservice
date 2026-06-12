# Auth Intent Preservation

## Original Intent

Auth is the ecosystem identity and access control service. It must answer: who is the user or service, how did they authenticate, which roles do they have, which registered-user communication preferences and consent flags apply, and whether a caller may access protected resources.

## Intent Preservation Rules

1. One identity works across all ecosystem applications and admin panels.
2. Login and registration belong in Auth; applications consume Auth flows and tokens rather than building separate credential systems.
3. JWT payload compatibility is a contract. Changes to `sub`, `email`, `roles`, token expiry, issuer expectations, or refresh behavior require explicit compatibility planning.
4. RBAC is centralized. Services may enforce roles, but Auth remains the authority for role assignment and token claims.
5. Registered-user preferences and consent flags are Auth-owned; Marketing may read/update through APIs, not direct database writes.
6. Non-registered leads remain Leads-owned, and outbound sending remains Notifications-owned.
7. Secrets never enter source, docs, URLs, frontend logs, or browser-visible configuration.
8. Token UX must be useful for admins without increasing accidental exposure.
9. Every implementation goal must preserve ownership boundaries and record evidence.

## Drift Checks

Before any change, ask:

- Does this strengthen Auth as the identity and access source of truth?
- Does this accidentally move application-specific profile, product, stock, order, payment, lead, marketing, notification, logging, database, or gateway ownership into Auth?
- Does this expose tokens, secrets, passwords, or credentials in logs, URLs, docs, or frontend code?
- Does this preserve existing JWT/RBAC contracts for consuming services?
- Is the change observable and verifiable without direct user-table writes?

## Immutable Intent Boundary

AI agents may clarify, summarize, or link this intent, but must not weaken it. Human owner approval is required before changing:

- Auth's ownership of identity, credentials, token issuance, token validation, RBAC claims, OAuth, magic links, registered-user preferences, consent flags, or internal service-authentication contracts.
- Auth's non-ownership of catalog, warehouse, orders, payment, leads for non-registered contacts, marketing campaign execution, notification sending, logging storage, database infrastructure, and gateway routing.
- The rule that secrets, passwords, JWTs, refresh tokens, OAuth tokens, magic-link tokens, password-reset tokens, and internal-service tokens must not be placed in docs, logs, URLs, frontend bundles, prompts, examples, tests, or reports.

If implementation pressure conflicts with this section, stop coding and record the conflict in `docs/orchestrator/STATUS.md`.
