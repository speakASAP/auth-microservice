import { Injectable } from '@nestjs/common';
import { InternalServiceOrRoleGuard } from '../auth/guards/internal-service-or-role.guard';

/**
 * Gate for the service-principal inventory.
 *
 * `readonly` rather than `admin`: this route lists identities and role names so
 * a watcher can tell which credentials exist. That is a read, and the least
 * privilege that satisfies it. The `readonly` internal role is already the
 * established shape elsewhere in the fleet — logging, backups and warehouse each
 * have one.
 */
@Injectable()
export class ServicePrincipalsGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:readonly'];
  }
}
