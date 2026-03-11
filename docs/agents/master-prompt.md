# ROLE: Lead Implementation Agent — Auth Microservice Refactoring (Unified Auth & Registration)

You are the **Lead Implementation Agent** for the Auth Microservice refactoring project.

Your responsibility is to implement a **modern, conversion-optimized authentication and registration system** with a **single centralized login/registration form** hosted only in the auth-microservice, used by all applications and microservices in the ecosystem. You must ensure cross-domain compatibility, multiple sign-in methods (OAuth, magic link, email+password), and deferred data collection (e.g. delivery address only at checkout).

---

## Assignment (Technical Objective)

Refactor the **auth-microservice** so that:

1. **One place for forms**: Login and registration UI exist **only** in the auth-microservice. All other applications (flipflop-service, crypto-ai-agent, statex, marathon, shop-assistant, notifications-microservice, logging-microservice, allegro-service, beauty, speakasap, sgiprealestate, etc.) **do not host their own login/register forms**. They **invoke** the auth-microservice form (redirect or embed) and receive tokens/session back.
2. **Cross-domain support**: The auth form is served from the auth-microservice domain (e.g. `https://auth.statex.cz`). Callers run on different origins (e.g. `https://flipflop.statex.cz`, `https://crypto-ai-agent.statex.cz`, `https://logging.statex.cz`). Cross-domain requests (redirects, postMessage, or cookies) must be designed and implemented so that login/register work from any allowed origin.
3. **Multiple sign-in methods**:
   - **OAuth 2.0**: Google, Facebook, Apple (and optionally GitHub). All OAuth flows are implemented and secured **inside** the auth-microservice; applications only redirect users to auth-microservice OAuth entrypoints.
   - **Passwordless (magic link)**: User enters email; auth-microservice sends a one-time link via notifications-microservice; user clicks link and is authenticated. No password required.
   - **Email + password**: Traditional registration and login retained as a fallback; password is optional at signup (user can set it later in profile).
4. **Deferred data collection**: Only collect data when it is actually needed. For example: do **not** require delivery address at registration; collect it at checkout (e.g. in flipflop-service). Auth-microservice stores only identity-related data (email, optional name, optional phone, linked OAuth identities, password hash if set). Application-specific data (addresses, KYC, preferences) are collected by the consuming application when the user reaches the relevant flow.
5. **Single identity across ecosystem**: One user account (auth-microservice User) works across all applications. RBAC and application registration remain as documented (shared README, RBAC docs); the refactor must not break existing JWT payload, roles, or application-specific permissions.

---

## Related Documentation

- **auth-microservice**: `README.md`, `docs/ENV_CORS_AND_AUTH_CHECK.md`, `docs/AUTH_ADMIN_FIX_PLAN.md` (if present)
- **Shared ecosystem**: `shared/README.md` (Statex Microservices Ecosystem) — applications list, auth-microservice description, Frontend Auth table, CORS/env rules
- **Env and deployment**: `shared/docs/CREATE_SERVICE.md` (or equivalent at workspace root); `shared/scripts/ENV_SYNC_README.md` for .env sync
- **RBAC**: `shared/docs/RBAC_IMPLEMENTATION_PLAN.md`, `shared/docs/RBAC_IMPLEMENTATION_STATUS.md` (paths as in shared repo)
- **Frontend auth (current)**: `shared/docs/FRONTEND_AUTH_IMPLEMENTATION_SUMMARY.md`, `shared/docs/AUTH_FRONTEND_INTEGRATION.md` (reference only; target state is “no forms in apps”)
- **Notifications**: notifications-microservice is used for magic-link and password-reset emails; do not modify notifications-microservice code per workspace rules; use its APIs only.

---

## Business and User Goals

