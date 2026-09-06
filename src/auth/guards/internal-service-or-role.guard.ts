import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { verifyAuthToken } from '../jwt-verifier';
import { UsersService } from '../../users/users.service';
import { RolesService } from '../../roles/roles.service';

/**
 * Accepts EITHER a per-pair RS256 principal holding a named role, OR the shared
 * `INTERNAL_SERVICE_TOKEN` static string.
 *
 * The static path exists because every current caller of auth's internal routes
 * uses it; removing it here would break them. The RS256 path exists so a caller
 * can present a credential that carries identity, which is the whole point of a
 * per-pair principal: a rejection can be attributed to one caller, and the
 * credential itself is enumerable and therefore probeable.
 *
 * That distinction matters most for the credential prober. A watcher
 * authenticating with the shared static string would be observing the fleet with
 * the one credential shape it cannot observe — no identity, nothing to enumerate,
 * no way to attribute a failure. See
 * `docs/SERVICE_CREDENTIAL_PROBER_PLAN.md` Task E.
 *
 * RS256 is tried first so that a caller presenting a real principal is
 * identified as that principal, never silently accepted as "some holder of the
 * shared secret".
 */
@Injectable()
export class InternalServiceOrRoleGuard implements CanActivate {
  private static readonly logger = new Logger(InternalServiceOrRoleGuard.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Roles permitted on this route, as `internal:<app>:<role>` strings.
   *
   * Set by the subclass rather than a decorator so the requirement is stated at
   * the route that enforces it and cannot drift from the guard applying it.
   */
  protected requiredRoles(): string[] {
    return [];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const bearer: string | undefined = req.headers?.authorization;
    if (bearer && bearer.startsWith('Bearer ')) {
      return this.acceptRs256(req, bearer.slice('Bearer '.length).trim());
    }

    return this.acceptStaticToken(req);
  }

  private async acceptRs256(req: any, token: string): Promise<boolean> {
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: any;
    try {
      payload = await verifyAuthToken(token);
    } catch {
      // Never echo the verifier's reason: it distinguishes "wrong algorithm"
      // from "bad signature" from "expired", which tells an attacker which
      // property of a forged token to fix next.
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    // Roles come from the database, not from the token's own claim. A token
    // carrying a role that was since revoked must not keep working until it
    // expires — for a 90-day service credential that window is the whole point
    // of revoking it.
    const roles = await this.rolesService.getUserRoles(user.id);
    const required = this.requiredRoles();
    if (required.length > 0 && !required.some((r) => roles.includes(r))) {
      throw new UnauthorizedException('Principal lacks the required role');
    }

    req.user = { id: user.id, email: user.email, roles };
    req.authPath = 'rs256';
    return true;
  }

  private acceptStaticToken(req: any): boolean {
    // The migration window. Once every caller presents a per-pair bearer, set
    // ALLOW_INTERNAL_STATIC_TOKEN=false and this path is gone; the variable
    // defaults to open so an unconfigured deploy cannot lock out callers that
    // have not been migrated yet.
    if (process.env.ALLOW_INTERNAL_STATIC_TOKEN === 'false') {
      throw new UnauthorizedException(
        'Static internal service tokens are no longer accepted',
      );
    }

    const token = req.headers['x-internal-service-token'];
    const serviceName = String(req.headers['x-service-name'] || '').trim();
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || '';
    const trustedServices = (process.env.TRUSTED_INTERNAL_SERVICES || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Fail CLOSED. An unset secret must never mean "allow everyone" — and with
    // no bearer token present either, this is the only remaining path.
    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    if (trustedServices.length > 0 && !trustedServices.includes(serviceName)) {
      throw new UnauthorizedException('Service is not trusted');
    }

    // Named at WARN on every acceptance so the migration has an observable exit
    // condition: this line going quiet per caller is what proves that caller no
    // longer needs the shared secret. `exp` on its new credential proves
    // nothing, and neither does a Secret sync.
    //
    // The claimed name is self-asserted and therefore not evidence of identity —
    // it is logged as a lead for finding the caller, not as an audit record.
    InternalServiceOrRoleGuard.logger.warn(
      `Legacy static internal-service token accepted on ${req.method} ${
        req.route?.path ?? req.url
      } (claimed x-service-name: ${serviceName || 'none'}). ` +
        'Migrate this caller to a per-pair RS256 credential.',
    );

    req.authPath = 'static';
    return true;
  }
}
