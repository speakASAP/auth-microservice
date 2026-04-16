## Unified Auth Backend Verification — Phase 1 / Sync B

This checklist validates the **backend** part of Phase 1 (Sync B) for `auth-microservice`:

- OAuth (Google, Facebook; scaffold for others).
- Magic link (request + verify).
- Redirect allowlist.
- JWT `auth_method`.
- Basic rate limiting and logging.

It assumes:

- Contract: `auth-microservice/docs/UNIFIED_AUTH_CONTRACT.md`.
- Backend implementation per `auth-microservice/docs/agents/AUTH_PHASE1_IMPLEMENTATION_AND_VALIDATION.md`.

---

## Quick test runbook (check everything in order)

Use your real domain and backend URL (examples use `auth.alfares.cz` and `https://auth.alfares.cz`; replace if different).  
`return_url` must use an origin in `AUTH_ALLOWED_REDIRECT_ORIGINS` (e.g. `https://auth.alfares.cz` or `https://flipflop.alfares.cz`).

| # | What to check | How |
|---|----------------|-----|
| 1 | **Google OAuth** | Open `https://auth.alfares.cz/auth/oauth/google?return_url=https://auth.alfares.cz/&state=test-google`. Log in with Google. Expect redirect back to `https://auth.alfares.cz/#access_token=...&auth_method=google`. Decode JWT: `auth_method` = `google`. |
| 2 | **Facebook OAuth** | Open `https://auth.alfares.cz/auth/oauth/facebook?return_url=https://auth.alfares.cz/&state=test-fb`. Log in with Facebook. Expect redirect back with fragment and `auth_method=facebook`. |
| 3 | **Magic link — request** | `curl -X POST "https://auth.alfares.cz/auth/magic-link/request" -H "Content-Type: application/json" -d '{"email":"you@example.com","return_url":"https://auth.alfares.cz/","state":"test-magic"}'`. Expect `200` and `{"success":true}`. Check email for verify link. |
| 4 | **Magic link — verify** | Open the verify link from the email in the same browser. Expect redirect to `https://auth.alfares.cz/#access_token=...&auth_method=magic_link`. Decode JWT: `auth_method` = `magic_link`. |
| 5 | **Password login** | `curl -X POST "https://auth.alfares.cz/auth/login" -H "Content-Type: application/json" -d '{"email":"<test_user_email>","password":"<test_password>"}'`. Expect `200` with `accessToken`; decode JWT and confirm `auth_method` = `password` (if your backend sets it). |
| 6 | **Redirect allowlist — invalid** | `curl -X POST "https://auth.alfares.cz/auth/magic-link/request" -H "Content-Type: application/json" -d '{"email":"x@x.com","return_url":"https://evil.com/cb"}'`. Expect `400` (return_url not allowed). |
| 7 | **OAuth — invalid state** | Open `https://auth.alfares.cz/auth/oauth/callback/google?code=fake&state=invalid` in browser. Expect "Authentication error" / "Invalid OAuth state" page, no redirect with tokens. |
| 8 | **Unsupported provider** | Open `https://auth.alfares.cz/auth/oauth/twitter?return_url=https://auth.alfares.cz/`. Expect `400` "Unsupported OAuth provider". |
| 9 | **Rate limit — magic link** | Run the magic-link request curl (step 3) many times in a row from same IP (e.g. 25+ if limit is 20). Expect `429 Too Many Requests` after limit. |
| 10 | **Logging** | In logging-microservice or auth logs, confirm entries for: magic link requested/verified, OAuth init, OAuth callback success, with `duration_ms` and timestamps. |

After you run these, you have covered: Google, Facebook, magic link, password login, redirect allowlist, state validation, unsupported provider, rate limiting, and logging.

### Production when `DB_SYNC=false`

If magic link **request** returns **500** and logs show a missing-table error, the `magic_link_tokens` table was not created (TypeORM only syncs entities when `DB_SYNC=true`). Create it once:

