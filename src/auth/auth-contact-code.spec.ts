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
    service.rolesService = { getUserRoles: jest.fn(async () => ['app:test:user']) };
    service.jwtService = {
      sign: jest.fn(() => 'tok'),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.magicLinkTtlMinutes = 15;
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
    return { service: service as AuthService, usersService, savedTokens };
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
    expect(result).toEqual({ success: true, delivery: 'sent' });
    expect(result).not.toHaveProperty('accessToken');
  });

  it('verifies a phone sign-in proof and returns the standard JWT contract', async () => {
    const { service } = makeService();
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
