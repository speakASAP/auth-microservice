import { AuthService } from './auth.service';

describe('Auth token handoff URL construction', () => {
  function serviceWithExpiry(exp?: number) {
    const service: any = Object.create(AuthService.prototype);
    service.jwtService = {
      decode: jest.fn(() => (exp ? { exp } : null)),
    };
    return service;
  }

  it('replaces a caller fragment with the Auth token handoff fragment', () => {
    const service = serviceWithExpiry(1760000000);

    const redirectUrl = service.buildTokenHandoffUrl(
      'https://app.example.test/callback?tab=login#caller-fragment',
      { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' },
      'magic_link',
      'caller-state',
    );

    const parsed = new URL(redirectUrl);
    const fragment = new URLSearchParams(parsed.hash.slice(1));

    expect(parsed.origin + parsed.pathname + parsed.search).toBe('https://app.example.test/callback?tab=login');
    expect(parsed.hash).not.toContain('caller-fragment');
    expect(fragment.get('access_token')).toBe('synthetic-access');
    expect(fragment.get('refresh_token')).toBe('synthetic-refresh');
    expect(fragment.get('state')).toBe('caller-state');
    expect(fragment.get('auth_method')).toBe('magic_link');
    expect(fragment.get('expires_at')).toBe('2025-10-09T08:53:20.000Z');
  });

  it('omits optional refresh token and state when they are not present', () => {
    const service = serviceWithExpiry();

    const redirectUrl = service.buildTokenHandoffUrl(
      'https://app.example.test/callback',
      { accessToken: 'synthetic-access' },
      'google',
    );

    const fragment = new URLSearchParams(new URL(redirectUrl).hash.slice(1));

    expect(fragment.get('access_token')).toBe('synthetic-access');
    expect(fragment.has('refresh_token')).toBe(false);
    expect(fragment.has('state')).toBe(false);
    expect(fragment.get('auth_method')).toBe('google');
    expect(fragment.has('expires_at')).toBe(true);
  });
});
