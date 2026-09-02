import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

/**
 * One role grant held by a service principal.
 *
 * `application` is the role's application — the service that actually enforces
 * this grant. It is nullable because `user_roles.applicationId` is nullable for
 * global roles; a null here means the grant names no target and the principal
 * cannot be probed through it.
 */
export interface ServicePrincipalGrant {
  application: string | null;
  roleName: string;
  roleScope: string;
  expiresAt: string | null;
}

export interface ServicePrincipalRecord {
  id: string;
  email: string;
  isActive: boolean;
  /**
   * The `svc-<caller>--<target>` target segment, or null when the address does
   * not follow the convention. Reported for cross-checking only — see the note
   * on `targetMismatch` for why it is never the probe target.
   */
  conventionTarget: string | null;
  /** Address follows `svc-<caller>--<target>@internal.alfares.cz` exactly. */
  onConvention: boolean;
  grants: ServicePrincipalGrant[];
  /**
   * True when the address encodes a target that no grant's application matches.
   *
   * This is common rather than exceptional: an address like
   * `svc-allegro-service--orders-microservice` carries an `allegro-service`
   * role, so the address names one service and the enforced grant names
   * another. A prober that trusted the address would probe the wrong receiver
   * and read its answer as a verdict on this credential.
   */
  targetMismatch: boolean;
}

/**
 * Read-only inventory of service principals, for the credential prober.
 *
 * Enumerates from the users table rather than a maintained list, because a list
 * drifts and drift is the failure this exists to catch.
 */
@Injectable()
export class ServicePrincipalsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Selects on `userType = 'service'`, NOT on the `svc-%@internal.alfares.cz`
   * address convention.
   *
   * The convention matches 24 of the 45 service principals in production. The
   * other 21 are equally real and equally able to fail — several sit on
   * unroutable domains (`@internal.invalid`, `@internal.alfares`, `@alfares.local`)
   * and two use `@alfares.cz`, missing the convention by one domain segment.
   * Filtering by address would drop nearly half the fleet without saying so,
   * which is precisely the silent gap being closed.
   */
  async listServicePrincipals(includeInactive = false): Promise<ServicePrincipalRecord[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      // LEFT JOINs throughout: a principal with no grant, or a grant with no
      // application, must still appear so it can be reported unprobeable. An
      // inner join would delete exactly the rows worth looking at.
      .leftJoin('user_roles', 'ur', 'ur."userId" = user.id')
      .leftJoin('roles', 'role', 'role.id = ur."roleId"')
      .leftJoin('applications', 'app', 'app.id = ur."applicationId"')
      .select([
        'user.id AS id',
        'user.email AS email',
        'user."isActive" AS "isActive"',
        'role.name AS "roleName"',
        'role.scope AS "roleScope"',
        'app.name AS "appName"',
        'ur."expiresAt" AS "expiresAt"',
      ])
      .where("user.\"userType\" = 'service'");

    if (!includeInactive) {
      query.andWhere('user."isActive" = true');
    }

    const rows = await query.orderBy('user.email', 'ASC').getRawMany();

    const byId = new Map<string, ServicePrincipalRecord>();

    for (const row of rows) {
      let record = byId.get(row.id);
      if (!record) {
        record = {
          id: row.id,
          email: row.email,
          isActive: row.isActive,
          conventionTarget: this.parseConventionTarget(row.email),
          onConvention: this.isOnConvention(row.email),
          grants: [],
          targetMismatch: false,
        };
        byId.set(row.id, record);
      }

      // A principal with no role at all produces one row of nulls; that is a
      // real state (provisioned, never granted) and must not become a phantom
      // grant.
      if (row.roleName) {
        record.grants.push({
          application: row.appName ?? null,
          roleName: row.roleName,
          roleScope: row.roleScope,
          expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
        });
      }
    }

    for (const record of byId.values()) {
      record.targetMismatch =
        record.conventionTarget !== null &&
        record.grants.length > 0 &&
        !record.grants.some((g) => g.application === record.conventionTarget);
    }

    return Array.from(byId.values());
  }

  private isOnConvention(email: string): boolean {
    return /^svc-[^@]+--[^@]+@internal\.alfares\.cz$/.test(email ?? '');
  }

  /**
   * Pulls the target segment out of `svc-<caller>--<target>@<domain>`.
   *
   * Deliberately accepts any domain: `svc-suppliers-microservice--catalog-microservice@alfares.cz`
   * is off-convention by domain yet still encodes a target worth cross-checking.
   */
  private parseConventionTarget(email: string): string | null {
    const match = (email ?? '').match(/^svc-[^@]*?--([^@]+)@/);
    return match ? match[1] : null;
  }
}
