import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { AuthService } from './auth.service';

describe('Auth contact code contract', () => {
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
    jest.spyOn(service, 'sendContactCode').mockResolvedValue(true);
    jest.spyOn(service, 'generateContactCode').mockReturnValue('123456');
    return { service: service as AuthService, usersService, savedTokens, rolesService };
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
      .update(`person@example.test:123456:${process.env.JWT_SECRET || 'default-secret'}`)
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
