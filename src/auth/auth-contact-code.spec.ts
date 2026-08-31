import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { AuthService } from './auth.service';

describe('Auth contact code contract', () => {
  // requireJwtSecret() refuses to fall back to a placeholder, so the suite must
  // supply a real value the way a deployed process gets one from Vault.
  const TEST_JWT_SECRET = 'test-jwt-secret-contact-code-spec';
  const previousJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterAll(() => {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  const baseUser = {
    id: 'user-1',
    email: 'person@example.test',
    phone: '+420777123456',
    isActive: true,
    isVerified: false,
    userType: 'end_user',
  } as any;

  function makeService(user = baseUser) {
    const savedTokens: any[] = [];
    const usersService = {
      findByEmail: jest.fn(async (email: string) => (email === 'person@example.test' ? user : null)),
      findByPhone: jest.fn(async (phone: string) => (phone === '+420777123456' ? user : null)),
      findById: jest.fn(async (id: string) => (id === user.id ? user : null)),
    };
    const service: any = Object.create(AuthService.prototype);
    service.usersService = usersService;
    const rolesService = {
      getUserRoles: jest.fn(async () => ['app:test:user']),
      assignDefaultApplicationAccess: jest.fn(async () => ({ assigned: true, role: 'app:marathon:user', applicationId: 'app-1' })),
    };
    service.rolesService = rolesService;
    service.jwtService = {
      sign: jest.fn(() => 'tok'),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.magicLinkTtlMinutes = 15;
    service.passwordRecoveryTtlMinutes = 15;
    service.magicLinkRateLimitPerIp = 20;
    service.magicLinkRateLimitPerEmail = 10;
    service.rateLimitWindowMs = 15 * 60 * 1000;
    service.rateLimitStore = new Map();
    service.notificationsServiceUrl = 'http://notifications';
    service.notificationServiceToken = 'service-token';
    service.contactCodePhoneChannel = 'whatsapp';
    service.contactCodePhoneChannelKey = '';
    service.contactCodeEmailChannelKey = '';
    service.allowedRedirectOrigins = [];
    service.httpService = { post: jest.fn(() => ({ toPromise: jest.fn() })) };
    service.magicLinkTokenRepository = {
      create: jest.fn((payload: any) => ({ id: 'proof-1', ...payload })),
      save: jest.fn(async (token: any) => {
        savedTokens.push(token);
        return token;
      }),
      findOne: jest.fn(async ({ where }: any) => savedTokens.find((token) => token.token === where.token && token.used === where.used) || null),
    };
    const savedGrants: any[] = [];
    service.passwordResetTokenRepository = {
      create: jest.fn((payload: any) => ({ id: 'grant-1', ...payload })),
      save: jest.fn(async (grant: any) => {
        savedGrants.push(grant);
        return grant;
      }),
      findOne: jest.fn(async ({ where }: any) => savedGrants.find((g) => g.token === where.token && g.used === where.used) || null),
    };
    jest.spyOn(service, 'sendContactCode').mockResolvedValue(true);
    jest.spyOn(service, 'generateContactCode').mockReturnValue('123456');
    return { service: service as AuthService, usersService, savedTokens, savedGrants, rolesService };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests a phone sign-in proof without issuing JWTs', async () => {
    const { service, usersService, savedTokens } = makeService();

    const result = await service.requestContactCode({
      identifier: '+420 777 123 456',
      return_url: 'https://marathon.alfares.cz/profile',
      client_id: 'marathon',
      state: 'state-1',
    }, '127.0.0.1');

    expect(usersService.findByPhone).toHaveBeenCalledWith('+420777123456');
    expect(savedTokens[0]).toMatchObject({
      userId: 'user-1',
      email: '+420777123456',
      returnUrl: 'https://marathon.alfares.cz/profile',
      clientId: 'marathon',
      state: 'state-1',
      used: false,
    });
    expect(result).toEqual({ success: true, delivery: 'sent', ttlMinutes: 15 });
    expect(result).not.toHaveProperty('accessToken');
  });

  it('verifies a phone sign-in proof and returns the standard JWT contract', async () => {
    const { service, rolesService } = makeService();
    await service.requestContactCode({
      identifier: '+420777123456',
      return_url: 'https://marathon.alfares.cz/profile',
    }, '127.0.0.1');

    const result = await service.verifyContactCode({
      identifier: '+420 777 123 456',
      code: '123456',
    });

    expect(result).toMatchObject({
      user: expect.objectContaining({ id: 'user-1', phone: '+420777123456' }),
      accessToken: 'tok',
      refreshToken: 'tok',
    });
    expect(result.redirectUrl).toContain('auth_method=phone_code');
    expect(result.redirectUrl).toContain('access_token=tok');
    expect(rolesService.assignDefaultApplicationAccess).not.toHaveBeenCalled();
  });

  it('assigns first-visit app access from the stored contact-code client id before issuing tokens', async () => {
    const { service, rolesService } = makeService();
    await service.requestContactCode({
      identifier: '+420777123456',
      return_url: 'https://marathon.alfares.cz/profile',
      client_id: 'marathon',
    }, '127.0.0.1');

    await service.verifyContactCode({
      identifier: '+420777123456',
      code: '123456',
    });

    expect(rolesService.assignDefaultApplicationAccess).toHaveBeenCalledWith('user-1', 'marathon', 'user-1', 'https://marathon.alfares.cz/profile');
  });

  it('rejects invalid contact proof codes', async () => {
    const { service } = makeService();

    await expect(service.verifyContactCode({
      identifier: '+420777123456',
      code: '000000',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('sends phone contact codes through the configured phone notification channel', async () => {
    const { service } = makeService();
    jest.restoreAllMocks();
    (service as any).httpService = { post: jest.fn(() => of({ data: { id: 'notification-1' } })) };

    await (service as any).sendContactCode('phone', '+420777123456', '123456', 'marathon.alfares.cz');

    expect((service as any).httpService.post).toHaveBeenCalledWith(
      'http://notifications/notifications/send',
      expect.objectContaining({
        channel: 'whatsapp',
        type: 'custom',
        recipient: '+420777123456',
        message: expect.stringContaining('123456'),
        service: 'auth-microservice',
        purpose: 'transactional',
      }),
      { headers: { Authorization: 'Bearer service-token' } },
    );
  });

  it('sends email contact codes as HTML with the code on its own oversized line', async () => {
    const { service } = makeService();
    jest.restoreAllMocks();
    (service as any).httpService = { post: jest.fn(() => of({ data: { id: 'notification-2' } })) };

    await (service as any).sendContactCode('email', 'person@example.test', '123456', 'marathon.alfares.cz');

    const payload = (service as any).httpService.post.mock.calls[0][1];
    expect(payload.contentType).toBe('text/html');
    expect(payload.subject).toBe('Alfares sign-in code');
    const codeBlock = payload.message.match(/<p[^>]*>123456<\/p>/);
    expect(codeBlock).not.toBeNull();
    expect(codeBlock[0]).toContain('font-size:44px');
    expect(codeBlock[0]).toContain('font-weight:bold');
  });

  it('sanitizes the contact-code email display domain before rendering HTML', async () => {
    const { service } = makeService();
    jest.restoreAllMocks();
    (service as any).httpService = { post: jest.fn(() => of({ data: { id: 'notification-3' } })) };

    await (service as any).sendContactCode(
      'email',
      'person@example.test',
      '123456',
      'marathon.alfares.cz"><img src=x onerror=alert(1)>',
    );

    const payload = (service as any).httpService.post.mock.calls[0][1];
    expect(payload.fromName).toBe('alfares.cz');
    expect(payload.message).toContain('https://alfares.cz');
    expect(payload.message).not.toContain('<img');
    expect(payload.message).not.toContain('onerror');
  });

  it('uses the validated return_url host for contact-code email branding', async () => {
    const { service } = makeService();

    await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        app_domain: 'evil.example.test',
      } as any,
      '10.0.0.1',
    );

    expect((service as any).sendContactCode).toHaveBeenCalledWith(
      'email',
      'person@example.test',
      '123456',
      'catalog.alfares.cz',
      undefined,
      'login',
      15,
    );
  });

  it('stores a recovery code with its purpose and the recovery TTL', async () => {
    const { service, savedTokens } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;

    const before = Date.now();
    const result = await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    expect(result).toEqual({ success: true, delivery: 'sent', ttlMinutes: 9 });
    expect(savedTokens).toHaveLength(1);
    expect(savedTokens[0].purpose).toBe('recovery');
    const ttlMs = new Date(savedTokens[0].expiresAt).getTime() - before;
    expect(ttlMs).toBeGreaterThan(8 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(9 * 60 * 1000 + 1000);
  });

  it('defaults to a login code and the magic-link TTL', async () => {
    const { service, savedTokens } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;

    await service.requestContactCode(
      { identifier: 'person@example.test', return_url: 'https://catalog.alfares.cz/orders' } as any,
      '10.0.0.1',
    );

    expect(savedTokens[0].purpose).toBe('login');
    const ttlMs = new Date(savedTokens[0].expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60 * 1000);
  });

  it('hashes the two purposes apart so identical digits cannot collide on the unique token', () => {
    const { service } = makeService();
    const asLogin = (service as any).contactCodeHash('person@example.test', '123456', 'login');
    const asRecovery = (service as any).contactCodeHash('person@example.test', '123456', 'recovery');
    expect(asRecovery).not.toBe(asLogin);
  });

  it('keeps the legacy hash for login so codes already in flight survive the deploy', () => {
    const { service } = makeService();
    const legacy = require('crypto')
      .createHash('sha256')
      .update(`person@example.test:123456:${TEST_JWT_SECRET}`)
      .digest('hex');
    expect((service as any).contactCodeHash('person@example.test', '123456', 'login')).toBe(legacy);
  });

  it('gives nothing away about an unknown account', async () => {
    const { service, savedTokens } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;

    const result = await service.requestContactCode(
      {
        identifier: 'nobody@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    expect(result).toEqual({ success: true, delivery: 'accepted', ttlMinutes: 9 });
    expect(savedTokens).toHaveLength(0);
  });

  it('exchanges a recovery code for a grant and issues no tokens', async () => {
    const { service, savedGrants } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;
    process.env.FRONTEND_URL = 'https://auth.alfares.cz';

    await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        client_id: 'catalog',
        state: 'xyz',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    const result: any = await service.verifyContactCode({
      identifier: 'person@example.test',
      code: '123456',
      purpose: 'recovery',
      lang: 'cs',
    } as any);

    expect(result.recovery).toBe(true);
    expect(result.ttlMinutes).toBe(9);
    // Carry the language across the redirect, or a Czech user finishes recovery in English.
    expect(result.redirectUrl).toContain('lang=cs');
    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(result.redirectUrl).toContain('https://auth.alfares.cz/set-password?');
    expect(result.redirectUrl).toContain('ttl=9');

    // The completion target lives on the row, never in the URL the user can edit.
    expect(savedGrants).toHaveLength(1);
    expect(savedGrants[0].returnUrl).toBe('https://catalog.alfares.cz/orders');
    expect(savedGrants[0].clientId).toBe('catalog');
    expect(savedGrants[0].state).toBe('xyz');
    expect(result.redirectUrl).not.toContain('catalog.alfares.cz');
  });

  it('refuses to sign in with a recovery code', async () => {
    const { service } = makeService();
    await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    await expect(
      service.verifyContactCode({ identifier: 'person@example.test', code: '123456' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses to recover with a login code', async () => {
    const { service } = makeService();
    await service.requestContactCode(
      { identifier: 'person@example.test', return_url: 'https://catalog.alfares.cz/orders' } as any,
      '10.0.0.1',
    );

    await expect(
      service.verifyContactCode({
        identifier: 'person@example.test',
        code: '123456',
        purpose: 'recovery',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses a channel registry key for phone contact codes when configured', async () => {
    const { service } = makeService();
    jest.restoreAllMocks();
    (service as any).contactCodePhoneChannelKey = 'auth-phone-code';
    (service as any).httpService = { post: jest.fn(() => of({ data: { id: 'notification-1' } })) };

    await (service as any).sendContactCode('phone', '+420777123456', '123456');

    expect((service as any).httpService.post).toHaveBeenCalledWith(
      'http://notifications/notifications/send',
      expect.objectContaining({
        channel: undefined,
        channelKey: 'auth-phone-code',
        recipient: '+420777123456',
      }),
      { headers: { Authorization: 'Bearer service-token' } },
    );
  });
});
