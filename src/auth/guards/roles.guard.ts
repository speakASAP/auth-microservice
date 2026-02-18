/**
 * Roles Guard
 * Validates JWT token and checks user roles
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UsersService } from '../../users/users.service';
import { RolesService } from '../../roles/roles.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private usersService: UsersService,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const rolesMetadata = this.reflector.getAllAndOverride<{
      roles: string[];
      requireAll?: boolean;
    }>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // If no roles required, allow access
    if (!rolesMetadata || !rolesMetadata.roles || rolesMetadata.roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      // Get user
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid token');
      }

      // Get user roles (from token if available, otherwise from database)
      let userRoles: string[] = payload.roles || [];
      if (!userRoles || userRoles.length === 0) {
        // Fallback to database if roles not in token (backward compatibility)
        userRoles = await this.rolesService.getUserRoles(user.id);
      }

      // Check if user has required roles
      const requiredRoles = rolesMetadata.roles;
      const requireAll = rolesMetadata.requireAll || false;

      if (requireAll) {
        // User must have ALL required roles
        const hasAllRoles = requiredRoles.every((role) => userRoles.includes(role));
        if (!hasAllRoles) {
          throw new ForbiddenException('Insufficient permissions');
        }
      } else {
        // User must have at least ONE required role
        const hasAnyRole = requiredRoles.some((role) => userRoles.includes(role));
        if (!hasAnyRole) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      // Attach user with roles to request for use in controllers
      request.user = {
        ...this.sanitizeUser(user),
        roles: userRoles,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