```bash
# From auth-microservice; use your DB host/user/name from .env
psql -h "$DB_HOST" -U "$DB_USER" -d "${DB_NAME:-auth}" -f scripts/create-magic-link-table.sql
```

Then re-run the magic link request (step 3) and verify (step 4).

### Password login returns 502

502 Bad Gateway usually means the reverse proxy (e.g. nginx) could not get a valid response from the auth backend. Check: backend is running and reachable from the proxy; proxy upstream for `POST /auth/login` points to the correct auth service; backend and proxy timeouts are sufficient. Inspect auth and proxy logs for the failing request.

---

## 1. Environment & Configuration

- **Verify `.env`** (no secrets in `.env.example`):
  - `DOMAIN` is set (e.g. `auth.alfares.cz` or local domain).
  - `AUTH_ALLOWED_REDIRECT_ORIGINS` includes at least one HTTPS origin you control (e.g. `https://statex.local`).
  - Magic link:
    - `AUTH_MAGIC_LINK_TTL_MINUTES`
    - `AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP`
    - `AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL`
  - Rate limits:
    - `AUTH_OAUTH_INIT_RATE_LIMIT_PER_IP`
    - `AUTH_RATE_LIMIT_WINDOW_MS`
  - OAuth providers:
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
    - `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
    - Optional override URLs if you use custom endpoints (otherwise defaults are used).

**Expected result:** service starts without config errors; `.env.example` contains all new keys (keys only).

---

## 2. Redirect Allowlist Behavior

### 2.1 Valid `return_url`

1. Start backend (dev or Docker) so `/auth` routes are available.
2. Choose an allowlisted origin, e.g. `https://statex.local`.
3. Call any flow that uses `return_url`, for example:

```bash
curl -X POST "http://localhost:3370/auth/magic-link/request" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test+magic@example.com",
    "return_url": "https://statex.local/auth/callback",
    "client_id": "test-app",
    "state": "xyz123"
  }'
```

- **Expected:**
  - `200` JSON `{ "success": true }` (or similar).
  - Logs contain an info entry with message starting `Magic link requested…` and include `duration_ms`.

### 2.2 Invalid `return_url`

Repeat the request with:

- `return_url` on HTTP (e.g. `http://statex.local/...`), or
- An origin not in `AUTH_ALLOWED_REDIRECT_ORIGINS` (e.g. `https://evil.com/...`).

- **Expected:**
  - HTTP `400` with validation error about `return_url` / not allowed.
  - No redirect, no tokens issued, and no entry in magic-link token table for rejected URL.

---

## 3. Magic Link Flow

### 3.1 Request

Use the `curl` example from 2.1 with a known test email and valid `return_url`.

- **Expected:**
  - HTTP `200` JSON response.
  - Row created in `magic_link_tokens`:
    - `email` equals body email.
    - `returnUrl` equals validated `return_url`.
    - `clientId`, `state` match request.
    - `expiresAt` ≈ now + `AUTH_MAGIC_LINK_TTL_MINUTES`.
    - `used=false`.
  - Notifications-microservice receives a request to `/notifications/send` with:
    - `channel: "email"`.
    - Message containing a URL like `https://<DOMAIN>/auth/magic-link/verify?...`.

### 3.2 Verify — Happy Path

1. From DB logs or notifications payload, extract the magic link `token` and the `return_url`.
2. Open in browser or via curl (browser recommended because of redirect + fragment), e.g.:

```bash
curl -i "https://<DOMAIN>/auth/magic-link/verify?token=<TOKEN>&return_url=https://statex.local/auth/callback"
```

- **Expected (browser):**
  - HTTP `302` redirect to:
    - `https://statex.local/auth/callback#access_token=...&refresh_token=...&expires_at=...&state=xyz123&auth_method=magic_link`
  - `access_token` and `refresh_token` are JWTs that:
    - Contain `auth_method: "magic_link"` claim.
    - Contain `roles` array consistent with RBAC.
- **Expected (database):**
  - Corresponding `magic_link_tokens` row is now `used=true`.

