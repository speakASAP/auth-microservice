import { readFileSync } from 'fs';
import { join } from 'path';

describe('hosted auth web contract', () => {
  const html = readFileSync(join(process.cwd(), 'web/public/index.html'), 'utf8');
  const profileHtml = readFileSync(join(process.cwd(), 'web/public/profile.html'), 'utf8');
  const profileJs = readFileSync(join(process.cwd(), 'web/public/js/profile.js'), 'utf8');
  const mainTs = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
  const webServer = readFileSync(join(process.cwd(), 'web/server.js'), 'utf8');

  it('posts password login with the central identifier field and client id', () => {
    expect(html).toContain('id="identifier"');
    expect(html).toContain('{ identifier, password, client_id: clientId || undefined, return_url: validatedReturnUrl }');
    expect(html).toContain('client_id: clientId || undefined');
    expect(html).toContain('return_url: validatedReturnUrl');
    expect(html).not.toContain('body: JSON.stringify({ email, password })');
  });

  it('fails closed until return_url validation so native form submit cannot leak credentials', () => {
    expect(html).toContain('<form id="auth-form" onsubmit="return false;">');
    expect(html).toContain('id="submit-btn" type="submit" class="btn" disabled');
    expect(html).toContain('id="magic-link-btn" type="button" class="btn btn-secondary" style="margin-left: 0; width: 100%;" disabled');
    expect(html).toContain('submitBtn.disabled = !isReset && !validatedReturnUrl');
    expect(html).toContain('magicLinkBtn.disabled = !validatedReturnUrl');
    expect(html).toContain('submitBtn.disabled = false;');
    expect(html).toContain('magicLinkBtn.disabled = false;');
  });

  it('offers hosted recovery and contact-code actions', () => {
    expect(html).toContain('/auth/contact-code/request');
    expect(html).toContain('/auth/contact-code/verify');
    expect(html).toContain('/auth/password-reset-request');
    expect(html).toContain('Forgot password?');
  });

  it('supports en/cs/ru hosted UI language via lang param and switcher', () => {
    expect(html).toContain('id="lang-switcher"');
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('data-lang="cs"');
    expect(html).toContain('data-lang="ru"');
    expect(html).toContain('function resolveLang()');
    expect(html).toContain('function applyI18n(lang)');
    expect(html).toContain("const SUPPORTED_LANGS = ['en', 'cs', 'ru']");
    expect(html).toContain('lang: currentLang');
    expect(html).toContain("loginParams.set('lang', currentLang)");
  });

  it('falls back to the browser language and persists the choice across sessions', () => {
    expect(html).toContain('normalizeLang(navigator.language || (navigator.languages && navigator.languages[0]))');
    expect(html).toContain('localStorage.getItem(LANG_STORAGE_KEY)');
    expect(html).toContain('localStorage.setItem(LANG_STORAGE_KEY, currentLang)');
    expect(html).not.toContain('sessionStorage.getItem(LANG_STORAGE_KEY)');
    expect(profileJs).toContain('normalizeLang(navigator.language || (navigator.languages && navigator.languages[0]))');
    expect(profileJs).toContain('localStorage.getItem(LANG_STORAGE_KEY)');
    expect(profileJs).toContain("const LANG_STORAGE_KEY = 'auth_lang'");
  });

  it('localizes known backend error messages at display time without changing the wire format', () => {
    expect(html).toContain('const SERVER_MESSAGES = {');
    expect(html).toContain('function localizeServerMessage(message)');
    expect(html).toContain("'Invalid credentials': 'errInvalidCredentials'");
    expect(html).toContain("'Invalid or expired sign-in code': 'invalidCode'");
    expect(html).toContain('const localized = localizeServerMessage(message)');
    expect(profileJs).toContain('const SERVER_MESSAGES = {');
    expect(profileJs).toContain('data.message.map(localizeServerMessage)');
    expect(profileJs).toContain('localizeServerMessage(data.message || data.error)');
  });

  it('localizes the hosted profile page in en/cs/ru with a switcher', () => {
    expect(profileHtml).toContain('class="lang-switcher"');
    expect(profileHtml).toContain('data-lang="en"');
    expect(profileHtml).toContain('data-lang="cs"');
    expect(profileHtml).toContain('data-lang="ru"');
    expect(profileHtml).toContain('data-i18n="signInToView"');
    expect(profileHtml).toContain('data-i18n="canonicalProfile"');
    expect(profileHtml).toContain('data-i18n-placeholder="tokenPlaceholder"');
    expect(profileJs).toContain("const SUPPORTED_LANGS = ['en', 'cs', 'ru']");
    expect(profileJs).toContain('function applyI18n(lang)');
    expect(profileJs).toContain("document.querySelectorAll('[data-i18n]')");
    expect(profileJs).toContain('lang: currentLang');
  });

  it('serves emailed password reset links from the hosted Auth page', () => {
    expect(mainTs).toContain("['/login', '/register', '/reset-password']");
    expect(webServer).toContain("['/login', '/register', '/reset-password']");
    expect(html).toContain("window.location.pathname === '/reset-password'");
    expect(html).toContain("const resetToken = params.get('token') || ''");
    expect(html).toContain('id="password-row"');
    expect(html).toContain('id="password-confirm"');
    expect(html).toContain("passwordRow.style.display = 'none'");
    expect(html).toContain("passwordConfirmRow.style.display = 'none'");
    expect(html).toContain('/auth/password-reset-confirm');
    expect(html).toContain("identifierInput.required = !isReset");
    expect(html).toContain("if (mode === 'reset')");
    expect(html).toContain("resetLoginAnchor.href = loginParams.toString() ? `/login?${loginParams.toString()}` : '/login'");
    expect(html).not.toContain("Missing required query parameter: return_url");
  });

  it('requires phone for marathon hosted registration before calling /auth/register', () => {
    expect(html).toContain("clientId === 'marathon'");
    expect(html).toContain('Phone is required for marathon registration.');
    expect(html).toContain('phoneInput.required = isRegister && marathonPhoneRequired');
  });

  it('prefills Marathon hosted registration with email and phone in separate fields', () => {
    const registerBranch = html.slice(html.indexOf("if (mode === 'register')"), html.indexOf("return;", html.indexOf("if (mode === 'register')")));
    expect(registerBranch).toContain('identifierInput.value = prefillEmail');
    expect(registerBranch).toContain('phoneInput.value = prefillPhone');
    expect(registerBranch).not.toContain('identifierInput.value = prefillIdentifier');
  });

  it('offers hosted email or phone sign-in code without local consumer forms', () => {
    expect(html).toContain('/auth/contact-code/request');
    expect(html).toContain('/auth/contact-code/verify');
    expect(html).toContain('Send sign-in code');
    expect(html).toContain('Email or phone');
    expect(html).toContain('id="contact-code-row"');
    expect(html).toContain('id="contact-code"');
    expect(html).toContain('autocomplete="one-time-code"');
    expect(html).toContain('id="verify-code-btn"');
    expect(html).toContain('async function verifyContactCode()');
    expect(html).toContain("verifyCodeBtn.addEventListener('click', verifyContactCode)");
    expect(html).toContain('contactCodeInput.focus()');
    expect(html).not.toContain('window.prompt');
  });

  it('serves hosted profile wallet management from the web container', () => {
    expect(webServer).toContain("app.get('/profile'");
    expect(profileHtml).toContain('<script src="/js/profile.js"></script>');
    expect(profileHtml).toContain('id="identifier"');
    expect(profileHtml).toContain('Email or phone');
    expect(profileHtml).toContain('id="canonical-profile-form"');
    expect(profileHtml).toContain('id="delivery-addresses-section"');
    expect(profileHtml).toContain('id="delivery-address-form"');
    expect(profileHtml).toContain('id="invoice-profiles-section"');
    expect(profileHtml).toContain('id="invoice-profile-form"');
    expect(profileHtml).toContain('name="companyId"');
    expect(profileHtml).toContain('name="taxId"');
    expect(profileHtml).toContain('name="vatId"');
  });

  it('uses Auth-owned wallet APIs with bearer auth from hosted profile UI', () => {
    expect(profileJs).toContain("fetchJson('/auth/profile')");
    expect(profileJs).toContain("fetchJson('/auth/profile/checkout-data')");
    expect(profileJs).toContain("'/auth/profile/delivery-addresses'");
    expect(profileJs).toContain("'/auth/profile/invoice-profiles'");
    expect(profileJs).toContain("Authorization: 'Bearer ' + getToken()");
    expect(profileJs).toContain("method: 'PATCH'");
    expect(profileJs).toContain("method: 'POST'");
    expect(profileJs).toContain("method: 'DELETE'");
    expect(profileJs).toContain("history.replaceState(null, '', window.location.pathname + window.location.search)");
    expect(profileJs).toContain("params.get('access_token') || params.get('accessToken')");
    expect(profileJs).toContain("params.get('refresh_token') || params.get('refreshToken')");
    expect(profileJs).toContain("params.has('access_token') || params.has('accessToken') || params.has('refresh_token') || params.has('refreshToken')");
    expect(profileJs).toContain('body: JSON.stringify({ identifier, password })');
    expect(profileJs).not.toContain('body: JSON.stringify({ email, password })');
    expect(profileJs).not.toContain("console.log");
    // Tokens must never touch localStorage; only the UI language key may live there.
    expect(profileJs).toContain("sessionStorage.getItem(STORAGE_ACCESS)");
    expect(profileJs).toContain("sessionStorage.setItem(STORAGE_ACCESS, access)");
    expect(profileJs).not.toContain("localStorage.setItem(STORAGE_ACCESS");
    expect(profileJs).not.toContain("localStorage.setItem(STORAGE_REFRESH");
    expect(profileJs).not.toContain("localStorage.getItem(STORAGE_ACCESS");
    const localStorageUses = profileJs.match(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([A-Z_]+)/g) || [];
    expect(localStorageUses.every((use) => use.includes('LANG_STORAGE_KEY'))).toBe(true);
  });
});
