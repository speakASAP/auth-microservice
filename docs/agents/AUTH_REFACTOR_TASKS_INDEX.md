> **ARCHIVED** — Auth refactoring completed 2026-03-12. See [AUTH_REFACTOR_VALIDATION_REPORT.md](AUTH_REFACTOR_VALIDATION_REPORT.md) for sign-off record. This file is historical only.

---

## Auth Refactor Tasks Index (Phase 0 / Sync A Focus)

This index lists the main **Implementation Agents** and **Validator Agents** for the auth‑microservice refactor, starting with Phase 0 / Sync A.

**Validator report:** `docs/agents/AUTH_REFACTOR_VALIDATION_REPORT.md` (Phase 0 and Phase 1 backend validated 2026-03-12).

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

---

## Phase 1 — Backend Auth Capabilities (Sync B — Backend Side)

### Task Group B1.1 — OAuth Flows (Implementation + Validation)

- **Implementation Agent — Backend Auth Agent (OAuth)**
  - Scope:
    - Implement `GET /auth/oauth/:provider` and `GET /auth/oauth/callback/:provider` for at least `google` and `facebook` (scaffold Apple/GitHub if configured).
    - Use Authorization Code flow; provider client IDs/secrets and redirect URIs must come from `.env`.
    - On callback:
      - Validate `state`.
      - Exchange `code` for provider tokens via `HttpService`.
      - Create or link a local user based on provider email (no duplicate accounts).
      - Issue JWT with `auth_method` set to the provider (`google`, `facebook`, etc.).
      - Redirect to validated `return_url` with tokens in fragment as per `UNIFIED_AUTH_CONTRACT.md`.
    - Add structured logging for OAuth init/callback (success and failures) using `LoggerService`.
    - Implement basic rate limiting for OAuth init endpoints (per IP) using in-memory counters (no new external dependencies).
  - Inputs:
    - `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
    - `auth-microservice/docs/agents/master-prompt.md`
    - `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
  - Exit (Implementation self-check):
    - Endpoints compile and are wired through `AuthModule`.
    - Happy-path test for Google/Facebook in local/dev:
      - `/auth/oauth/:provider` → provider login → `/auth/oauth/callback/:provider` → redirect with fragment containing `access_token`, `refresh_token`, `expires_at`, `state`, `auth_method`.
    - No hardcoded client IDs/secrets or redirect URIs; all come from `.env`.

- **Validator Agent — Backend OAuth Validator**
  - Checks:
    - Routes exist with correct signatures and provider parameter.
    - `return_url`, `client_id`, `state` are accepted and propagated according to contract.
    - `state` is validated; invalid/missing state is rejected safely.
    - Callback:
      - Exchanges `code` for provider tokens.
      - Creates/links user based on provider email.
      - Issues JWT with `auth_method` equal to provider.
      - Redirects using fragment format from `UNIFIED_AUTH_CONTRACT.md`.
    - Logging:
      - OAuth init and callback events are logged with provider, outcome, timestamp, and (where reasonable) `duration_ms`.
    - Rate limiting:
      - Repeated init calls from same IP are limited with clear 429 behavior.

### Task Group B1.2 — Magic Link (Passwordless) Backend (Implementation + Validation)