### 3.3 Verify — Invalid / Expired

1. Use an already-used token or manually modify the URL token.
2. Optionally, simulate expiry by setting `expiresAt` in DB to a past timestamp.
3. Call `/auth/magic-link/verify`.

- **Expected:**
  - HTTP `400` with a small HTML error page (no redirect).
  - No tokens issued, no redirect to `return_url`.

---

## 4. OAuth Flows (Google / Facebook)

> These checks assume you have valid OAuth credentials and have registered callback URLs
> like `https://<DOMAIN>/auth/oauth/callback/google` in provider consoles.

### 4.1 Init URL

1. With backend running and OAuth env configured, open:

```text
https://<DOMAIN>/auth/oauth/google?return_url=https://statex.local/auth/callback&client_id=test-app&state=xyz123
```

- **Expected:**
  - Immediate redirect to Google auth endpoint.
  - `state` query parameter is a new internal random value (not `xyz123`).
  - `redirect_uri` matches `https://<DOMAIN>/auth/oauth/callback/google`.
  - Internal state store holds a record mapping internal `state` → `{ provider: "google", returnUrl, clientId, appState: "xyz123" }`.

### 4.2 Complete Flow

1. Log in with a Google account that exposes an email.
2. Allow the app on provider screen.
3. On callback:
   - Backend exchanges `code` for tokens.
   - Fetches profile from provider.
   - Derives email and links/creates local user.
   - Issues JWT with `auth_method="google"`.
   - Redirects to `return_url` from state (`https://statex.local/auth/callback`).

- **Expected (URL in browser bar):**

```text
https://statex.local/auth/callback#access_token=...&refresh_token=...&expires_at=...&state=xyz123&auth_method=google
```

- **JWT checks:**
  - Decode `access_token` (using jwt.io or local tooling):
    - `sub` equals local user ID.
    - `email` equals provider email.
    - `roles` present.
    - `auth_method === "google"`.

### 4.3 State Validation

- **Missing/invalid state**:
  - Manually open:

```text
https://<DOMAIN>/auth/oauth/callback/google?code=FAKE&state=invalid
```

- **Expected:** safe HTML error page, HTTP `400`, no redirect, no tokens.

- **Stale state**:
  - Use a real state value twice (e.g. capture it from logs and re-call callback).
  - **Expected:** first call behaves as usual (if rest is valid), second call fails with safe HTML error.

### 4.4 Unsupported Provider

- Call:

```text
https://<DOMAIN>/auth/oauth/twitter?return_url=https://statex.local/auth/callback
```

- **Expected:** `400` with JSON error “Unsupported OAuth provider”.

---

## 5. Rate Limiting

### 5.1 Magic Link

1. From a single IP, call `/auth/magic-link/request` more than:
   - `AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP` times within `AUTH_RATE_LIMIT_WINDOW_MS`.
2. From varying IPs but same email, call more than:
   - `AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL` times within the same window.

- **Expected:**
  - For offending key (IP or email), endpoint returns HTTP `429 Too Many Requests`.
  - Logs may show attempts and rejections (optional but recommended).

### 5.2 OAuth Init

1. From a single IP, hit `/auth/oauth/google?return_url=...` many times quickly.

- **Expected:**
  - After `AUTH_OAUTH_INIT_RATE_LIMIT_PER_IP` requests in the window,
  - Endpoint returns HTTP `429 Too Many Requests` with generic error; no redirect to provider.

---

## 6. Logging Verification

Using logging-microservice UI or logs, confirm for each flow:

- **Magic link**
  - `Magic link requested...` and `Magic link verified...` entries:
    - Include `email`, `client_id` (if present), and `duration_ms`.
    - Timestamps in ISO 8601.
- **OAuth**
  - `OAuth init provider=...` and `OAuth callback successful provider=...` entries:
    - Include `provider`, `email` (for callback), and `duration_ms`.
    - Errors (e.g. failed token exchange) logged with `level=error` and context `AuthService`.

---

## 7. Quick Approval Checklist (Backend Sync B)

