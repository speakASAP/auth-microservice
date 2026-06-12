/**
 * Roles Service
 * Manages roles and user role assignments
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleScope } from './entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { Application } from '../applications/entities/application.entity';
import { LoggerService } from '../../shared/logger/logger.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
    private readonly logger: LoggerService,
  ) {}

  private audit(
    operation: string,
    outcome: string,
    details: Record<string, string | number | boolean | undefined | null>,
  ): void {
    const message = Object.entries({
      service: 'auth-microservice',
      operation,
      outcome,
      ...details,
    })
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${String(value).replace(/\s+/g, '_')}`)
      .join(' ');
    this.logger.log(message, 'RoleAudit');
  }

  async create(data: {
    name: string;
    scope: RoleScope;
    applicationId?: string;
    description?: string;
  }): Promise<Role> {
    // Check if role already exists
    const existing = await this.rolesRepository.findOne({
      where: {
        name: data.name,
        scope: data.scope,
        applicationId: data.applicationId || null,
      },
    });

    if (existing) {
      this.logger.warn(`Role already exists: ${data.name} (${data.scope})`, 'RolesService');
      throw new ConflictException(`Role '${data.name}' with scope '${data.scope}' already exists`);
    }

    const role = this.rolesRepository.create({
      name: data.name,
      scope: data.scope,
      applicationId: data.applicationId,
      description: data.description,
      isActive: true,
    });

    const saved = await this.rolesRepository.save(role);
    this.logger.log(`Role created: ${data.name} (${data.scope})`, 'RolesService');

    return saved;
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find({
      order: { scope: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role with id '${id}' not found`);
    }

    return role;
  }

  async findByName(name: string, scope: RoleScope, applicationId?: string): Promise<Role | null> {
    return this.rolesRepository.findOne({
      where: {
        name,
        scope,
        applicationId: applicationId || null,
      },
    });
  }

  async getUserRoles(userId: string): Promise<string[]> {
    // Single query with joins to avoid N+1 and ensure application is loaded
    const userRoles = await this.userRolesRepository
      .createQueryBuilder('ur')
      .leftJoinAndSelect('ur.role', 'role')
      .leftJoinAndSelect('ur.application', 'app')
      .where('ur.userId = :userId', { userId })
      .getMany();

    // Filter out expired roles
    const now = new Date();
    const activeRoles = userRoles.filter(
      (ur) => !ur.expiresAt || ur.expiresAt > now,
    );

    // Build role strings: scope:name or scope:app-name:name
    const roleStrings: string[] = [];

    for (const userRole of activeRoles) {
      const role = userRole.role;
      if (!role) continue;

      let roleString = '';

      if (role.scope === RoleScope.GLOBAL) {
        roleString = `global:${role.name}`;
      } else if (role.scope === RoleScope.APPLICATION) {
        const app = userRole.application;
        if (app) {
          roleString = `app:${app.name}:${role.name}`;
        } else if (userRole.applicationId) {
          const appFetched = await this.applicationsRepository.findOne({
            where: { id: userRole.applicationId },
          });
          if (appFetched) {
            roleString = `app:${appFetched.name}:${role.name}`;
          }
        }
      } else if (role.scope === RoleScope.INTERNAL) {
        const app = userRole.application;
        if (app) {
          roleString = `internal:${app.name}:${role.name}`;
        } else if (userRole.applicationId) {
          const appFetched = await this.applicationsRepository.findOne({
            where: { id: userRole.applicationId },
          });
          if (appFetched) {
            roleString = `internal:${appFetched.name}:${role.name}`;
          }
        }
      }

      if (roleString) {
        roleStrings.push(roleString);
      }
    }

    return roleStrings;
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    applicationId?: string,
    grantedBy?: string,
    expiresAt?: Date,
  ): Promise<UserRole> {
    const startedAt = Date.now();
    // Check if assignment already exists
    const existing = await this.userRolesRepository.findOne({
      where: {
        userId,
        roleId,
        applicationId: applicationId || null,
      },
    });

    if (existing) {
      this.audit('role_assign', 'failure', {
        target_user_id: userId,
        role_id: roleId,
        application_id: applicationId,
        actor_id: grantedBy,
        reason: 'already_assigned',
        duration_ms: Date.now() - startedAt,
      });
      throw new ConflictException('Role already assigned to user');
    }

    const userRole = this.userRolesRepository.create({
      userId,
      roleId,
      applicationId,
      grantedBy,
      expiresAt,
    });

    const saved = await this.userRolesRepository.save(userRole);
    this.audit('role_assign', 'success', {
      target_user_id: userId,
      role_id: roleId,
      application_id: applicationId,
      actor_id: grantedBy,
      expires_at: expiresAt?.toISOString(),
      duration_ms: Date.now() - startedAt,
    });

    return saved;
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    applicationId?: string,
    removedBy?: string,
  ): Promise<void> {
    const startedAt = Date.now();
    const userRole = await this.userRolesRepository.findOne({
      where: {
        userId,
        roleId,
        applicationId: applicationId || null,
      },
    });

    if (!userRole) {
      this.audit('role_remove', 'failure', {
        target_user_id: userId,
        role_id: roleId,
        application_id: applicationId,
        actor_id: removedBy,
        reason: 'assignment_not_found',
        duration_ms: Date.now() - startedAt,
      });
      throw new NotFoundException('Role assignment not found');
    }

    await this.userRolesRepository.remove(userRole);
    this.audit('role_remove', 'success', {
      target_user_id: userId,
      role_id: roleId,
      application_id: applicationId,
      actor_id: removedBy,
      duration_ms: Date.now() - startedAt,
    });
  }

  async getUserRolesForApplication(userId: string, applicationId: string): Promise<string[]> {
    const userRoles = await this.userRolesRepository.find({
      where: { userId, applicationId },
      relations: ['role'],
    });

    const now = new Date();
    const activeRoles = userRoles.filter(
      (ur) => !ur.expiresAt || ur.expiresAt > now,
    );

    return activeRoles.map((ur) => ur.role.name);
  }
}
