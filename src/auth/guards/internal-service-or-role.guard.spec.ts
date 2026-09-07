import { UnauthorizedException } from '@nestjs/common';
import { InternalServiceOrRoleGuard } from './internal-service-or-role.guard';
import { verifyAuthToken } from '../jwt-verifier';

jest.mock('../jwt-verifier', () => ({ verifyAuthToken: jest.fn() }));
const mockedVerify = verifyAuthToken as jest.MockedFunction<typeof verifyAuthToken>;

/**
 * RS256-only gate for auth's internal routes.
 *
 * Accepts a per-pair RS256 principal holding a named role. Static shared
 * tokens and self-asserted service-name headers are rejected.
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

    it('does not fall back to a static header when a bearer token fails', async () => {
      const { guard } = build();
      mockedVerify.mockRejectedValue(new Error('bad signature'));

      await expect(
        guard.canActivate(
          ctx({ authorization: 'Bearer forged', 'x-internal-service-token': 'shared-secret' }),
        ),
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('static token path (removed)', () => {
    it('rejects a shared static token', async () => {
      const { guard } = build();
      await expect(
        guard.canActivate(ctx({ 'x-internal-service-token': 'shared-secret' })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong static token', async () => {
      const { guard } = build();
      await expect(guard.canActivate(ctx({ 'x-internal-service-token': 'nope' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects empty static credentials', async () => {
      const { guard } = build();
      await expect(guard.canActivate(ctx({ 'x-internal-service-token': '' }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects static token even with a trusted x-service-name', async () => {
      const { guard } = build();
      await expect(
        guard.canActivate(
          ctx({
            'x-internal-service-token': 'shared-secret',
            'x-service-name': 'monitoring-microservice',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a request presenting no credential at all', async () => {
      const { guard } = build();
      await expect(guard.canActivate(ctx({}))).rejects.toThrow(UnauthorizedException);
    });
  });
});
