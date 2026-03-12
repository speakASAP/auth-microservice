## Auth Refactor Tasks Index (Phase 0 / Sync A Focus)

This index lists the main **Implementation Agents** and **Validator Agents** for the auth‑microservice refactor, starting with Phase 0 / Sync A.

See:

- Global program: `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
- Auth master prompt: `auth-microservice/docs/agents/master-prompt.md`

---

## Phase 0 — Contracts & UX Blueprint (Sync A)

### Task Group A0.1 — Unified Auth Contract Draft

- **Implementation Agent**
  - Role: `Auth Unified Contract Implementer`
  - Scope:
    - Create and maintain `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`.
    - Define entry URLs, parameters, token handoff, redirect allowlist rules, JWT shape.
  - Inputs:
    - `auth-microservice/docs/agents/master-prompt.md`
    - `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
    - `shared/docs/AUTH_FRONTEND_INTEGRATION.md`
  - Outputs:
    - Completed `UNIFIED_AUTH_CONTRACT.md` as a single source of truth.

- **Validator Agent**
  - Role: `Auth Unified Contract Validator`
  - Checks:
    - Contract file exists and is referenced from the auth master prompt.
    - Entry URLs, query params, and token handoff are unambiguous and compatible with SPA apps.
    - JWT claims align with RBAC docs and existing consumers.
    - No contradiction with `shared/README.md` or global master prompt.
  - Exit:
    - Approve Sync A (auth side) or report issues back to A0.1 implementer.

### Task Group A0.2 — Login/Registration UX Blueprint

- **Implementation Agent**
  - Role: `Auth UX Blueprint Implementer`
  - Scope:
    - Define a short UX spec (within the auth master prompt or a small UX doc) describing:
      - Primary vs secondary login options (OAuth, magic link, password).
      - Minimal data collected at first contact.
  - Inputs:
    - Auth master prompt.
  - Outputs:
    - Clear, concise UX description referenced from `UNIFIED_AUTH_CONTRACT.md` and the master prompt.

- **Validator Agent**
  - Role: `Auth UX Blueprint Validator`
  - Checks:
    - UX spec exists and matches business goals (low friction, deferred data collection).
    - No conflicting requirements in app prompts.

---

## Next Phases

Further phases (backend capabilities, unified UI, app integrations) must also define Implementation + Validator agents following the patterns above, but are out of scope for Phase 0 / Sync A.

