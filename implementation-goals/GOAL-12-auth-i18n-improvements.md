# GOAL-12: Hosted Auth i18n follow-up improvements

Follow-up to the EN/CS/RU multilingual release (commit 10e387a). Four improvements, no API/contract breaks.

## Scope

1. **Browser-language fallback** — `resolveLang()` on hosted pages resolves `?lang` → stored choice → `navigator.language` → `en`. First paint matches the visitor's browser locale when no consumer `lang` param is present.
2. **Persist language choice** — `auth_lang` key moves from `sessionStorage` to `localStorage` so the choice survives browser restarts and is shared between hosted login and profile pages. Auth tokens stay in `sessionStorage` (unchanged; spec asserts this precisely).
3. **Localized server error messages** — client-side exact-match map (`SERVER_MESSAGES`) from known English backend messages (e.g. `Invalid credentials`, `User account is inactive`, `Invalid or expired sign-in code`) to i18n keys, applied at display time (`setError` on login page, `formatErrorMessage` on profile page). Unknown messages fall through untranslated. Backend messages are NOT changed — consumers that match on message strings are unaffected.
4. **Hosted profile page localization** — `profile.html`/`profile.js` get the same EN/CS/RU treatment as the login page: `data-i18n` attributes on static text, full dictionary in `profile.js`, in-page EN/CS/RU switcher in both login and profile views, all dynamic statuses/buttons/confirm dialogs localized, and the email-change request now passes `lang` so the confirmation email is localized (DTO already supports it).

## Non-goals

- Server-side localization of NestJS exception messages (would risk consumers matching on messages).
- admin.html localization (internal tooling, EN only).
- Additional languages beyond en/cs/ru.

## Verification

- `npx jest src/auth/hosted-auth-web.spec.ts` — extended i18n assertions (navigator fallback, localStorage lang key, profile i18n, token-storage stays sessionStorage).
- `tsc --noEmit` clean.
- Manual: `/login?lang=ru`, switcher persistence across reload, profile page in cs.
