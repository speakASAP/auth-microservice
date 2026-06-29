#!/usr/bin/env ts-node
/**
 * Assign a role to a user by email (no admin UI required).
 * Use after seed: run once to give a user global:superadmin, app:shop-assistant:admin,
 * or internal:warehouse-microservice:admin.
 *
 * Usage: npx ts-node scripts/assign-role-by-email.ts --email=user@example.com --role=global:superadmin
 *        npx ts-node scripts/assign-role-by-email.ts --email=user@example.com --role=app:shop-assistant:admin
 *        npx ts-node scripts/assign-role-by-email.ts --email=service@example.com --role=internal:warehouse-microservice:admin --dry-run
 * Run from auth-microservice dir. Loads .env for DB.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ApplicationsService } from '../src/applications/applications.service';
import { RolesService } from '../src/roles/roles.service';
import { UsersService } from '../src/users/users.service';
import { RoleScope } from '../src/roles/entities/role.entity';

const VALID_ROLE_EXAMPLES = [
  'global:superadmin',
  'app:shop-assistant:admin',
  'internal:warehouse-microservice:admin',
];

function parseRoleString(roleStr: string): { name: string; scope: RoleScope; appName?: string } | null {
  const trimmed = (roleStr || '').trim();
  if (trimmed === 'global:superadmin') {
    return { name: 'superadmin', scope: RoleScope.GLOBAL };
  }
  const appMatch = trimmed.match(/^app:([^:]+):(.+)$/);
  if (appMatch) {
    return { name: appMatch[2], scope: RoleScope.APPLICATION, appName: appMatch[1] };
  }
  const internalMatch = trimmed.match(/^internal:([^:]+):(.+)$/);
  if (internalMatch) {
    return { name: internalMatch[2], scope: RoleScope.INTERNAL, appName: internalMatch[1] };
  }
  return null;
}

async function run() {
  const args = process.argv.slice(2);
  let email = '';
  let roleStr = '';
  let dryRun = false;
  for (const arg of args) {
    if (arg.startsWith('--email=')) email = arg.split('=')[1].trim();
    if (arg.startsWith('--role=')) roleStr = arg.split('=')[1].trim();
    if (arg === '--dry-run') dryRun = true;
  }

  if (!email || !roleStr) {
    console.error('Usage: npx ts-node scripts/assign-role-by-email.ts --email=user@example.com --role=ROLE [--dry-run]');
    console.error('  Role examples:', VALID_ROLE_EXAMPLES.join(', '));
    process.exit(1);
  }

  const parsed = parseRoleString(roleStr);
  if (!parsed) {
    console.error('Invalid --role. Use global:<role>, app:<application>:<role>, or internal:<service>:<role>.');
    console.error('  Role examples:', VALID_ROLE_EXAMPLES.join(', '));
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const applicationsService = app.get(ApplicationsService);
  const rolesService = app.get(RolesService);
  const usersService = app.get(UsersService);

  try {
    const user = await usersService.findByEmail(email);
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    let roleId: string;
    let applicationId: string | undefined;

    if (parsed.scope === RoleScope.GLOBAL) {
      const role = await rolesService.findByName(parsed.name, RoleScope.GLOBAL);
      if (!role) {
        console.error(`Role not found: global:${parsed.name}. Run seed first: ./scripts/seed-rbac.sh`);
        process.exit(1);
      }
      roleId = role.id;
    } else {
      const appName = parsed.appName;
      if (!appName) {
        console.error('Application name missing for scoped role');
        process.exit(1);
      }
      const application = await applicationsService.findByName(appName);
      if (!application) {
        console.error(`Application not found: ${appName}. Run seed first: ./scripts/seed-rbac.sh`);
        process.exit(1);
      }
      applicationId = application.id;
      const role = await rolesService.findByName(parsed.name, parsed.scope, applicationId);
      if (!role) {
        const roleScope = parsed.scope === RoleScope.INTERNAL ? 'internal' : 'app';
        console.error(`Role not found: ${roleScope}:${appName}:${parsed.name}. Run seed first: ./scripts/seed-rbac.sh`);
        process.exit(1);
      }
      roleId = role.id;
    }

    if (dryRun) {
      console.log(`Dry run: would assign ${roleStr} to ${email}`);
      return;
    }

    try {
      await rolesService.assignRoleToUser(user.id, roleId, applicationId);
      console.log(`Assigned ${roleStr} to ${email}`);
    } catch (e: any) {
      if (e.message?.includes('already assigned')) {
        console.log(`Role ${roleStr} was already assigned to ${email}`);
      } else {
        throw e;
      }
    }
  } finally {
    await app.close();
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