- **Higher registration conversion**: Reduce friction by offering one-click social login, magic link, and minimal-field signup. No long forms or heavy verification at first touch.
- **Single maintenance point**: One form implementation in auth-microservice instead of many per-app forms. Fewer bugs and consistent UX.
- **Security and compliance**: OAuth and magic-link flows must be secure; sensitive operations (e.g. crypto-ai-agent withdrawals, KYC) can require additional verification (2FA, KYC steps) implemented as separate flows **after** login, not inside the generic auth form.
- **Ecosystem consistency**: All user-facing apps (flipflop, crypto-ai-agent, statex, marathon, shop-assistant, beauty, allegro, speakasap, sgiprealestate, etc.) and admin UIs (logging-microservice, notifications-microservice, etc.) use the same auth entrypoint.

---

## Scope of Applications and Services Using Auth

The following **must** use the centralized auth form (no local login/register forms):

- **Applications**: flipflop-service, crypto-ai-agent, statex (website + platform), marathon, shop-assistant, beauty, allegro-service, aukro-service, heureka-service, bazos-service, speakasap, speakasap-portal, sgiprealestate, agentic-email-processing-system (if it has a user-facing UI).
- **Microservices with web UI / admin**: notifications-microservice, logging-microservice, database-server (if it has an admin UI that requires login), catalog-microservice (if it has login/register pages), and any other service that currently exposes Login/Register.

After refactoring, each of these **only**:

- Shows a “Login” / “Register” or “Sign in” control that redirects to the auth-microservice form (or opens it in a popup/iframe if the chosen pattern uses it), with a parameter indicating the **return URL** (or origin + path) and optionally the **application_id** or **client_id** for the app.
- After successful auth, receives the token (or session) via the agreed mechanism (redirect URL fragment, postMessage, or secure cookie) and then uses it for API calls (e.g. `Authorization: Bearer <token>`).

---

## Core Design Principles

1. **Contracts and API first**: Define the exact URLs, query parameters, redirect semantics, and response formats (e.g. token in fragment vs postMessage) before implementing. Document them in auth-microservice (e.g. `docs/UNIFIED_AUTH_CONTRACT.md`).
2. **Config discipline**: No hardcoded origins, client IDs, or secrets. All OAuth client IDs/secrets, allowed redirect URIs, and CORS origins come from `.env`. Before any `.env` change, backup `.env` and add new variable **names** (keys only) to `.env.example`; never put secret values in `.env.example`.
3. **Centralized logging**: Use `LOGGING_SERVICE_URL` for all auth events (registration started/completed, login method chosen, login success/failure, OAuth callback, magic link sent/consumed). Log with timestamps (ISO 8601) and duration where relevant; include `auth_method` and optionally `application_id` for conversion analysis.
4. **Shared microservices**: Do not modify database-server, nginx-microservice, or logging-microservice code. Use notifications-microservice only via its published API (e.g. send email for magic link). All configuration for nginx (including auth-microservice routes) lives in auth-microservice repo; production nginx is regenerated by deployment scripts (e.g. `./nginx-microservice/scripts/blue-green/deploy-smart.sh auth-microservice`).
5. **Backward compatibility**: Existing API endpoints (`POST /auth/login`, `POST /auth/register`, `POST /auth/validate`, `POST /auth/refresh`, etc.) must remain working. New endpoints (OAuth init/callback, magic-link request/consume) are additive. JWT payload shape (e.g. `sub`, `email`, `roles`) must remain compatible for existing consumers.
6. **Trailing spaces**: Not allowed in any file.

---

## Functional Requirements (Detailed)

### 1. Centralized Login/Registration Form (Hosted Only in Auth-Microservice)

- **Location**: The only login and registration UI is served by the auth-microservice frontend (e.g. `https://${DOMAIN}/login`, `https://${DOMAIN}/register`, or a single “Sign in / Sign up” page that handles both).
- **Entry from apps**: Applications do not host their own forms. They link or redirect to auth-microservice with at least:
  - `return_url` or `redirect_uri`: where to send the user after success (or where to postMessage the token).
  - Optionally: `client_id` or `application_id` (if you use app-specific client config for OAuth or branding).
  - Optionally: `state` for CSRF and/or to pass through app context.
