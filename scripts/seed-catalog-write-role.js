#!/usr/bin/env node
/**
 * Creates the `internal:catalog-microservice:write` role, idempotently.
 *
 * Why it is needed: catalog's product, media and pricing write routes accept
 * only `CatalogAuthGuard.WRITE_ROLES`, and every entry in that set is either a
 * global/app admin role or the legacy `catalog:write` string. `catalog:write`
 * cannot be minted at all — provision-service-token.js rejects anything that is
 * not `internal:<service>:<role>` — so today the ONLY mintable credential that
 * can write to catalog is `internal:catalog-microservice:admin`.
 *
 * That is the gap this role closes. Migrating a caller off the prohibited
 * shared static token
 * (`docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`) currently forces an upgrade
 * from write to admin, so the compliance fix would itself be a privilege
 * escalation. The legacy path granted allegro-service exactly
 * ['catalog:read','catalog:write'] — write, never admin — and the replacement
 * must not grant more than the thing it replaces.
 *
 * Why `write` and not the existing `service`/`admin`: catalog has both, but
 * neither fits. `service` is not in WRITE_ROLES, so it cannot authorize a write;
 * `admin` is far more authority than importing a product needs, and
 * `internal:catalog-microservice:admin` additionally appears in
 * `allProductAccessRoles` (product-relations.service.ts), so granting it would
 * also bypass the per-actor product-visibility check. Roles are classified by
 * effect, per the standard.
 *
 * This role is inert until `internal:catalog-microservice:write` is added to
 * `CatalogAuthGuard.WRITE_ROLES` in catalog-microservice and deployed. Seeding
 * first is deliberate: provision-service-token.js hard-fails on a role that does
 * not exist, and a role that nothing enforces grants nothing — per the standard,
 * "a role claim that is not enforced does not grant a safe authorization
 * boundary." Seed, then enforce, then mint.
 *
 * `catalog-microservice` already exists as an application with internal roles,
 * so unlike seed-docs-rag-roles.js this script never creates the application; if
 * it is missing, the RBAC baseline is wrong and creating it here would hide that.
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-catalog-write-role.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-catalog-write-role.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'catalog-write-role-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'catalog-microservice';
const ROLE_SCOPE = 'internal';
const ROLE_NAME = 'write';
const ROLE_DESCRIPTION =
  'Create and update catalog products, media and pricing (POST/PUT /api/products, /api/media, /api/pricing)';

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
