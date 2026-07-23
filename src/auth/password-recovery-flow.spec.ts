import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('password recovery flow', () => {
  const user = {
    id: 'user-1',
    email: 'person@example.test',
    isActive: true,
    userType: 'end_user',
  } as any;

  function makeService() {
    const grants: any[] = [];
    const service: any = Object.create(AuthService.prototype);
    service.usersService = {
      findById: jest.fn(async (id: string) => (id === user.id ? user : null)),
      updatePassword: jest.fn(async () => undefined),
    };
    service.rolesService = {
      getUserRoles: jest.fn(async () => ['app:catalog:user']),
      assignDefaultApplicationAccess: jest.fn(async () => ({ assigned: true })),
    };
    service.jwtService = {
      sign: jest.fn(() => 'signed-token'),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.allowedRedirectOrigins = [];
    service.passwordRecoveryTtlMinutes = 15;
    service.passwordResetTokenRepository = {
      create: jest.fn((payload: any) => ({ id: 'grant-1', ...payload })),
      save: jest.fn(async (grant: any) => {
        const existing = grants.findIndex((g) => g.token === grant.token);
        if (existing >= 0) grants[existing] = grant;
        else grants.push(grant);
        return grant;
      }),
      findOne: jest.fn(async ({ where }: any) => grants.find((g) => g.token === where.token && g.used === where.used) || null),
    };
    return { service: service as AuthService, grants };
  }

  function addGrant(grants: any[], overrides: Record<string, unknown> = {}) {
    const grant = {
      id: 'grant-1',
      userId: user.id,
      token: 'grant-token',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      used: false,
      returnUrl: 'https://catalog.alfares.cz/orders',
      clientId: 'catalog',
      state: 'xyz',
      user,
      ...overrides,
    };
    grants.push(grant);
    return grant;
  }

  afterEach(() => jest.restoreAllMocks());

  it('signs the user in and sends them where they were going', async () => {
    const { service, grants } = makeService();
    addGrant(grants);

    const result: any = await service.confirmPasswordReset({
      token: 'grant-token',
      newPassword: 'a-new-password',
    } as any);

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(result.redirectUrl).toContain('https://catalog.alfares.cz/orders#');
    expect(result.redirectUrl).toContain('access_token=signed-token');
    expect(result.redirectUrl).toContain('auth_method=password_recovery');
    expect(result.redirectUrl).toContain('state=xyz');
    expect((service as any).usersService.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('leaves a grant without a return target on the old message-only shape', async () => {
    const { service, grants } = makeService();
    addGrant(grants, { returnUrl: null, clientId: null, state: null });

    const result: any = await service.confirmPasswordReset({
      token: 'grant-token',
      newPassword: 'a-new-password',
    } as any);

    expect(result).toEqual({ message: 'Password reset successfully' });
  });

  // The password write and the grant burn are already committed by the time the handoff runs.
  // If minting throws there, telling the user it failed is a lie: their password IS the new one.
  // Setting the password is the goal; the auto-login is a convenience, so it degrades instead.
  it('still reports success when the handoff cannot be minted', async () => {
    const { service, grants } = makeService();
    addGrant(grants, { clientId: 'not-a-registered-app' });
    (service as any).rolesService.assignDefaultApplicationAccess = jest.fn(async () => {
      throw new BadRequestException('Unknown or inactive client_id');
    });

    const result: any = await service.confirmPasswordReset({
      token: 'grant-token',
      newPassword: 'a-new-password',
    } as any);

    expect(result.message).toBe('Password reset successfully');
    expect(result.redirectUrl).toBeUndefined();
    expect(result.accessToken).toBeUndefined();
    // The password change must have happened - that is what the message promises.
    expect((service as any).usersService.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('rejects a replayed grant', async () => {
    const { service, grants } = makeService();
    addGrant(grants);

    await service.confirmPasswordReset({ token: 'grant-token', newPassword: 'a-new-password' } as any);
    await expect(
      service.confirmPasswordReset({ token: 'grant-token', newPassword: 'another-password' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an expired grant', async () => {
    const { service, grants } = makeService();
    addGrant(grants, { expiresAt: new Date(Date.now() - 1000) });

    await expect(
      service.confirmPasswordReset({ token: 'grant-token', newPassword: 'a-new-password' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the return target on the link grant and states one TTL everywhere', async () => {
    const { service, grants } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 11;
    (service as any).usersService.findByEmail = jest.fn(async () => user);
    (service as any).notificationsServiceUrl = 'http://notifications';
    (service as any).notificationServiceToken = 'service-token';
    const sent: any[] = [];
    (service as any).httpService = {
      post: jest.fn((_url: string, payload: any) => {
        sent.push(payload);
        return { subscribe: (o: any) => o.next({ data: {} }) } as any;
      }),
    };
    process.env.FRONTEND_URL = 'https://auth.alfares.cz';

    const before = Date.now();
    await service.requestPasswordReset({
      email: 'person@example.test',
      return_url: 'https://catalog.alfares.cz/orders',
      client_id: 'catalog',
      state: 'xyz',
      lang: 'en',
    } as any);

    expect(grants).toHaveLength(1);
    expect(grants[0].returnUrl).toBe('https://catalog.alfares.cz/orders');
    expect(grants[0].clientId).toBe('catalog');
    expect(grants[0].state).toBe('xyz');

    // The stored expiry and the number printed in the email must be the same value.
    const ttlMs = new Date(grants[0].expiresAt).getTime() - before;
    expect(ttlMs).toBeGreaterThan(10 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(11 * 60 * 1000 + 1000);
    expect(sent[0].message).toContain('11 minutes');
    expect(sent[0].message).not.toContain('60 minutes');
  });

  it('hands no tokens to a return target outside the allowed origins', async () => {
    const { service, grants } = makeService();
    (service as any).allowedRedirectOrigins = ['https://catalog.alfares.cz'];
    addGrant(grants, { returnUrl: 'https://evil.example/steal' });

    const result: any = await service.confirmPasswordReset({
      token: 'grant-token',
      newPassword: 'a-new-password',
    } as any);

    // The security property is that nothing is handed to a disallowed origin - not that the
    // call throws. Throwing would claim the reset failed when the password is already changed.
    expect(result.redirectUrl).toBeUndefined();
    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('evil.example');
    expect(result).toEqual({ message: 'Password reset successfully' });
  });
});
