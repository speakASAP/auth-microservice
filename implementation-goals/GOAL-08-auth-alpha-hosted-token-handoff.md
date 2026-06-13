# GOAL-08: Auth Alpha Hosted Token Handoff URL Normalization

```yaml
id: GOAL-08
status: done
owner: owner-selected
depends_on:
  - GOAL-03
  - GOAL-05
```

## Intent

Normalize Auth-hosted login, OAuth, and magic-link token handoff redirects so Auth reliably returns tokens in exactly one final URL fragment.

## Scope

- Centralize backend OAuth and magic-link token handoff URL construction.
- Update hosted email/password login/register UI to use the same URL-fragment replacement behavior.
- Add focused tests for return URLs that already include caller fragments.
- Preserve Auth endpoint paths, JWT payload shape, OAuth provider behavior, magic-link storage, CORS, and redirect allowlist semantics.

## Non-Goals

- Do not change JWT claim shape.
- Do not change OAuth provider scopes or credentials.
- Do not expand redirect allowlists.
- Do not deploy without explicit owner approval.
- Do not record secrets, JWTs, refresh tokens, magic-link tokens, reset tokens, OAuth tokens, passwords, or production user data.

## Acceptance Criteria

- Login/register, OAuth callback, and magic-link verify handoffs replace any pre-existing caller fragment with Auth's token handoff fragment.
- State handoff remains preserved when supplied.
- Focused unit tests cover fragment replacement and optional fragment fields.
- `npm run build` passes.
