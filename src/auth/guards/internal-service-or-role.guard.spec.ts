import { UnauthorizedException } from '@nestjs/common';
import { InternalServiceOrRoleGuard } from './internal-service-or-role.guard';
import { verifyAuthToken } from '../jwt-verifier';

jest.mock('../jwt-verifier', () => ({ verifyAuthToken: jest.fn() }));
const mockedVerify = verifyAuthToken as jest.MockedFunction<typeof verifyAuthToken>;

/**
 * The dual-path gate for auth's internal routes.
 *
 * It accepts a per-pair RS256 principal holding a named role, or the shared
 * static token every existing internal caller uses. The RS256 path exists so a
 * credential carries identity: a rejection can be attributed, and the credential
 * is enumerable and therefore probeable. The static path exists so the callers
 * that already work keep working.
 *
 * Both paths must fail closed. An unset secret must never mean "allow everyone".
 */
describe('InternalServiceOrRoleGuard', () => {
  class TestGuard extends InternalServiceOrRoleGuard {
    protected requiredRoles(): string[] {
      return ['internal:auth-microservice:readonly'];
    }
  }

  const ctx = (headers: any) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as any;

  const build = (over: any = {}) => {
    const users = {
      findById: jest.fn(async () => ({ id: 'u1', email: 'svc@internal.alfares.cz', isActive: true })),
      ...over.users,
    };
    const roles = {
      getUserRoles: jest.fn(async () => ['internal:auth-microservice:readonly']),
      ...over.roles,
    };
    return { guard: new TestGuard(users as any, roles as any), users, roles };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_TOKEN = 'shared-secret';
    delete process.env.TRUSTED_INTERNAL_SERVICES;
  });

  describe('RS256 path', () => {
    it('accepts a principal holding the required role', async () => {
      const { guard } = build();
      mockedVerify.mockResolvedValue({ sub: 'u1' } as any);

      const req = { headers: { authorization: 'Bearer good-token' } };
      const context = { switchToHttp: () => ({ getRequest: () => req }) } as any;

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect((req as any).authPath).toBe('rs256');
    });

    it('rejects a principal without the required role', async () => {
      const { guard } = build({ roles: { getUserRoles: jest.fn(async () => ['internal:other:admin']) } });
      mockedVerify.mockResolvedValue({ sub: 'u1' } as any);

      await expect(guard.canActivate(ctx({ authorization: 'Bearer good-token' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('reads roles from the database, not from the token claim', async () => {
      const { guard, roles } = build({ roles: { getUserRoles: jest.fn(async () => []) } });
      // A token claiming the role it no longer holds must not work until expiry.
      // For a 90-day service credential that window is the whole point of revoking.
      mockedVerify.mockResolvedValue({
        sub: 'u1',
        roles: ['internal:auth-microservice:readonly'],
      } as any);

      await expect(guard.canActivate(ctx({ authorization: 'Bearer stale-role-token' }))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(roles.getUserRoles).toHaveBeenCalled();
    });

    it('rejects a deactivated principal', async () => {
      const { guard } = build({
        users: { findById: jest.fn(async () => ({ id: 'u1', isActive: false })) },
      });
      mockedVerify.mockResolvedValue({ sub: 'u1' } as any);

      await expect(guard.canActivate(ctx({ authorization: 'Bearer good-token' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unverifiable token without echoing the reason', async () => {
      const { guard } = build();
      mockedVerify.mockRejectedValue(new Error('Unsupported token algorithm none; RS256 required'));

      // The verifier's reason distinguishes wrong-algorithm from bad-signature
      // from expired, which tells an attacker which property to fix next.
      await expect(guard.canActivate(ctx({ authorization: 'Bearer forged' }))).rejects.toThrow(
        'Invalid token',
      );
    });

    it('does not fall back to the static path when a bearer token fails', async () => {
      const { guard } = build();
      mockedVerify.mockRejectedValue(new Error('bad signature'));

      // Falling back would let a caller present a junk bearer token alongside a
      // stolen static secret and be accepted as an anonymous holder.
      await expect(
        guard.canActivate(
          ctx({ authorization: 'Bearer forged', 'x-internal-service-token': 'shared-secret' }),
        ),
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('static token path', () => {
    it('accepts the shared token', async () => {
      const { guard } = build();
      const req = { headers: { 'x-internal-service-token': 'shared-secret' } };
      const context = { switchToHttp: () => ({ getRequest: () => req }) } as any;

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect((req as any).authPath).toBe('static');
    });

    it('rejects a wrong token', async () => {
      const { guard } = build();
      await expect(guard.canActivate(ctx({ 'x-internal-service-token': 'nope' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('fails closed when the expected secret is unset', async () => {
      const { guard } = build();
      process.env.INTERNAL_SERVICE_TOKEN = '';

      // An empty expected value must never match an empty presented value.
      await expect(guard.canActivate(ctx({ 'x-internal-service-token': '' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('enforces the trusted-service allowlist when configured', async () => {
      const { guard } = build();
      process.env.TRUSTED_INTERNAL_SERVICES = 'monitoring-microservice';

      await expect(
        guard.canActivate(
          ctx({
            'x-internal-service-token': 'shared-secret',
            'x-service-name': 'someone-else',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a request presenting no credential at all', async () => {
      const { guard } = build();
      await expect(guard.canActivate(ctx({}))).rejects.toThrow(UnauthorizedException);
    });
  });

  /**
   * Closing the migration window. Once every caller presents a per-pair bearer,
   * ALLOW_INTERNAL_STATIC_TOKEN=false removes the shared-secret path entirely —
   * that flag flip is what ends the non-conformance, so it must actually bite.
   */
  describe('when the static path is closed', () => {
    afterEach(() => {
      delete process.env.ALLOW_INTERNAL_STATIC_TOKEN;
    });

    it('refuses a valid static token', async () => {
      const { guard } = build();
      process.env.INTERNAL_SERVICE_TOKEN = 'shared-secret';
      delete process.env.TRUSTED_INTERNAL_SERVICES;
      process.env.ALLOW_INTERNAL_STATIC_TOKEN = 'false';

      await expect(
        guard.canActivate(ctx({ 'x-internal-service-token': 'shared-secret' })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('still accepts a per-pair RS256 principal holding the role', async () => {
      const { guard } = build();
      process.env.ALLOW_INTERNAL_STATIC_TOKEN = 'false';
      mockedVerify.mockResolvedValue({ sub: 'u1' } as never);

      await expect(
        guard.canActivate(ctx({ authorization: 'Bearer rs256-token' })),
      ).resolves.toBe(true);
    });
  });
});
