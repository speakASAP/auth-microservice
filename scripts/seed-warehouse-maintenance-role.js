#!/usr/bin/env node
/**
 * Creates the `internal:warehouse-microservice:maintenance` role, idempotently.
 *
 * Needed by POST /api/reservations/expire-due (warehouse-reservation-expiry CronJob).
 * Per SERVICE_IDENTITY_CONSUMER_STANDARD.md: CronJobs are callers and need their own
 * (caller -> target) principal with this least-privilege role.
 *
 * Dry run:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-warehouse-maintenance-role.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-warehouse-maintenance-role.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'warehouse-maintenance-role-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'warehouse-microservice';
const ROLE_SCOPE = 'internal';
const ROLE_NAME = 'maintenance';
const ROLE_DESCRIPTION =
  'Warehouse self-maintenance: reservation TTL expiry CronJob (expire-due)';

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

  const roleString = `${ROLE_SCOPE}:${APP_NAME}:${ROLE_NAME}`;
  const result = {
    contract: CONTRACT,
    mode: apply ? 'apply' : 'dry-run',
    application: APP_NAME,
    role: roleString,
    roleExists: false,
    createdRole: false,
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

    const existing = await rolesService.findByName(ROLE_NAME, ROLE_SCOPE, application.id);
    if (existing) {
      result.roleExists = true;
    } else if (!apply) {
      result.wouldCreateRole = true;
    } else {
      await rolesService.create({
        name: ROLE_NAME,
        scope: ROLE_SCOPE,
        description: ROLE_DESCRIPTION,
        applicationId: application.id,
      });
      result.createdRole = true;
      result.mutatedDatabase = true;
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ contract: CONTRACT, status: 'error', message: error.message }, null, 2));
  process.exit(1);
});
