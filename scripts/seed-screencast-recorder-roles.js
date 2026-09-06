#!/usr/bin/env node
/**
 * Registers `screencast-recorder` as a user-facing application and creates the
 * two roles it needs, idempotently.
 *
 * Two roles because the service has two distinct identity lanes, and the
 * service identity standard forbids mixing them:
 *
 *   app:screencast-recorder:user        the human operator signing in through
 *                                       hosted Auth. Hosted Auth grants this on
 *                                       first successful sign-in; without this
 *                                       exact default role a valid password or
 *                                       one-time code fails *after* the
 *                                       credential is verified.
 *
 *   internal:screencast-recorder:agent  the host-bound recording agent calling
 *                                       the API as a machine. Least privilege:
 *                                       it registers itself, reports
 *                                       capabilities, long-polls for commands
 *                                       and reports track progress. It is not
 *                                       an admin and never acts as a user.
 *
 * Why this is not in `seed-rbac.ts`: that script's application list is
 * hardcoded and does not include screencast-recorder, and its per-service
 * internal roles are only `admin` and `action-admin`. `agent` exists on no
 * other service, and widening the seed's loop would create it everywhere as a
 * side effect of wanting it here. Same reasoning as `seed-docs-rag-roles.js`,
 * which this follows.
 *
 * Roles must exist before `provision-service-token.js` can mint against them;
 * that script fails with "Application ... not found for role ... Run seed
 * first."
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-screencast-recorder-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-screencast-recorder-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'screencast-recorder-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'screencast-recorder';
const APP_DISPLAY_NAME = 'Screencast Recorder';
const APP_TYPE = 'user_facing';
const APP_DOMAIN = 'screencast.alfares.cz';
const APP_DESCRIPTION =
  'Multi-machine screencast capture: session control plane and operator UI';

const ROLES = [
  {
    scope: 'app',
    name: 'user',
    description:
      'Operator access to the recording UI: create, control, review, save and discard own sessions',
  },
  {
    scope: 'internal',
    name: 'agent',
    description:
      'Host-bound recording agent: self-registration, capability reporting, command long-poll and track progress',
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

  // Deferred until arguments are validated, matching provision-service-token.js:
  // importing app.module eagerly throws when signing config is absent.
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/src/app.module');
  const { RolesService } = require('../dist/src/roles/roles.service');
  const { ApplicationsService } = require('../dist/src/applications/applications.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const result = {
    contract: CONTRACT,
    mode: apply ? 'apply' : 'dry-run',
    application: APP_NAME,
    applicationExisted: false,
    createdApplication: false,
    roles: [],
    mutatedDatabase: false,
    status: 'ok',
  };

  try {
    const applicationsService = app.get(ApplicationsService);
    const rolesService = app.get(RolesService);

    let application = await applicationsService.findByName(APP_NAME);
    result.applicationExisted = Boolean(application);

    if (!application) {
      if (!apply) {
        result.wouldCreateApplication = true;
      } else {
        application = await applicationsService.create({
          name: APP_NAME,
          displayName: APP_DISPLAY_NAME,
          type: APP_TYPE,
          domain: APP_DOMAIN,
          description: APP_DESCRIPTION,
        });
        result.createdApplication = true;
        result.mutatedDatabase = true;
      }
    }

    for (const role of ROLES) {
      const roleString = `${role.scope}:${APP_NAME}:${role.name}`;

      if (!application) {
        // Dry run with no application yet: the role cannot be looked up.
        result.roles.push({ role: roleString, roleExists: false, wouldCreateRole: true });
        continue;
      }

      const existing = await rolesService.findByName(role.name, role.scope, application.id);
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
        scope: role.scope,
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
  console.error(JSON.stringify({ contract: CONTRACT, status: 'error', message: error.message }, null, 2));
  process.exit(1);
});
