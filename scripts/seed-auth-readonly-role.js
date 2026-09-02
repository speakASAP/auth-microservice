#!/usr/bin/env node
/**
 * Creates the `internal:auth-microservice:readonly` role, idempotently.
 *
 * Why this is not in `seed-rbac.ts`: that script creates internal roles only for
 * applications typed INTERNAL, and `auth-microservice` is typed INFRASTRUCTURE
 * (see `inferType`). It therefore has no internal roles at all today. Widening
 * the seed's loop would create `admin` and `action-admin` on auth — and on every
 * other infrastructure app — as a side effect of wanting one readonly role here.
 *
 * `readonly` rather than `admin` is the point: the role gates the
 * service-principal inventory, which is a read. Granting a monitoring principal
 * `admin` on auth-microservice would be far more authority than listing
 * identities requires. `readonly` is already the established shape elsewhere —
 * logging, backups and warehouse each have one.
 *
 * Runs inside the auth pod against the compiled dist/, like
 * provision-service-token.js, so DB credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-auth-readonly-role.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-auth-readonly-role.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'auth-readonly-role-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'auth-microservice';
const ROLE_NAME = 'readonly';
const ROLE_SCOPE = 'internal';

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

  // Deferred until arguments are validated, matching provision-service-token.js:
  // importing app.module eagerly throws when signing config is absent.
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/src/app.module');
  const { RolesService } = require('../dist/src/roles/roles.service');
  const { ApplicationsService } = require('../dist/src/applications/applications.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const applicationsService = app.get(ApplicationsService);
    const rolesService = app.get(RolesService);

    const application = await applicationsService.findByName(APP_NAME);
    if (!application) {
      throw new Error(`Application "${APP_NAME}" not found. Run seed-rbac first.`);
    }

    const existing = await rolesService.findByName(ROLE_NAME, ROLE_SCOPE, application.id);

    if (existing) {
      console.log(
        JSON.stringify(
          {
            contract: CONTRACT,
            mode: apply ? 'apply' : 'dry-run',
            role: `${ROLE_SCOPE}:${APP_NAME}:${ROLE_NAME}`,
            roleExists: true,
            mutatedDatabase: false,
            status: 'ok',
            note: 'Role already present; nothing to do.',
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!apply) {
      console.log(
        JSON.stringify(
          {
            contract: CONTRACT,
            mode: 'dry-run',
            role: `${ROLE_SCOPE}:${APP_NAME}:${ROLE_NAME}`,
            roleExists: false,
            wouldCreateRole: true,
            mutatesDatabase: false,
            status: 'ok',
          },
          null,
          2,
        ),
      );
      return;
    }

    const role = await rolesService.create({
      name: ROLE_NAME,
      scope: ROLE_SCOPE,
      applicationId: application.id,
      description: 'Read-only access to internal inventory routes for Auth Microservice',
    });

    // Verify rather than trust the create call: a role that silently failed to
    // land would surface later as an unexplained 401 on the inventory route.
    const confirmed = await rolesService.findByName(ROLE_NAME, ROLE_SCOPE, application.id);
    if (!confirmed) {
      throw new Error('Role creation reported success but the role cannot be read back');
    }

    console.log(
      JSON.stringify(
        {
          contract: CONTRACT,
          mode: 'apply',
          role: `${ROLE_SCOPE}:${APP_NAME}:${ROLE_NAME}`,
          roleId: role.id,
          mutatedDatabase: true,
          status: 'ok',
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ contract: CONTRACT, status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});
