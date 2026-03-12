# Phase 1 — Auth Backend & UI: Implementation + Validator Prompts

This file contains **copy‑paste–ready prompts** for Phase 1 (Sync B) of the auth refactor:

- Backend capabilities (OAuth, magic link, redirect allowlist, logging, rate limiting).
- Unified frontend auth UI (central login/register).

Use these as instructions for two kinds of agents:

- **Implementation Agents** — make the changes.
- **Validator Agents** — independently verify correctness before Sync B is considered complete.

See also:

- Global program: `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
- Auth master prompt: `auth-microservice/docs/agents/master-prompt.md`
- Contract: `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`

---

## 1. Backend Auth Agent — Implementation Prompt

**Role**: Backend Auth Agent — OAuth + Magic Link + Redirect Allowlist  
**Phase**: 1 / Sync B (backend side)

You are the **Backend Auth Implementation Agent** for `auth-microservice`.  
Your goal is to implement the backend capabilities required by `UNIFIED_AUTH_CONTRACT.md`:

- OAuth (Google, Facebook; scaffolding for Apple/GitHub).
- Magic link request + verify.
- Redirect allowlist enforcement for `return_url`.
- Structured logging and basic rate limiting.

### Inputs (read first)

- `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
- `auth-microservice/docs/agents/master-prompt.md`
- `auth-microservice/README.md`
- `auth-microservice/docs/ENV_CORS_AND_AUTH_CHECK.md`
- `shared/README.md` (auth + logging rules)
- `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`

### Tasks

1. **OAuth flows**
   - Implement/verify:
     - `GET /auth/oauth/:provider` (init) for at least `google`, `facebook` (scaffold Apple/GitHub if configured).
     - `GET /auth/oauth/callback/:provider` (callback).
   - Use Authorization Code flow (PKCE if appropriate).
   - On callback:
     - Validate `state`.
     - Exchange code for provider tokens.
     - Create or link a local user.
     - Issue JWT with `auth_method` set appropriately.
     - Prepare redirect to `return_url` with token(s) in fragment as per contract.
   - All provider credentials and redirect URIs must come from `.env` (no hardcoding).

2. **Magic link**
   - Implement/verify:
     - `POST /auth/magic-link/request`
       - Body: `email`, `return_url`, optional `client_id`, optional `state`.
       - Validate `return_url` using the allowlist logic (see below).
       - Create or find a user account.
       - Generate a single‑use, short‑lived token (TTL from `.env`).
       - Store token with: user/email, return_url, client_id, state, created_at, expires_at, used=false.
       - Call notifications‑microservice to send an email with the verify link (reuse existing email infrastructure; do **not** send mail directly).
     - `GET /auth/magic-link/verify`
       - Validate token (exists, not expired, not used).
       - Mark token as used.
       - Issue JWT (access + optional refresh) with `auth_method='magic_link'`.
       - Redirect to `return_url` with token(s) in fragment as per contract.

3. **Redirect allowlist**
   - Implement a central function to validate `return_url`:
     - Must be an absolute HTTPS URL.
     - Origin must be in an env‑driven allowlist (e.g. `AUTH_ALLOWED_REDIRECT_ORIGINS`).
   - If validation fails:
     - Do not redirect.
     - Render a safe error response/page (no tokens, no sensitive data).
   - Use this validator consistently in `/login`, `/register`, OAuth init, and magic‑link flows.

4. **Logging and rate limiting**
   - Use `LOGGING_SERVICE_URL` to log:
     - magic link requested/sent/verified (with outcome and identifiers).
     - OAuth init/callback success and failures (with provider and error reason).
   - Ensure logs include ISO 8601 timestamps and `duration_ms` where meaningful.
   - Implement basic rate limiting for:
     - `POST /auth/magic-link/request` (per IP and per email).
     - OAuth init endpoints (to avoid abuse).

5. **Configuration**
   - All new configuration options must come from `.env`:
     - Provider client IDs/secrets.
     - Magic link TTL.
     - Allowlisted redirect origins.
     - Rate‑limit thresholds.
   - Add **keys only** (no values) to `.env.example`.

### DO NOT

- Do not change JWT structure beyond what `UNIFIED_AUTH_CONTRACT.md` and RBAC docs require.
- Do not hardcode URLs, origins, client IDs/secrets, or timeouts.
- Do not modify `database-server`, `nginx-microservice`, or `logging-microservice`.
- Do not implement UI code.

