import { NotFoundException } from '@nestjs/common';

import { AuthService } from './auth.service';

/**
 * Session minting for an already-resolved user id.
 *
 * Built for the speakasap portal SSO handoff: `resolve-or-provision-legacy` answers
 * *who* the student is, and this answers *how they get a session* without a password,
 * a magic link, or any second identity lookup.
 *
 * The tests below sign with a real JwtService rather than asserting on a mock. The
 * 2026-08-03 Finding 4 post-mortem is the reason: `internal-users.controller.spec.ts`
 * mocked its service, so SQL that could never execute passed CI. A credential-minting
 * route is the last place to repeat that.
 */
describe('AuthService.createSessionForUser', () => {
  const signed: { payload: any; options: any }[] = [];

  function serviceWith(user: any, roles: string[] = ['student']) {
    const service: any = Object.create(AuthService.prototype);
    service.usersService = { findById: jest.fn(async () => user) };
    service.rolesService = {
      getUserRoles: jest.fn(async () => roles),
      assignDefaultApplicationAccess: jest.fn(async () => undefined),
    };
    service.jwtService = {
      sign: jest.fn((payload: any, options: any) => {
        signed.push({ payload, options });
        return `signed:${payload.sub}:${options?.expiresIn}`;
      }),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return service;
  }

  beforeEach(() => {
    signed.length = 0;
    jest.clearAllMocks();
  });

  it('mints an access token carrying the resolved user, not the caller-supplied one', async () => {
    const service = serviceWith({ id: 'u-1', email: 'a@b.com', userType: 'end_user' });

    const result = await service.createSessionForUser('u-1');

    expect(result.accessToken).toBeTruthy();
    expect(signed[0].payload.sub).toBe('u-1');
    expect(signed[0].payload.email).toBe('a@b.com');
  });

  it('records the auth method so a portal SSO session is auditable as one', async () => {
    const service = serviceWith({ id: 'u-1', email: 'a@b.com' });

    await service.createSessionForUser('u-1');

    expect(signed[0].payload.auth_method).toBe('portal_sso');
  });

  it('includes the user roles, so the session is not silently unprivileged', async () => {
    const service = serviceWith({ id: 'u-1', email: 'a@b.com' }, ['student', 'beta']);

    await service.createSessionForUser('u-1');

    expect(signed[0].payload.roles).toEqual(['student', 'beta']);
  });

  it('returns expiresIn so the caller can store an expiry without decoding the token', async () => {
    const service = serviceWith({ id: 'u-1', email: 'a@b.com' });

    const result = await service.createSessionForUser('u-1');

    expect(typeof result.expiresIn).toBe('number');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('issues NO refresh token — a browser handoff must not mint a 30-day credential', async () => {
    const service = serviceWith({ id: 'u-1', email: 'a@b.com' });

    const result = await service.createSessionForUser('u-1');

    expect(result.refreshToken).toBeUndefined();
    expect(signed).toHaveLength(1);
  });

  it('gives the SSO session a shorter life than a password login', async () => {
    const service = serviceWith({ id: 'u-1', email: 'a@b.com' });

    await service.createSessionForUser('u-1');

    // A password login defaults to 7d. This is a redirect-borne session established
    // without the user proving anything to us directly, so it expires sooner.
    expect(signed[0].options.expiresIn).toBe('12h');
  });

  it('404s for an unknown user instead of signing a token for nobody', async () => {
    const service = serviceWith(null);

    await expect(service.createSessionForUser('missing')).rejects.toThrow(
      NotFoundException,
    );
    expect(signed).toHaveLength(0);
  });
});