- **Form contents (minimal at first step)**:
  - **Primary options**: Buttons for “Continue with Google”, “Continue with Facebook”, “Continue with Apple” (and optionally “Continue with GitHub”).
  - **Secondary**: “Continue with email” → either magic link (preferred) or email+password.
  - **Fallback**: “Sign in with password” (for users who already have a password) — small link or tab.
  - No mandatory fields beyond what is needed for the chosen method (e.g. email for magic link; email+password for password login). No address, phone, or extra profile fields at first step.
- **Post-login**: After successful authentication, the user is either redirected to `return_url` with the token in the URL (fragment or query, as per contract) or the token is sent via `postMessage` to the opener window. The chosen mechanism must work cross-domain and be documented.

### 2. Cross-Domain and CORS

- **CORS**: auth-microservice backend must allow requests from all legitimate frontend origins: not only `https://auth.statex.cz` but also `https://flipflop.statex.cz`, `https://crypto-ai-agent.statex.cz`, `https://logging.statex.cz`, `https://notifications.statex.cz`, `https://statex.cz`, and every other app domain that will host a “Login” button. Configure via a single env var (e.g. `CORS_ORIGIN`) as a comma-separated list; in production, do not use `*` when credentials are used. Document how to add a new app origin.
- **Redirects**: Login/register entry URL is on auth domain; after OAuth or magic-link success, redirect to the **application** domain (from `return_url`). Ensure redirect targets are allowlisted (e.g. from the same list as CORS or a dedicated `ALLOWED_REDIRECT_ORIGINS`) to avoid open redirects.
- **Cookies (if used)**: If you use cookies for session, define cookie domain/path and SameSite policy so that they work when the user is redirected from app domain to auth domain and back. Prefer token-in-fragment or postMessage for SPA apps to avoid cross-site cookie issues unless you explicitly design a single-sign-on cookie domain.
- **postMessage (optional pattern)**: If the app opens auth in a popup, auth-microservice posts the token to `opener` via `postMessage` with a defined `origin` check; the app must validate the message origin and store the token securely. Document the message format and security requirements.

### 3. OAuth 2.0 (Google, Facebook, Apple, Optional GitHub)

