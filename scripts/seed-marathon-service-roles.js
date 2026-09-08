#!/usr/bin/env node
/**
 * Ensures marathon has internal machine roles:
 *   admin  - portal BFF / manager S2S admin routes
 *   service - payment callbacks and least-privilege machine callers
 *
 * Dry run:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-marathon-service-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-marathon-service-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'marathon-service-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'marathon';
const ROLE_SCOPE = 'internal';
const ROLES = [
  {
    name: 'admin',
    description: 'Machine admin routes for portal manager / BFF callers',
  },
  {
    name: 'service',
    description: 'Least-privilege machine access for payment callbacks and service callers',
  },
];

const args = process.argv.slice(2);
const argValue = (name) => {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};
const hasFlag = (name) => args.includes(name);

async function main() {
  const apply = hasFlag('--apply');

  if (apply && argValue('--confirm-db-mutation') !== DB_CONFIRMATION) {
    throw new Error(`--confirm-db-mutation=${DB_CONFIRMATION} is required for --apply`);
  }

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/src/app.module');
  const { RolesService } = require('../dist/src/roles/roles.service');
  const { ApplicationsService } = require('../dist/src/applications/applications.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const result = {
    contract: CONTRACT,
    mode: apply ? 'apply' : 'dry-run',
    application: APP_NAME,
    roles: [],
    mutatedDatabase: false,
    status: 'ok',
  };

  try {
    const applicationsService = app.get(ApplicationsService);
    const rolesService = app.get(RolesService);

    const application = await applicationsService.findByName(APP_NAME);
    if (!application) {
      throw new Error(`Application ${APP_NAME} not found. Seed base RBAC first.`);
    }

    for (const role of ROLES) {
      const roleString = `${ROLE_SCOPE}:${APP_NAME}:${role.name}`;
      const existing = await rolesService.findByName(role.name, ROLE_SCOPE, application.id);
      if (existing) {
        result.roles.push({ role: roleString, roleExists: true, createdRole: false });
        continue;
      }
      if (!apply) {
        result.roles.push({ role: roleString, roleExists: false, wouldCreateRole: true });
        continue;
      }
      await rolesService.create({
        name: role.name,
        scope: ROLE_SCOPE,
        description: role.description,
        applicationId: application.id,
      });
      result.roles.push({ role: roleString, roleExists: false, createdRole: true });
      result.mutatedDatabase = true;
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ contract: CONTRACT, status: 'failed', error: error.message }));
  process.exit(1);
});
