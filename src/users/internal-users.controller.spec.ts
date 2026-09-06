import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { InternalUsersController } from './internal-users.controller';
import { UsersService } from './users.service';
import { RolesService } from '../roles/roles.service';

describe('InternalUsersController', () => {
  let controller: InternalUsersController;
  const usersService = {
    findLegacyMapping: jest.fn(),
    resolveOrProvisionLegacyUser: jest.fn(),
    findLegacyIdByAuthUser: jest.fn(),
    existsById: jest.fn(),
  };
  const authService = {
    createSessionForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalUsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: authService },
        // InternalUserExistenceGuard resolves roles from the database. These
        // tests cover controller behaviour, not the gate, so a stub is enough to
        // satisfy DI; the guard itself is tested in
        // auth/guards/internal-service-or-role.guard.spec.ts.
        { provide: RolesService, useValue: { getUserRoles: jest.fn(async () => []) } },
      ],
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

  /**
   * The reverse direction, added for education-service's drill runner: the JWT carries
   * an auth UUID while `DrillAssignment.studentId` is the legacy Django integer, and
   * neither route above returns that.
   */
  describe('byAuthUser', () => {
    it('returns the legacy id for a mapped auth user', async () => {
      usersService.findLegacyIdByAuthUser.mockResolvedValue({ legacyUserId: 310740 });

      const result = await controller.byAuthUser('speakasap-portal', 'auth-1');

      expect(usersService.findLegacyIdByAuthUser).toHaveBeenCalledWith('speakasap-portal', 'auth-1');
      expect(result).toEqual({ legacyUserId: 310740 });
    });

    it('404s when the auth user has no legacy mapping', async () => {
      usersService.findLegacyIdByAuthUser.mockResolvedValue(null);

      await expect(controller.byAuthUser('speakasap-portal', 'auth-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('400s on a missing authUserId rather than scanning the whole system', async () => {
      await expect(controller.byAuthUser('speakasap-portal', '')).rejects.toThrow(/authUserId/);
      expect(usersService.findLegacyIdByAuthUser).not.toHaveBeenCalled();
    });

    it('400s on a missing system', async () => {
      await expect(controller.byAuthUser('', 'auth-1')).rejects.toThrow(/system/);
      expect(usersService.findLegacyIdByAuthUser).not.toHaveBeenCalled();
    });

    // Ambiguity surfaces to the caller as a 409 rather than being flattened into a 404.
    // "No mapping" and "several conflicting mappings" need different human responses.
    it('propagates the service conflict when the mapping is ambiguous', async () => {
      usersService.findLegacyIdByAuthUser.mockRejectedValue(new ConflictException('Ambiguous'));

      await expect(controller.byAuthUser('speakasap-portal', 'auth-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  /**
   * Session minting for an already-resolved user. Completes the speakasap portal SSO
   * handoff: `resolve-or-provision-legacy` says who the student is, this issues the
   * session, and the platform never has to fall back to guessing an identity.
   */
  describe('createSession', () => {
    it('returns the minted session for a known user', async () => {
      authService.createSessionForUser.mockResolvedValue({
        accessToken: 'tok-1',
        expiresIn: 43200,
        userId: 'u-1',
      });

      const result = await controller.createSession('u-1');

      expect(authService.createSessionForUser).toHaveBeenCalledWith('u-1');
      expect(result).toEqual({ accessToken: 'tok-1', expiresIn: 43200, userId: 'u-1' });
    });

    it('400s on an empty userId rather than asking auth to look up nothing', async () => {
      await expect(controller.createSession('')).rejects.toThrow(/userId/);
      expect(authService.createSessionForUser).not.toHaveBeenCalled();
    });

    it('propagates a 404 for an unknown user', async () => {
      authService.createSessionForUser.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.createSession('missing')).rejects.toThrow(NotFoundException);
    });

    it('never returns a refresh token, whatever the service hands back', async () => {
      // Defence in depth: if createSessionForUser ever grows one, this route must not
      // forward a long-lived credential into a browser handoff.
      authService.createSessionForUser.mockResolvedValue({
        accessToken: 'tok-1',
        refreshToken: 'should-not-escape',
        expiresIn: 43200,
        userId: 'u-1',
      });

      const result = await controller.createSession('u-1');

      expect(JSON.stringify(result)).not.toContain('should-not-escape');
    });
  });

  /**
   * Offboarding reconciliation for cv-tuning: confirm a userId still resolves to an
   * account without leaking anything beyond that yes/no answer.
   */
  describe('checkExistence', () => {
    const validUserId = 'e9c0e180-c837-404e-a954-a37b56241a80';

    it('returns a minimal exists payload for a known user', async () => {
      usersService.existsById.mockResolvedValue(true);

      const result = await controller.checkExistence(validUserId);

      expect(usersService.existsById).toHaveBeenCalledWith(validUserId);
      expect(result).toEqual({ exists: true, userId: validUserId });
    });

    it('never leaks email or profile fields, whatever the service is asked', async () => {
      usersService.existsById.mockResolvedValue(true);

      const result = await controller.checkExistence(validUserId);

      expect(Object.keys(result).sort()).toEqual(['exists', 'userId']);
    });

    it('404s for a confirmed missing user', async () => {
      usersService.existsById.mockResolvedValue(false);

      await expect(controller.checkExistence(validUserId)).rejects.toThrow(NotFoundException);
    });

    it('400s on a non-UUID userId rather than querying the database', async () => {
      await expect(controller.checkExistence('not-a-uuid')).rejects.toThrow(/UUID/);
      expect(usersService.existsById).not.toHaveBeenCalled();
    });

    it('400s on an empty userId', async () => {
      await expect(controller.checkExistence('')).rejects.toThrow(/UUID/);
      expect(usersService.existsById).not.toHaveBeenCalled();
    });
  });
});
