import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InternalUsersController } from './internal-users.controller';
import { UsersService } from './users.service';

describe('InternalUsersController', () => {
  let controller: InternalUsersController;
  const usersService = {
    findLegacyMapping: jest.fn(),
    resolveOrProvisionLegacyUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalUsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();
    controller = moduleRef.get(InternalUsersController);
  });

  it('returns authUserId for a known legacy id', async () => {
    usersService.findLegacyMapping.mockResolvedValue({
      authUserId: 'e9c0e180-c837-404e-a954-a37b56241a80',
      normalizedEmail: 'ekaterina.putra@gmail.com',
    });
    const result = await controller.byLegacyId('speakasap-portal', '310740');
    expect(usersService.findLegacyMapping).toHaveBeenCalledWith('speakasap-portal', 310740);
    expect(result).toEqual({
      authUserId: 'e9c0e180-c837-404e-a954-a37b56241a80',
      normalizedEmail: 'ekaterina.putra@gmail.com',
    });
  });

  it('404s when mapping is missing or unresolved', async () => {
    usersService.findLegacyMapping.mockResolvedValue(null);
    await expect(controller.byLegacyId('speakasap-portal', '999999999')).rejects.toThrow(NotFoundException);
  });

  it('400s on non-numeric legacyUserId', async () => {
    await expect(controller.byLegacyId('speakasap-portal', 'abc')).rejects.toThrow();
    expect(usersService.findLegacyMapping).not.toHaveBeenCalled();
  });

  describe('resolveOrProvisionLegacy', () => {
    it('delegates to the service and returns the mapping', async () => {
      usersService.resolveOrProvisionLegacyUser.mockResolvedValue({
        authUserId: 'u-1',
        provisioned: false,
      });
      const res = await controller.resolveOrProvisionLegacy({
        system: 'speakasap-portal',
        legacyUserId: 310740,
        email: 'a@b.com',
      } as any);
      expect(res).toEqual({ authUserId: 'u-1', provisioned: false });
    });

    it('rejects a non-numeric legacyUserId', async () => {
      await expect(
        controller.resolveOrProvisionLegacy({
          system: 'speakasap-portal',
          legacyUserId: 'abc' as any,
          email: 'a@b.com',
        } as any),
      ).rejects.toThrow(/legacyUserId/);
    });

    it('rejects a missing system', async () => {
      await expect(
        controller.resolveOrProvisionLegacy({
          system: '',
          legacyUserId: 1,
          email: 'a@b.com',
        } as any),
      ).rejects.toThrow(/system/);
    });
  });
});
