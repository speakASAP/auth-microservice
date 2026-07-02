import { UnauthorizedException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { AuthService } from './auth.service';

describe('Auth identifier and contact contract', () => {
  const baseUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'person@example.test',
    phone: '+420777123456',
    password: '$2b$10$synthetic',
    isActive: true,
    isVerified: false,
    userType: 'end_user',
  } as any;

  function makeService(user = baseUser) {
    const deliveryAddress = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: user.id,
      label: 'Home',
      firstName: 'Ada',
      lastName: 'Lovelace',
      street: 'Vaclavske namesti 1',
      city: 'Praha',
      postalCode: '11000',
      country: 'Czech Republic',
      phone: '+420777123456',
      isDefault: true,
      deletedAt: null,
      updatedAt: new Date('2026-07-02T10:00:00.000Z'),
    } as any;
    const invoiceProfile = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: user.id,
      label: 'Company',
      type: 'company',
      companyName: 'Example s.r.o.',
      companyId: '12345678',
      vatId: 'CZ12345678',
      street: 'Vaclavske namesti 1',
      city: 'Praha',
      postalCode: '11000',
      country: 'Czech Republic',
      isDefault: true,
      deletedAt: null,
      updatedAt: new Date('2026-07-02T10:00:00.000Z'),
    } as any;
    const usersService = {
      findByEmail: jest.fn(async (email: string) => (email === 'person@example.test' ? user : null)),
      findByPhone: jest.fn(async (phone: string) => (phone === '+420777123456' ? user : null)),
      findByContact: jest.fn(async () => null),
      findById: jest.fn(async (id: string) => (id === user.id ? user : null)),
      create: jest.fn(async (payload: any) => ({
        id: 'new-user',
        isActive: true,
        isVerified: false,
        userType: 'end_user',
        ...payload,
      })),
      update: jest.fn(async (_id: string, payload: any) => ({
        ...user,
        ...payload,
      })),
      listDeliveryAddresses: jest.fn(async () => [deliveryAddress]),
      getDeliveryAddress: jest.fn(async () => deliveryAddress),
      createDeliveryAddress: jest.fn(async (_userId: string, payload: any) => ({
        ...deliveryAddress,
        ...payload,
      })),
      updateDeliveryAddress: jest.fn(async (_userId: string, _addressId: string, payload: any) => ({
        ...deliveryAddress,
        ...payload,
      })),
      deleteDeliveryAddress: jest.fn(async () => undefined),
      setDefaultDeliveryAddress: jest.fn(async () => deliveryAddress),
      listInvoiceProfiles: jest.fn(async () => [invoiceProfile]),
      getInvoiceProfile: jest.fn(async () => invoiceProfile),
      createInvoiceProfile: jest.fn(async (_userId: string, payload: any) => ({
        ...invoiceProfile,
        ...payload,
      })),
      updateInvoiceProfile: jest.fn(async (_userId: string, _profileId: string, payload: any) => ({
        ...invoiceProfile,
        ...payload,
      })),
      deleteInvoiceProfile: jest.fn(async () => undefined),
      setDefaultInvoiceProfile: jest.fn(async () => invoiceProfile),
    };
    const service: any = Object.create(AuthService.prototype);
    service.usersService = usersService;
    service.rolesService = {
      getUserRoles: jest.fn(async () => ['app:test:user']),
    };
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

    const result = await service.login({
      identifier: '+420 777 123 456',
      password: 'valid-password',
    });

    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(usersService.findByPhone).toHaveBeenCalledWith('+420777123456');
    expect(result).toMatchObject({
      user: expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        phone: '+420777123456',
      }),
      accessToken: 'tok',
      refreshToken: 'tok',
    });
  });

  it('preserves legacy email login payloads', async () => {
    jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true as never);
    const { service, usersService } = makeService();

    const result = await service.login({
      email: ' Person@Example.Test ',
      password: 'valid-password',
    });

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
      contactInfo: [
        {
          type: 'phone' as any,
          value: '+420 777 123 456',
          isPrimary: 'true' as any,
        },
      ],
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+420777123456',
        password: null,
        source: 'marathon',
        contactInfo: [{ type: 'phone', value: '+420777123456', isPrimary: true }],
      }),
    );
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

    expect(usersService.update).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
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
      }),
    );
    expect(result).toMatchObject({
      success: true,
      userId: '11111111-1111-4111-8111-111111111111',
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

  it('returns the canonical sanitized Auth profile from the database', async () => {
    const { service, usersService } = makeService({
      ...baseUser,
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+420777123456',
      contactInfo: [{ type: 'phone', value: '+420777123456', isPrimary: true }],
      perApplicationPreferences: {
        authSources: {
          hevrike: { source: 'hevrike', provisioned: true },
          bazos: { source: 'bazos', provisioned: true },
        },
      },
    } as any);

    const result = await service.getProfile('11111111-1111-4111-8111-111111111111');

    expect(usersService.findById).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(result).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'person@example.test',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+420777123456',
      contactInfo: [{ type: 'phone', value: '+420777123456', isPrimary: true }],
      perApplicationPreferences: expect.objectContaining({
        authSources: expect.objectContaining({
          hevrike: expect.objectContaining({ source: 'hevrike' }),
          bazos: expect.objectContaining({ source: 'bazos' }),
        }),
      }),
    });
    expect(result).not.toHaveProperty('password');
  });

  it('updates canonical Auth profile and address in the central profile document', async () => {
    const { service, usersService } = makeService({
      ...baseUser,
      firstName: 'Old',
      contactInfo: [{ type: 'email', value: 'person@example.test', isPrimary: true }],
      perApplicationPreferences: {
        authSources: { flipflop: { source: 'flipflop' } },
      },
    } as any);

    usersService.update.mockImplementation(async (_id: string, patch: any) => ({
      ...baseUser,
      ...patch,
    }));
    usersService.findById
      .mockResolvedValueOnce({
        ...baseUser,
        firstName: 'Old',
        contactInfo: [{ type: 'email', value: 'person@example.test', isPrimary: true }],
        perApplicationPreferences: {
          authSources: { flipflop: { source: 'flipflop' } },
        },
      } as any)
      .mockResolvedValueOnce({
        ...baseUser,
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+420777123456',
        contactInfo: [
          { type: 'email', value: 'person@example.test', isPrimary: true },
          { type: 'phone', value: '+420777123456', isPrimary: true },
        ],
        perApplicationPreferences: {
          authSources: { flipflop: { source: 'flipflop' } },
          canonicalProfile: {
            address: {
              street: 'Vaclavske namesti 1',
              city: 'Praha',
              postalCode: '11000',
              country: 'Czech Republic',
            },
          },
        },
      } as any);

    const result = await service.updateProfile('11111111-1111-4111-8111-111111111111', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+420 777 123 456',
      address: {
        street: 'Vaclavske namesti 1',
        city: 'Praha',
        postalCode: '11000',
        country: 'Czech Republic',
      },
    });

    expect(usersService.update).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+420777123456',
        contactInfo: expect.arrayContaining([
          expect.objectContaining({
            type: 'phone',
            value: '+420777123456',
            isPrimary: true,
          }),
        ]),
        perApplicationPreferences: expect.objectContaining({
          authSources: expect.objectContaining({
            flipflop: expect.objectContaining({ source: 'flipflop' }),
          }),
          canonicalProfile: expect.objectContaining({
            address: expect.objectContaining({
              street: 'Vaclavske namesti 1',
              city: 'Praha',
              postalCode: '11000',
              country: 'Czech Republic',
            }),
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+420777123456',
    });
    expect(result).not.toHaveProperty('password');
  });

  it('returns Auth-owned checkout data without exposing ownership or soft-delete internals', async () => {
    const { service, usersService } = makeService({
      ...baseUser,
      firstName: 'Ada',
      lastName: 'Lovelace',
      perApplicationPreferences: {
        canonicalProfile: {
          address: {
            street: 'Legacy profile street',
          },
        },
      },
    } as any);

    const result = await service.getProfileCheckoutData('11111111-1111-4111-8111-111111111111');

    expect(usersService.findById).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(usersService.listDeliveryAddresses).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(usersService.listInvoiceProfiles).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(result).toMatchObject({
      user: expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        profileAddress: { street: 'Legacy profile street' },
      }),
      deliveryAddresses: [
        expect.objectContaining({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          label: 'Home',
          street: 'Vaclavske namesti 1',
          isDefault: true,
        }),
      ],
      invoiceProfiles: [
        expect.objectContaining({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          label: 'Company',
          type: 'company',
          companyId: '12345678',
          isDefault: true,
        }),
      ],
      defaults: {
        deliveryAddressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        invoiceProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    });
    expect(result.deliveryAddresses[0]).not.toHaveProperty('userId');
    expect(result.deliveryAddresses[0]).not.toHaveProperty('deletedAt');
    expect(result.invoiceProfiles[0]).not.toHaveProperty('userId');
    expect(result.invoiceProfiles[0]).not.toHaveProperty('deletedAt');
  });

  it('routes delivery address mutations through the authenticated Auth user boundary', async () => {
    const { service, usersService } = makeService();

    const created = await service.createDeliveryAddress('11111111-1111-4111-8111-111111111111', {
      label: 'Office',
      street: 'Narodni 10',
      phone: '+420 777 123 456',
      isDefault: true,
      sourceApplication: 'flipflop',
    });
    const selected = await service.setDefaultDeliveryAddress('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(usersService.createDeliveryAddress).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        label: 'Office',
        sourceApplication: 'flipflop',
      }),
    );
    expect(usersService.setDefaultDeliveryAddress).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(created).not.toHaveProperty('userId');
    expect(selected).not.toHaveProperty('userId');
  });

  it('routes invoice profile mutations through the authenticated Auth user boundary', async () => {
    const { service, usersService } = makeService();

    const created = await service.createInvoiceProfile('11111111-1111-4111-8111-111111111111', {
      label: 'Company',
      type: 'company',
      companyName: 'Example s.r.o.',
      companyId: '12345678',
      vatId: 'CZ12345678',
      isDefault: true,
      sourceApplication: 'flipflop',
    });

    expect(usersService.createInvoiceProfile).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        type: 'company',
        companyName: 'Example s.r.o.',
        sourceApplication: 'flipflop',
      }),
    );
    expect(created).toMatchObject({
      label: 'Company',
      type: 'company',
      companyId: '12345678',
      vatId: 'CZ12345678',
    });
    expect(created).not.toHaveProperty('userId');
    expect(created).not.toHaveProperty('deletedAt');
  });

  it('exposes service actor fields for service principals during token validation', async () => {
    const serviceUser = {
      ...baseUser,
      id: '22222222-2222-4222-8222-222222222222',
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
      id: '22222222-2222-4222-8222-222222222222',
      userType: 'service',
      serviceName: 'catalog-microservice',
      service: 'catalog-microservice',
      clientId: 'catalog-microservice',
      authMethod: 'auth-service-jwt',
      roles: ['internal:warehouse-microservice:admin'],
    });
    expect(result).not.toHaveProperty('password');
  });

  it('rejects non-UUID JWT subjects before database lookup', async () => {
    const { service, usersService } = makeService();
    (service as any).jwtService.verify.mockReturnValue({
      sub: 'warehouse-reservation-expiry-cron',
    });

    await expect(service.validateToken('service-token')).rejects.toThrow(UnauthorizedException);

    expect(usersService.findById).not.toHaveBeenCalled();
    expect((service as any).logger.warn).toHaveBeenCalledWith(expect.stringContaining('reason=invalid_subject'), 'AuthAudit');
    expect((service as any).logger.error).not.toHaveBeenCalled();
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