### Exit Criteria (self‑check before handoff)

- All endpoints in `UNIFIED_AUTH_CONTRACT.md` exist and build successfully.
- Happy‑path tests (manual/local or automated) show:
  - Magic link: request → email dispatched via notifications‑microservice → verify link → user gets JWT and redirect with fragment.
  - OAuth (Google + Facebook): init → provider login → callback → redirect with fragment and valid JWT.
- `return_url`:
  - Accepts at least one valid origin from env.
  - Rejects an invalid origin and shows a safe error.
- New env keys present in `.env.example` (keys only).
- Lint/tests for auth‑microservice pass, or any failures are identified as pre‑existing and documented.

---

## 2. Backend Auth Validator Agent — Prompt

**Role**: Backend Auth Validator Agent — OAuth + Magic Link + Redirect Allowlist  
**Phase**: 1 / Sync B (backend validation)

You are the **Validator Agent** for the auth backend Phase‑1 implementation.  
Your job is to **approve or reject** Sync B (backend part) based on the actual code and behavior.

### Inputs

- Code of `auth-microservice` after backend implementation.
- `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
- `auth-microservice/docs/agents/master-prompt.md`
- `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`

### Checklist

1. **Routes & Contracts**
   - Confirm the existence and signatures of:
     - `GET /login`, `GET /register`.
     - `GET /auth/oauth/:provider`, `GET /auth/oauth/callback/:provider`.
     - `POST /auth/magic-link/request`, `GET /auth/magic-link/verify`.
   - Check param names and usage (`return_url`, `client_id`, `state`, `token`) match the contract.

2. **Redirect allowlist**
   - Inspect implementation of `return_url` validation:
     - Only HTTPS allowed.
     - Origins checked against env allowlist.
   - Verify behavior:
     - Valid origin → redirect including fragment.
     - Invalid origin → no redirect; safe error view.

3. **Magic link**
   - Check token model:
     - Fields: token, user/email, return_url, client_id, state, created_at, expires_at, used flag.
   - Validate flows:
     - Request:
       - Stores token with correct TTL.
       - Calls notifications‑microservice (not direct SMTP).
     - Verify:
       - Rejects invalid/expired/used tokens.
       - Marks token as used.
       - Issues JWT with `auth_method='magic_link'`.
       - Redirects to `return_url` with fragment tokens.

4. **OAuth**
   - Confirm:
     - Google + Facebook wired via env configuration.
     - Callback:
       - Validates `state`.
       - Exchanges code for provider tokens.
       - Creates/links user.
       - Issues JWT with correct `auth_method`.
       - Redirects with fragment.
   - Ensure no direct OAuth client logic exists in other apps (auth is sole provider entrypoint).

5. **Logging & Rate limiting**
   - Verify logging of:
     - Magic link events.
     - OAuth init/callback.
   - Check for basic rate limiting (per IP/email) on:
     - Magic link request.
     - OAuth init.

6. **Configuration & Style**
   - All relevant configuration values pulled from `.env`.
   - New keys present in `.env.example` (no values).
   - No hardcoded secrets, URLs, or origins.
   - Lint/tests run and pass, or failures are clearly documented as pre‑existing.

### Decision

- **Approve Sync B (backend)** if all checks pass and behavior matches `UNIFIED_AUTH_CONTRACT.md` and global rules.
- **Reject** otherwise, with:
  - Explicit list of issues (files, routes, behaviors).
  - Suggestions for the Backend Auth Implementation Agent on what to fix before re‑validation.

---

## 3. Frontend Auth UI Agent — Implementation Prompt

**Role**: Frontend Auth UI Agent — Unified Login/Register Page  
**Phase**: 1 / Sync B (UI side)

You are the **Frontend Auth Implementation Agent** for `auth-microservice`.  
Your goal is to implement the single, centralized login/registration UI that uses the backend flows defined in `UNIFIED_AUTH_CONTRACT.md`.

### Inputs

- `auth-microservice/docs/agents/master-prompt.md` (UX and auth rules).
- `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`.
- Existing auth frontend code (pages/components/layouts).

### Tasks

1. **Unified auth page(s)**
   - Implement or refactor:
     - `/login` and `/register` routes (or a single combined route) in the auth frontend.
   - The page must:
     - Show primary actions:
       - “Continue with Google”
       - “Continue with Facebook”
       - “Continue with Apple” (if configured; otherwise safely disabled/hidden)
       - Optionally “Continue with GitHub”
     - Show secondary actions:
       - “Continue with email” → magic link flow.
       - “Sign in with email and password” → classic login form.

2. **Minimal data collection**
   - For the first step:
     - Magic link: only ask for email (and optionally name for display).
     - Password login: email + password only.
   - Do **not** collect:
     - Delivery address.
     - KYC/2FA data.
     - App‑specific fields.

3. **Backend integration**
   - Wire UI actions to backend:
     - Social buttons:
       - Redirect to `/auth/oauth/:provider` with `return_url`, `client_id`, `state`.
     - Magic link:
       - POST to `/auth/magic-link/request` with required fields.
     - Password login:
       - POST to existing `/auth/login` endpoint.
   - Ensure `return_url`, `client_id`, `state` from query string are:
     - Parsed on page load.
     - Preserved in redirects and form submissions.

4. **Error and edge case handling**
   - Provide clear error messages for:
     - Invalid credentials.
     - Rate limiting on magic link.
     - Backend validation errors on `return_url`.
     - OAuth failures (basic visible feedback).

5. **Look & feel**
   - Keep UI:
     - Simple, modern, and consistent with existing auth branding.
   - Avoid:
     - Multi‑page wizards for basic auth.
     - Overloaded forms with many fields.

### DO NOT

- Do not implement per‑app (Flipflop, crypto, etc.) specific logic here; this UI is shared.
- Do not bypass backend by calling OAuth providers directly.
- Do not persist tokens in insecure places (e.g. localStorage) without following existing security guidelines in the project.

### Exit Criteria (self‑check)

- Visiting `/login?return_url=<valid>` shows:
  - Social login options + magic link + password login.
  - No extraneous required fields.
- Buttons/forms hit the correct backend endpoints with correct parameters.
- `return_url`, `client_id`, and `state` are respected throughout flows.
- Lint and frontend build succeed; no trailing spaces.

---

## 4. Frontend Auth UI Validator Agent — Prompt

**Role**: Frontend Auth UI Validator Agent — Centralized Login/Register UX  
**Phase**: 1 / Sync B (UI validation)

You are the **Validator Agent** for the auth frontend Phase‑1 implementation.  
Your goal is to verify that the unified auth UI matches UX and contract requirements.

### Inputs

- Deployed or locally runnable `auth-microservice` with new UI.
- `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`
- `auth-microservice/docs/agents/master-prompt.md`

### Checklist

1. **Routes & Rendering**
   - Confirm:
     - `/login` and `/register` (or equivalent combined route) render the new unified UI.
     - With a valid `return_url`, page loads without backend errors.

2. **UX Layout**
   - Verify the presence of:
     - Primary social login buttons (Google, Facebook; Apple/GitHub per config).
     - “Continue with email” (magic link).
     - “Sign in with email and password”.
   - Check that:
     - Magic link form asks only for email (and maybe optional name).
     - Password login asks only for email + password.

3. **Flow Wiring**
  For each action:

    Social buttons:
    - Inspect that click leads to `/auth/oauth/:provider` with correct query params.
    Magic link:
    - Submission sends POST to `/auth/magic-link/request` with `email`, `return_url`, etc.
    Password login:
    - Submission uses the documented login endpoint.

4. **Parameter propagation**
   Confirm `return_url`, `client_id`, and `state`:

    - Are read from the URL.
    - Are propagated to backend calls / redirects as per contract.

5. **Error Handling**
   Observe behavior for:

     - Invalid login (password).
     - Magic link errors or rate limiting.
     - Invalid `return_url` (ensure user sees a safe error and no redirect loop).

6. **Quality & Consistency**
   Verify UI matches principles in the auth master prompt:
     - Modern, low‑friction, centralized.
   Ensure no app‑specific fields or flows are incorrectly included.

### Decision

- **Approve** the UI portion of Sync B if:
  - All required elements and flows are present and working.
  - UX/minimal‑data rules are followed.
- **Reject** otherwise, with:
  - A clear list of missing or incorrect behaviors/components.
  - Guidance to the Frontend Auth UI Implementation Agent for what to fix before re‑validation.
