import { readFileSync } from 'fs';
import { join } from 'path';

describe('hosted auth web contract', () => {
  const html = readFileSync(join(process.cwd(), 'web/public/index.html'), 'utf8');
  const mainTs = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
  const webServer = readFileSync(join(process.cwd(), 'web/server.js'), 'utf8');

  it('posts password login with the central identifier field', () => {
    expect(html).toContain('id="identifier"');
    expect(html).toContain('{ identifier, password }');
    expect(html).not.toContain('body: JSON.stringify({ email, password })');
  });

  it('offers hosted recovery and contact-code actions', () => {
    expect(html).toContain('/auth/contact-code/request');
    expect(html).toContain('/auth/contact-code/verify');
    expect(html).toContain('/auth/password-reset-request');
    expect(html).toContain('Forgot password?');
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
});