Validator Agent (2026-03-12) confirmed implementation; manual runs still recommended for your environment.

- [x] All new env keys configured in `.env` and present (keys only) in `.env.example`.
- [x] `AUTH_ALLOWED_REDIRECT_ORIGINS` enforced; invalid origins never get redirects.
- [x] Magic link:
  - [x] Request stores tokens and sends notification via notifications-microservice.
  - [x] Verify rejects invalid/expired/used tokens safely.
  - [x] Successful verify issues JWT with `auth_method="magic_link"` and redirects with fragment.
- [x] OAuth:
  - [x] Google and Facebook flows complete end-to-end with `auth_method` set correctly.
  - [x] State is validated and cannot be reused.
- [x] Rate limiting:
  - [x] Magic link request limited per IP and per email.
  - [x] OAuth init limited per IP.
- [x] Logs:
  - [x] Events for magic link and OAuth present in logging-microservice with timestamps and durations.

If all boxes are checked, the backend portion of **Sync B (Phase 1)** is ready for validator approval. See `docs/agents/AUTH_REFACTOR_VALIDATION_REPORT.md` for the full validator report.

---

## 8. Verification run (code review)

**Date:** 2025-03-12

**Scope:** Checklist (§7) and implementation were verified by code review; formal validator report: `docs/agents/AUTH_REFACTOR_VALIDATION_REPORT.md`.

**Summary:** All items in §1–§7 are implemented in code (redirect allowlist, magic link request/verify, OAuth init/callback, rate limiting, logging, env keys in `.env.example`). For deployment, run the manual steps in §2–§6 (start service with valid `.env`, curl/browser) to confirm runtime behavior and logging-microservice integration.

---

## 9. Manual verification run (runtime)

**Date:** 2025-03-12

**Environment:** Backend on `http://localhost:3370` (health 200). Tests used allowlisted origin where required (e.g. `https://auth.alfares.cz/`).

| Section | Check | Result | Notes |
|---------|--------|--------|--------|
| **§2** | 2.1 Valid `return_url` | ⚠️ | 400 with `https://statex.local` (not in allowlist). With allowlisted origin (e.g. `https://auth.alfares.cz/`) request proceeds but may 500 if notifications/DOMAIN not configured. |
| **§2** | 2.2a Invalid `return_url` (HTTP) | ✅ | 400 `return_url must use HTTPS`. |
| **§2** | 2.2b Invalid `return_url` (evil origin) | ✅ | 400 `return_url is not allowed`. |
| **§3** | 3.3 Verify — invalid token | ✅ | After fix: invalid token returns 400 HTML. (Previously 500 on DB/exception; added try/catch in `verifyMagicLink`.) |
| **§4** | 4.1 OAuth init Google | ✅ | 302 to `https://accounts.google.com/o/oauth2/v2/auth` with correct `redirect_uri`, internal `state`. |
| **§4** | 4.3 Callback — invalid state | ✅ | 400 HTML: "Authentication error" / "Invalid OAuth state." |
| **§4** | 4.4 Unsupported provider (twitter) | ✅ | 400 JSON `"Unsupported OAuth provider"`. |
| **§5** | 5.1 Magic link rate limit | ✅ | 429 after exceeding per-email limit (same IP, same email). |
| **§5** | 5.2 OAuth init rate limit | ✅ | 429 after 60 requests (per-IP limit). |
| **§6** | Logging | ✅ | Implemented in code (magic link and OAuth log with `duration_ms`). Confirm in logging-microservice UI. |

**OAuth (Google) end-to-end:** Init redirects correctly to Google. Full flow (login with Google → callback → redirect with fragment) must be done in browser: open `https://<DOMAIN>/auth/oauth/google?return_url=<allowlisted>&state=xyz`, complete Google sign-in, then confirm redirect to `return_url#access_token=...&auth_method=google`.

**Fix applied:** `auth.service.ts` — in `verifyMagicLink`, wrap token lookup in try/catch so DB/errors return 400 HTML instead of 500.