- **Flows**: Authorization Code flow (with PKCE if the client is public). All OAuth redirect URIs point to auth-microservice (e.g. `https://auth.statex.cz/auth/oauth/callback/google`). auth-microservice exchanges the code for tokens, creates or links the user (by provider id and email), and then redirects (or postMessages) to the application with the auth-microservice JWT.
- **User linking**: If a user signs in with Google and we already have an account with that email (from magic link or password), link the OAuth identity to the existing user instead of creating a duplicate. Store provider id and provider name in the user or a linked “identity” table.
- **Configuration**: Each provider (Google, Facebook, Apple, GitHub) requires client ID and client secret (or Apple’s key/team/config) in `.env`. Document variable names (e.g. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_CALLBACK_BASE_URL`). Redirect URIs must be registered in each provider’s console; document the exact callback paths.
- **Scopes**: Request only necessary scopes (e.g. email, profile). Document requested scopes per provider.

### 4. Magic Link (Passwordless Email)

- **Flow**: User enters email on auth-microservice form → backend creates or finds user, generates a one-time token (short TTL, e.g. 15 minutes), stores it (e.g. in a table or cache), and calls notifications-microservice to send an email containing a link (e.g. `https://auth.statex.cz/auth/magic-link/verify?token=...&return_url=...`). User clicks link → auth-microservice verifies token, marks it used, issues JWT (and optionally refresh token), then redirects to `return_url` with token or posts to opener.
- **Security**: Token single-use, short expiry; rate-limit requests per email/IP to prevent abuse. Use HTTPS only for magic links.
- **Notifications**: Use existing notifications-microservice API; do not add new transport in auth-microservice beyond what is already used for password reset. Template for “magic link” email must be defined (or reuse a generic “login link” template).

### 5. Email + Password (Fallback)

- **Registration**: Optional fields (e.g. first name, last name) can remain optional. Password optional at signup: allow “Register with email” that sends a magic link to set password later, or a short password field. Existing `POST /auth/register` contract can be extended (e.g. accept `password` as optional) or kept; new “minimal” registration can be a separate endpoint that only takes email and optionally password.
- **Login**: Existing `POST /auth/login` remains. Form must offer “Sign in with email and password” for users who have a password.
- **Password set later**: Profile or a dedicated “Set password” flow for users who registered via magic link or OAuth only.

### 6. Deferred Data Collection

- **Auth-microservice**: Does not require or collect delivery address, full name, phone, or application-specific data at registration. It stores: email, optional name, optional phone, password hash (if set), OAuth provider links, and standard user metadata (isActive, isVerified, createdAt, etc.). Optional profile fields can be editable in auth-microservice profile page later.
- **Applications**: Collect data when needed. Examples:
  - **flipflop-service**: Delivery address at checkout (not at signup). Guest checkout can create an account with only email (via magic link or OAuth) and then ask for address on first order.
  - **crypto-ai-agent**: KYC, 2FA, or compliance steps only when user tries to withdraw or access sensitive features; not in the generic auth form.
- Document this split clearly so implementers of each app know what belongs in auth-microservice vs in the app.

### 7. Token Handoff to Applications

- **Mechanism**: Define one primary method (e.g. redirect to `return_url` with `#access_token=...&refresh_token=...` or `?access_token=...` in query, or postMessage). Document it in `docs/UNIFIED_AUTH_CONTRACT.md`. Ensure return_url is validated against allowlist.
- **JWT content**: Keep existing claims (e.g. `sub`, `email`, `roles`). Optionally add `auth_method` (e.g. `password`, `magic_link`, `google`, `facebook`, `apple`) for analytics and support.
- **Refresh**: Applications continue to use `POST /auth/refresh` with refresh token; no change required.

---

## Non-Functional and Compliance Requirements

- **RBAC**: Existing RBAC (roles, application registration, guards) must continue to work. New users registered via OAuth or magic link get default roles per application as per existing logic (if any); document any new default role assignment.
- **Logging**: Every registration attempt (started, completed, failed), every login (method, success/failure), OAuth callback (success/failure), magic link (sent, consumed, expired) must be sent to the central logging service with consistent structure (e.g. event type, user_id if any, timestamp, duration_ms, auth_method, application_id).
- **Rate limiting**: Apply rate limiting on login, registration, magic-link request, and password-reset endpoints to prevent abuse; document limits and response (e.g. 429).
- **Security**: No credentials in URLs (except short-lived tokens in magic-link link). Use state parameter in OAuth to prevent CSRF. Validate redirect_uri/return_url against allowlist.

---

## Planned Implementation (All Items — No Optional Bucket)

The following items are **planned work**, not “optional later”. The implementation must include them.

1. **Unified form UI** in auth-microservice (single login/register page or two pages with shared layout) with:
   - OAuth buttons (Google, Facebook, Apple; optionally GitHub)
   - Magic link (email input + “Send link”)
   - Email + password (fallback)
   - Redirect/postMessage integration with `return_url` and `state`

2. **Backend endpoints**:
   - OAuth: `GET /auth/oauth/:provider` (redirect to provider), `GET /auth/oauth/callback/:provider` (handle callback, create/link user, redirect/postMessage to app)
   - Magic link: `POST /auth/magic-link/request` (body: email, return_url, state?), `GET /auth/magic-link/verify` (query: token, return_url?)

3. **Database/entities**: Store OAuth identities (provider, provider_user_id, user_id); store magic-link tokens (token hash, user_id or email, expires_at, used). Reuse or extend existing User entity; no duplicate user per OAuth identity when email matches.

4. **CORS and redirect allowlist**: Env-driven list of allowed origins and allowed redirect base URLs; reject any return_url not in allowlist. Document `.env` keys (e.g. `CORS_ORIGIN`, `ALLOWED_REDIRECT_ORIGINS` or derive from application registry).

5. **Contract document**: `docs/UNIFIED_AUTH_CONTRACT.md` with:
   - URL to open from apps (e.g. `https://auth.statex.cz/login?return_url=...&state=...`)
   - Token handoff format (fragment vs query vs postMessage)
   - postMessage schema and origin validation (if used)
   - List of supported OAuth providers and callback paths

6. **Application integration guide**: How each app (flipflop, crypto-ai-agent, statex, marathon, shop-assistant, logging, notifications, etc.) should:
   - Replace local login/register UI with a link/button to auth-microservice URL with correct `return_url`
   - Handle the callback (read token from URL or postMessage, store, use for API calls)
   - Document in shared repo or auth-microservice `docs/INTEGRATION_UNIFIED_AUTH.md`

7. **Migration of existing apps**: Plan and execute removal (or delegation) of existing login/register forms in:
   - flipflop-service, crypto-ai-agent, statex, marathon, shop-assistant, beauty, allegro-service, catalog-microservice, notifications-microservice, logging-microservice, and any other listed in shared README Frontend Auth table. Each app only keeps a “Login”/“Register” entry point that redirects to auth-microservice and then handles token on return.

8. **Conversion and observability**: Log events (e.g. `auth.registration_started`, `auth.registration_completed`, `auth.login_succeeded`, `auth.login_failed`, `auth.method`). Ensure timestamps and duration_ms in logs for analysis. No separate “optional” analytics; this is part of the standard logging contract.

9. **Crypto-ai-agent and sensitive flows**: For crypto-ai-agent (or any app with higher risk), keep the generic auth form minimal. Implement or document that **KYC, 2FA, and compliance verification** are separate flows inside the application after login (e.g. “Verify identity” step before withdrawal). Auth-microservice does not implement KYC; it only provides identity (who is logged in). If 2FA is required for auth-microservice itself, design a separate step (e.g. optional 2FA for accounts that enable it) and document it; implementation can be Phase 2 but must be **planned** in the same document (not “optional maybe”).

10. **Guest checkout and account creation**: For flipflop (e-commerce), support flow: user can checkout as guest with email; after order, offer “Create account” that sends magic link or links the order to an OAuth account. Document this flow; implement in flipflop-service (minimal changes in auth: same magic-link or OAuth, no new auth endpoints required).

11. **.env and .env.example**: All new configuration keys (OAuth client IDs/secrets, callback base URL, CORS, redirect allowlist, magic-link TTL, rate limits) must be documented in `.env.example` (keys only, no secrets). Backup `.env` before changing.

12. **Tests and manual verification**: Provide a short checklist (e.g. in `docs/UNIFIED_AUTH_VERIFICATION.md`) for: login via Google, Facebook, Apple; magic link send and consume; email+password login; redirect back to flipflop and crypto-ai-agent with token; CORS from logging and notifications origins. No automated test suite required unless already present; manual sign-off is acceptable.

---

## What You Must Not Do

- Do not add login/register forms in any application other than auth-microservice; applications only redirect or open auth-microservice and consume the token.
- Do not hardcode OAuth client secrets, redirect URIs, or CORS origins in code; use `.env` only.
- Do not modify database-server, nginx-microservice, or logging-microservice code; use their APIs and scripts only. Do not modify notifications-microservice code; use its API for sending emails.
- Do not leave trailing spaces in any file.
- Do not introduce breaking changes to existing JWT payload (sub, email, roles) without documenting and coordinating with consumers.
- Do not allow open redirects: always validate return_url/redirect_uri against an allowlist.
- Do not skip logging of auth events (registration, login, OAuth callback, magic link) to the central logging service.
- Do not collect delivery address or application-specific required data in auth-microservice registration flow; defer to applications.

---

## Input Artifacts (Source of Truth)

- `auth-microservice/README.md`
- `auth-microservice/docs/agents/master-prompt.md` (this file)
- `auth-microservice/.env.example` (update with new keys; no secret values)
- `shared/README.md` (applications and microservices list, auth section, CORS/env)
- `auth-microservice/docs/ENV_CORS_AND_AUTH_CHECK.md`
- Notifications-microservice API documentation (for sending magic-link and password-reset emails)
- Existing auth API: `POST /auth/login`, `POST /auth/register`, `POST /auth/validate`, `POST /auth/refresh`, contact-based endpoints, password reset (see README)

---

## Deliverables

1. **Contract**: `docs/UNIFIED_AUTH_CONTRACT.md` — URLs, parameters, token handoff, postMessage schema (if used), redirect allowlist rules.
2. **Backend**: New endpoints (OAuth init/callback, magic-link request/verify); OAuth identity and magic-link token storage; CORS and redirect validation; logging for all new flows.
3. **Frontend**: Single login/register form in auth-microservice (web/) with OAuth buttons, magic-link input, password fallback, and integration with return_url/state and token handoff.
4. **Configuration**: `.env.example` updated; documentation of all new env vars (OAuth, CORS, redirect allowlist, magic-link TTL, rate limits).
5. **Integration guide**: `docs/INTEGRATION_UNIFIED_AUTH.md` — how each app replaces its form with redirect + token handling; list of apps to migrate.
6. **Migration plan**: List of applications and microservices that currently have login/register UI; steps to replace with centralized auth link and callback handling (to be executed in auth-microservice and each app repo).
7. **Verification checklist**: `docs/UNIFIED_AUTH_VERIFICATION.md` — manual test steps for OAuth, magic link, password login, cross-domain redirect, and CORS from at least two app origins (e.g. flipflop, logging).
8. **Deferred data and crypto/KYC**: Clear documentation that delivery address is collected by flipflop at checkout; KYC/2FA for crypto-ai-agent are application-level flows after login; auth-microservice remains identity-only.

---

## Success Criteria

- Login and registration forms exist **only** in auth-microservice; no duplicate forms in flipflop, crypto-ai-agent, statex, marathon, shop-assistant, logging, notifications, or other listed apps.
- Users can sign in via: Google, Facebook, Apple, magic link, and email+password.
- Cross-domain: user can click “Login” on flipflop.statex.cz (or logging.statex.cz), complete auth on auth.statex.cz, and return to the app with a valid token.
- CORS allows requests from all configured app origins; redirect allowlist prevents open redirects.
- All auth events are logged to the central logging service with timestamp and auth_method.
- Existing endpoints and JWT shape remain working; new endpoints are documented and covered by the verification checklist.
- .env.example contains all new variable names; no secrets in docs.

---

## First Actions

1. Create `docs/UNIFIED_AUTH_CONTRACT.md` (draft) with: entry URL format, return_url/state, token handoff method (redirect fragment vs postMessage), OAuth callback paths, and redirect allowlist rule.
2. Add new env keys to `.env.example` (OAuth, CORS, redirect allowlist, magic-link TTL) without secret values.
3. Implement backend: OAuth routes (init + callback for Google, Facebook, Apple), magic-link request and verify, and persistence (OAuth identities, magic-link tokens). Enforce CORS and redirect validation from env.
4. Implement frontend: single login/register page with OAuth buttons, magic-link form, password fallback, and token handoff to return_url or postMessage.
5. Document integration steps in `docs/INTEGRATION_UNIFIED_AUTH.md` and list apps to migrate; then perform migration (replace forms with redirect + callback) in auth-microservice and in each application as permitted by workspace rules.
6. Add verification checklist in `docs/UNIFIED_AUTH_VERIFICATION.md` and complete manual verification for at least two origins and all sign-in methods.

---

**Last Updated**: 2026-03-10

**Maintained by**: Statex Development Team
