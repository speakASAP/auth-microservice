import { readFileSync } from 'fs';
import { join } from 'path';

describe('hosted auth web contract', () => {
  const html = readFileSync(join(process.cwd(), 'web/public/index.html'), 'utf8');

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

  it('requires phone for marathon hosted registration before calling /auth/register', () => {
    expect(html).toContain("clientId === 'marathon'");
    expect(html).toContain('Phone is required for marathon registration.');
    expect(html).toContain('phoneInput.required = isRegister && marathonPhoneRequired');
  });

  it('offers hosted email or phone sign-in code without local consumer forms', () => {
    expect(html).toContain('/auth/contact-code/request');
    expect(html).toContain('/auth/contact-code/verify');
    expect(html).toContain('Send sign-in code');
    expect(html).toContain('Email or phone');
  });
});
