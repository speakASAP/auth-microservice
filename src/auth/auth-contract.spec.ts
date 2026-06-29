import { UnauthorizedException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { AuthService } from './auth.service';

describe('Auth identifier and contact contract', () => {
  const baseUser = {
    id: 'user-1',
    email: 'person@example.test',
    phone: '+420777123456',
    password: '$2b$10$synthetic',
    isActive: true,
    isVerified: false,
    userType: 'end_user',
  } as any;

  function makeService(user = baseUser) {
    const usersService = {
      findByEmail: jest.fn(async (email: string) => (email === 'person@example.test' ? user : null)),
      findByPhone: jest.fn(async (phone: string) => (phone === '+420777123456' ? user : null)),
      findByContact: jest.fn(async () => null),
      findById: jest.fn(async (id: string) => (id === user.id ? user : null)),
      create: jest.fn(async (payload: any) => ({ id: 'new-user', isActive: true, isVerified: false, userType: 'end_user', ...payload })),
      update: jest.fn(async (_id: string, payload: any) => ({ ...user, ...payload })),
    };
    const service: any = Object.create(AuthService.prototype);
    service.usersService = usersService;
    service.rolesService = { getUserRoles: jest.fn(async () => ['app:test:user']) };
    service.jwtService = {
      sign: jest.fn(() => 'tok'),
      verify: jest.fn(() => ({ sub: user.id })),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.legacyIdentityMappingRepository = { createQueryBuilder: jest.fn() };
    return { service: service as AuthService, usersService };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('authenticates a phone identifier through /auth/login and returns the JWT refresh contract', async () => {
    jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true as never);
    const { service, usersService } = makeService();

    const result = await service.login({ identifier: '+420 777 123 456', password: 'valid-password' });

    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(usersService.findByPhone).toHaveBeenCalledWith('+420777123456');
    expect(result).toMatchObject({
      user: expect.objectContaining({ id: 'user-1', phone: '+420777123456' }),
      accessToken: 'tok',
      refreshToken: 'tok',
    });
  });

  it('preserves legacy email login payloads', async () => {
    jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true as never);
    const { service, usersService } = makeService();

    const result = await service.login({ email: ' Person@Example.Test ', password: 'valid-password' });

    expect(usersService.findByEmail).toHaveBeenCalledWith('person@example.test');
    expect(result.accessToken).toBe('tok');
    expect(result.refreshToken).toBe('tok');
  });

  it('keeps contact registration as provisioning and normalizes phone contacts', async () => {
    const { service, usersService } = makeService({ ...baseUser, id: 'none' });
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByPhone.mockResolvedValue(null);

    const result = await service.registerContact({
      name: 'Provisioned User',
      source: 'marathon',
      contactInfo: [{ type: 'phone' as any, value: '+420 777 123 456', isPrimary: 'true' as any }],
    });

    expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({
      phone: '+420777123456',
      password: null,
      source: 'marathon',
      contactInfo: [{ type: 'phone', value: '+420777123456', isPrimary: true }],
    }));
    expect(result).toMatchObject({
      success: true,
      userId: 'new-user',
      authenticated: false,
      provisioning: true,
      isNewUser: true,
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('marks existing users as marathon participants without overwriting their primary source', async () => {
    const existing = {
      ...baseUser,
      source: 'school-committee',
      contactInfo: [{ type: 'email', value: 'person@example.test', isPrimary: true }],
      perApplicationPreferences: { theme: 'default' },
    } as any;
    const { service, usersService } = makeService(existing);

    const result = await service.registerContact({
      name: 'Marathon User',
      source: 'marathon',
      sessionId: 'marathon:participant-1',
      contactInfo: [
        { type: 'email' as any, value: 'person@example.test', isPrimary: true },
        { type: 'phone' as any, value: '+420 777 123 456', isPrimary: false },
      ],
    });

    expect(usersService.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
      source: 'school-committee',
      perApplicationPreferences: expect.objectContaining({
        theme: 'default',
        authSources: expect.objectContaining({
          marathon: {
            source: 'marathon',
            provisioned: true,
            sessionId: 'marathon:participant-1',
          },
        }),
      }),
    }));
    expect(result).toMatchObject({
      success: true,
      userId: 'user-1',
      authenticated: false,
      provisioning: true,
      isNewUser: false,
    });
  });

  it('does not convert contact login into an authenticated session without verified proof', async () => {
    const { service, usersService } = makeService();

    await expect(service.loginContact('phone', '+420 777 123 456')).rejects.toThrow(UnauthorizedException);

    expect(usersService.findByPhone).toHaveBeenCalledWith('+420777123456');
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('exposes service actor fields for service principals during token validation', async () => {
    const serviceUser = {
      ...baseUser,
      id: 'service-user-1',
      email: 'catalog-warehouse-service@example.test',
      userType: 'service',
      perApplicationPreferences: {
        serviceIdentity: {
          serviceName: 'catalog-microservice',
          clientId: 'catalog-microservice',
          authMethod: 'auth-service-jwt',
        },
      },
    } as any;
    const { service } = makeService(serviceUser);
    (service as any).rolesService.getUserRoles.mockResolvedValue(['internal:warehouse-microservice:admin']);

    const result = await service.validateToken('service-token');

    expect(result).toMatchObject({
      id: 'service-user-1',
      userType: 'service',
      serviceName: 'catalog-microservice',
      service: 'catalog-microservice',
      clientId: 'catalog-microservice',
      authMethod: 'auth-service-jwt',
      roles: ['internal:warehouse-microservice:admin'],
    });
    expect(result).not.toHaveProperty('password');
  });

  it('does not add service actor fields to normal users during token validation', async () => {
    const { service } = makeService({
      ...baseUser,
      perApplicationPreferences: {
        serviceIdentity: {
          serviceName: 'catalog-microservice',
        },
      },
    } as any);

    const result = await service.validateToken('user-token');

    expect(result.userType).toBe('end_user');
    expect(result).not.toHaveProperty('serviceName');
    expect(result).not.toHaveProperty('service');
    expect(result).not.toHaveProperty('clientId');
    expect(result).not.toHaveProperty('authMethod');
  });
});
