import { UnauthorizedException } from '@nestjs/common';
import {
  InternalEmailCheckGuard,
  InternalMagicLinkGuard,
  InternalPreferencesGuard,
  InternalUserExistenceGuard,
} from './internal-route.guards';
import { verifyAuthToken } from '../jwt-verifier';

jest.mock('../jwt-verifier', () => ({ verifyAuthToken: jest.fn() }));
const mockedVerify = verifyAuthToken as jest.MockedFunction<typeof verifyAuthToken>;

describe('internal route guards', () => {
  const ctx = (headers: Record<string, string> = {}) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as any;

  const build = (Guard: new (...args: any[]) => any, rolesForPrincipal: string[]) => {
    const users = {
      findById: jest.fn(async () => ({
        id: 'service-principal-id',
        email: 'svc-caller--auth-microservice@internal.alfares.cz',
        isActive: true,
      })),
    };
    const roles = {
      getUserRoles: jest.fn(async () => rolesForPrincipal),
    };

    return { guard: new Guard(users as any, roles as any), roles, users };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedVerify.mockResolvedValue({ sub: 'service-principal-id' } as any);
    process.env.ALLOW_INTERNAL_STATIC_TOKEN = 'false';
  });

  afterEach(() => {
    delete process.env.ALLOW_INTERNAL_STATIC_TOKEN;
  });

  const routeRoles = [
    {
      name: 'email check',
      Guard: InternalEmailCheckGuard,
      allowed: 'internal:auth-microservice:email-check',
      sibling: 'internal:auth-microservice:magic-link',
    },
    {
      name: 'user existence',
      Guard: InternalUserExistenceGuard,
      allowed: 'internal:auth-microservice:user-existence',
      sibling: 'internal:auth-microservice:email-check',
    },
    {
      name: 'preferences',
      Guard: InternalPreferencesGuard,
      allowed: 'internal:auth-microservice:preferences',
      sibling: 'internal:auth-microservice:user-existence',
    },
    {
      name: 'magic link',
      Guard: InternalMagicLinkGuard,
      allowed: 'internal:auth-microservice:magic-link',
      sibling: 'internal:auth-microservice:email-check',
    },
  ];

  it.each(routeRoles)('accepts the $name route principal with its route role', async ({ Guard, allowed }) => {
    const { guard } = build(Guard, [allowed]);

    await expect(guard.canActivate(ctx({ authorization: 'Bearer route-token' }))).resolves.toBe(true);
  });

  it.each(routeRoles)('rejects the $name route principal when it only has a sibling route role', async ({ Guard, sibling }) => {
    const { guard, roles, users } = build(Guard, [sibling]);

    await expect(guard.canActivate(ctx({ authorization: 'Bearer route-token' }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users.findById).toHaveBeenCalledWith('service-principal-id');
    expect(roles.getUserRoles).toHaveBeenCalledWith('service-principal-id');
  });
});
