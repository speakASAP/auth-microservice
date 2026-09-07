import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyAuthToken } from '../jwt-verifier';
import { UsersService } from '../../users/users.service';
import { RolesService } from '../../roles/roles.service';

/**
 * Accepts only a per-pair RS256 Bearer principal holding a named role.
 *
 * Per `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`: one Auth-signed RS256
 * credential per (caller → target) pair. No shared static tokens, no
 * `x-internal-service-token` / `x-service-name` headers.
 *
 * Roles come from the database, not from the token claim, so a revoked role
 * stops working immediately rather than at exp.
 */
@Injectable()
export class InternalServiceOrRoleGuard implements CanActivate {
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
    if (!bearer || !bearer.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return this.acceptRs256(req, bearer.slice('Bearer '.length).trim());
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
}
