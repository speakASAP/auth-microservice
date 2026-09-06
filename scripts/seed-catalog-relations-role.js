#!/usr/bin/env node
/**
 * Creates the `internal:catalog-microservice:relations` role, idempotently.
 *
 * Why it is needed: the order-affinity write routes under
 * /api/internal/product-relations/order-affinity/* are gated by
 * PRODUCT_RELATION_ADMIN_ROLES, a set distinct from CatalogAuthGuard.WRITE_ROLES
 * and containing only global/app admin roles plus
 * `internal:catalog-microservice:admin`. So the only mintable credential that
 * could write order-affinity relations was catalog admin.
 *
 * That is the same defect the `:write` role fixed one layer down: a role set
 * with no least-privilege mintable member. `internal:catalog-microservice:write`
 * does NOT satisfy these routes -- it is absent from PRODUCT_RELATION_ADMIN_ROLES
 * -- so a second role is required rather than reusing the first.
 *
 * Why not `admin`: the legacy shared-token path granted marketing-microservice
 * exactly [catalog:read, internal:catalog-microservice:admin], so admin would
 * not be an escalation against today. But admin is also listed in
 * allProductAccessRoles (product-relations.service.ts), where it bypasses the
 * per-actor product-visibility check -- far more authority than writing
 * order-affinity rows needs. Roles are classified by effect, per
 * docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md.
 *
 * This role is inert until it is added to PRODUCT_RELATION_ADMIN_ROLES in
 * catalog-microservice and deployed. Seeding first is deliberate:
 * provision-service-token.js hard-fails on a role that does not exist, and a
 * role that nothing enforces grants nothing. Seed, then enforce, then mint.
 *
 * `catalog-microservice` already exists as an application with internal roles,
 * so this script never creates the application; if it is missing, the RBAC
 * baseline is wrong and creating it here would hide that.
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-catalog-relations-role.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-catalog-relations-role.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'catalog-relations-role-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'catalog-microservice';
const ROLE_SCOPE = 'internal';
const ROLE_NAME = 'relations';
const ROLE_DESCRIPTION =
  'Write catalog product-relation order-affinity data (POST /api/internal/product-relations/order-affinity/*)';

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