- **Implementation Agent — Backend Auth Agent (Magic Link)**
  - Scope:
    - Implement:
      - `POST /auth/magic-link/request`
      - `GET /auth/magic-link/verify`
    - Request:
      - Accept body: `email`, `return_url`, optional `client_id`, optional `state`.
      - Validate `return_url` using the allowlist logic (see Task Group B1.3).
      - Create or find user by email (minimal identity only; no extra fields).
      - Generate single-use, short-lived magic-link token; TTL from `.env`.
      - Persist token with: token, user/email, return_url, client_id, state, created_at, expires_at, `used=false`.
      - Call notifications-microservice (existing API) to send an email containing the verify link.
    - Verify:
      - Validate token (exists, not expired, not used).
      - Mark token as used.
      - Issue JWT (access + optional refresh) with `auth_method='magic_link'`.
      - Redirect to validated `return_url` with tokens in fragment as per `UNIFIED_AUTH_CONTRACT.md`.
    - Add structured logging for magic-link requested/sent/verified (success/failure, email, client_id, outcome, timestamps, and useful `duration_ms`).
    - Implement rate limiting for `POST /auth/magic-link/request` (per IP and per email) using in-memory counters.
  - Inputs:
    - `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
    - `auth-microservice/docs/agents/AUTH_PHASE1_IMPLEMENTATION_AND_VALIDATION.md`
    - Existing password reset implementation (reuse patterns where possible).
  - Exit (Implementation self-check):
    - Happy-path test:
      - Request → email dispatched via notifications-microservice → verify link → redirect with valid JWT and fragment tokens.
    - New env keys (TTL, rate limits) added to `.env.example` (keys only).

- **Validator Agent — Magic Link Backend Validator**
  - Checks:
    - Token model fields match contract: token, user/email, return_url, client_id, state, created_at, expires_at, used.
    - Request flow:
      - Valid `return_url` required and validated via central validator.
      - Token stored with correct TTL and `used=false`.
      - Notifications-microservice is called (no direct SMTP).
    - Verify flow:
      - Invalid/expired/used tokens are rejected safely (no redirect to untrusted URL).
      - Valid token → marked used and cannot be reused.
      - JWT includes `auth_method='magic_link'`.
      - Redirect uses fragment contract (`access_token`, `refresh_token`, `expires_at`, `state`, `auth_method`).
    - Logging and rate limiting match requirements.

### Task Group B1.3 — Redirect Allowlist + JWT `auth_method` (Implementation + Validation)

- **Implementation Agent — Redirect Allowlist & Token Shape**
  - Scope:
    - Implement a central function for `return_url` validation:
      - Absolute HTTPS URL only.
      - Origin contained in env-driven allowlist (e.g. `AUTH_ALLOWED_REDIRECT_ORIGINS`).
      - On failure: no redirect; return a safe error response/page with no tokens or sensitive data.
    - Apply this validator consistently to:
      - OAuth init.
      - Magic-link request and verify.
      - (Exposed for frontend `/login`/`/register` later by UI agent).
    - Extend JWT payload to include `auth_method` claim:
      - `password` for existing email+password register/login.
      - `magic_link` for magic-link.
      - Social provider key (`google`, `facebook`, etc.) for OAuth.
    - Ensure refresh tokens preserve original `auth_method`.
    - Add required configuration keys to `.env.example` (keys only), including:
      - `AUTH_ALLOWED_REDIRECT_ORIGINS`
      - Magic-link TTL and rate-limit thresholds.
      - OAuth provider config keys (client IDs/secrets, optional rate limits).
  - Inputs:
    - `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
    - `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
  - Exit (Implementation self-check):
    - `return_url` validator covered by manual or automated checks:
      - Valid origin & HTTPS accepted.
      - HTTP or non-allowlisted origin rejected with safe response.
    - JWTs carry `auth_method` for all new and existing flows, without breaking current consumers.
    - `.env.example` updated; no secrets or values included.

- **Validator Agent — Redirect & Token Contract Validator**
  - Checks:
    - `AUTH_ALLOWED_REDIRECT_ORIGINS` is read from configuration (no hardcoded origins).
    - `return_url` validation used in all new flows (magic-link, OAuth); invalid URLs never receive redirects or tokens.
    - JWTs produced by:
      - `POST /auth/login`
      - Magic-link verify
      - OAuth callback
      include `auth_method` consistent with the login method.
    - No hardcoded secrets, URLs, or timeouts were introduced.

---

## Notes

- Phase 0 / Sync A tasks remain the foundation and must stay approved before Phase 1 work is treated as complete.
- Phase 1 / Sync B backend tasks above follow the Implementation + Validator pattern and are aligned with:
  - `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
  - `auth-microservice/docs/agents/master-prompt.md`
  - `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
  - `auth-microservice/docs/agents/AUTH_PHASE1_IMPLEMENTATION_AND_VALIDATION.md`
