#!/usr/bin/env ts-node
/**
 * Approval-gated helper for the Catalog -> Warehouse Auth-compatible bearer path.
 *
 * Dry-run example:
 *   npx ts-node scripts/provision-catalog-warehouse-service-token.ts --email=service@example.com --dry-run --create-if-missing
 *
 * Apply example:
 *   npx ts-node scripts/provision-catalog-warehouse-service-token.ts --email=service@example.com --create-if-missing --apply \
 *     --confirm-db-mutation=CATALOG_WAREHOUSE_SERVICE_PRINCIPAL \
 *     --confirm-token-issuance=CATALOG_WAREHOUSE_SERVICE_JWT \
 *     --token-output=/secure/operator/path/catalog-warehouse.jwt
 *
 * The token value is never printed. It is written only to --token-output with mode 0600.
 */

import { config } from 'dotenv';
import { chmodSync, writeFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ApplicationsService } from '../src/applications/applications.service';
import { RolesService } from '../src/roles/roles.service';
import { UsersService } from '../src/users/users.service';
import { RoleScope } from '../src/roles/entities/role.entity';
import { User } from '../src/users/entities/user.entity';

const DEFAULT_SERVICE_NAME = 'catalog-microservice';
const DEFAULT_ROLE = 'internal:warehouse-microservice:admin';
const DB_CONFIRMATION = 'CATALOG_WAREHOUSE_SERVICE_PRINCIPAL';
const TOKEN_CONFIRMATION = 'CATALOG_WAREHOUSE_SERVICE_JWT';

type ParsedRole = {
  name: string;
  scope: RoleScope;
  appName?: string;
};

function argValue(args: string[], name: string): string {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseInternalRole(role: string): ParsedRole {
  const match = role.trim().match(/^internal:([^:]+):(.+)$/);
  if (!match) {
    throw new Error('Only internal:<service>:<role> role strings are supported by this helper');
  }
  return { scope: RoleScope.INTERNAL, appName: match[1], name: match[2] };
}

function tokenOutputPath(rawPath: string): string {
  if (!rawPath) {
    throw new Error('--token-output is required when --apply is used');
  }
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function sanitizeUserForReport(user: User | null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    isActive: user.isActive,
    isVerified: user.isVerified,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const email = argValue(args, '--email').toLowerCase();
  const serviceName = argValue(args, '--service-name') || DEFAULT_SERVICE_NAME;
  const roleString = argValue(args, '--role') || DEFAULT_ROLE;
  const expiresIn = argValue(args, '--expires-in') || process.env.SERVICE_JWT_EXPIRES_IN || '30d';
  const dryRun = hasFlag(args, '--dry-run');
  const apply = hasFlag(args, '--apply');
  const createIfMissing = hasFlag(args, '--create-if-missing');
  const confirmDbMutation = argValue(args, '--confirm-db-mutation');
  const confirmTokenIssuance = argValue(args, '--confirm-token-issuance');
  const outputPath = argValue(args, '--token-output');

  if (!email) {
    throw new Error('--email is required');
  }
  if (dryRun === apply) {
    throw new Error('Use exactly one of --dry-run or --apply');
  }
  if (apply && confirmDbMutation !== DB_CONFIRMATION) {
    throw new Error(`--confirm-db-mutation=${DB_CONFIRMATION} is required for --apply`);
  }
  if (apply && confirmTokenIssuance !== TOKEN_CONFIRMATION) {
    throw new Error(`--confirm-token-issuance=${TOKEN_CONFIRMATION} is required for --apply`);
  }

  const parsedRole = parseInternalRole(roleString);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const usersService = app.get(UsersService);
  const applicationsService = app.get(ApplicationsService);
  const rolesService = app.get(RolesService);
  const jwtService = app.get(JwtService);

  try {
    const application = await applicationsService.findByName(parsedRole.appName);
    if (!application) {
      throw new Error(`Application not found for role ${roleString}. Run seed first.`);
    }
    const role = await rolesService.findByName(parsedRole.name, parsedRole.scope, application.id);
    if (!role) {
      throw new Error(`Role not found for ${roleString}. Run seed first.`);
    }

    let user = await usersService.findByEmail(email);
    const wouldCreateUser = !user && createIfMissing;
    const wouldAssignRole = Boolean(user || wouldCreateUser);

    if (!user && !createIfMissing) {
      throw new Error('Service principal user does not exist. Re-run with --create-if-missing after owner approval.');
    }
    if (user && user.userType !== 'service') {
      throw new Error(`Existing user ${email} has userType=${user.userType}; refusing to use a non-service principal.`);
    }

    if (dryRun) {
      console.log(JSON.stringify({
        contract: 'auth-catalog-warehouse-service-token-provisioning.v1',
        mode: 'dry-run',
        mutatesDatabase: false,
        emitsToken: false,
        serviceName,
        role: roleString,
        principal: sanitizeUserForReport(user),
        wouldCreateUser,
        wouldAssignRole,
        tokenOutputRequiredForApply: true,
        status: 'ready-for-owner-approval',
      }, null, 2));
      return;
    }

    if (!user) {
      user = await usersService.create({
        email,
        name: serviceName,
        source: 'service-principal',
        userType: 'service',
        isActive: true,
        isVerified: true,
        perApplicationPreferences: {
          serviceIdentity: {
            serviceName,
            clientId: serviceName,
            authMethod: 'auth-service-jwt',
          },
        },
      });
    } else {
      user = await usersService.update(user.id, {
        name: user.name || serviceName,
        userType: 'service',
        isActive: true,
        isVerified: true,
        perApplicationPreferences: {
          ...(user.perApplicationPreferences || {}),
          serviceIdentity: {
            serviceName,
            clientId: serviceName,
            authMethod: 'auth-service-jwt',
          },
        },
      });
    }

    try {
      await rolesService.assignRoleToUser(user.id, role.id, application.id);
    } catch (error: any) {
      if (!String(error?.message || '').includes('already assigned')) {
        throw error;
      }
    }

    const roles = await rolesService.getUserRoles(user.id);
    if (!roles.includes(roleString)) {
      throw new Error(`Role assignment did not produce required role ${roleString}`);
    }

    const token = jwtService.sign({
      sub: user.id,
      email: user.email,
      type: 'service',
      roles,
      serviceName,
      service: serviceName,
      clientId: serviceName,
      auth_method: 'auth-service-jwt',
    }, { expiresIn });

    const resolvedOutputPath = tokenOutputPath(outputPath);
    writeFileSync(resolvedOutputPath, `${token}\n`, { mode: 0o600 });
    chmodSync(resolvedOutputPath, 0o600);

    console.log(JSON.stringify({
      contract: 'auth-catalog-warehouse-service-token-provisioning.v1',
      mode: 'apply',
      mutatesDatabase: true,
      emitsToken: true,
      tokenPrinted: false,
      tokenOutputPath: resolvedOutputPath,
      tokenFileMode: '0600',
      serviceName,
      role: roleString,
      principal: sanitizeUserForReport(user),
      roleAssigned: true,
      status: 'ok',
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(JSON.stringify({
    contract: 'auth-catalog-warehouse-service-token-provisioning.v1',
    status: 'failed',
    error: error?.message || 'unknown error',
  }, null, 2));
  process.exit(1);
});
