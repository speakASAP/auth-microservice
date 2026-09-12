#!/usr/bin/env node
/**
 * Registers `jarvis` as an application and creates its user-facing and internal
 * roles, idempotently.
 *
 * Why this is not in `seed-rbac.ts`: that script's application list is hardcoded
 * and does not include jarvis, and its per-service internal roles are only
 * `admin` and `action-admin`. jarvis needs neither of those names, and widening
 * the seed's loop would create jarvis roles on every internal service as a side
 * effect of wanting them on one. Same reasoning as
 * `seed-screencast-recorder-roles.js`, which this follows.
 *
 * Why these roles: jarvis routes split by effect, not verb.
 *   app:jarvis:user    - read the wiki and ask questions (GET /wiki/*, POST /query)
 *   app:jarvis:editor  - add sources and run health checks (POST /ingest, /lint)
 *   app:jarvis:admin   - manage sources, including deletion
 *   internal:jarvis:query - the least privilege a calling service needs: ask a
 *     question and read a page. RunLayer holds this. It deliberately cannot
 *     ingest, because an ingest mutates accumulated knowledge for everyone.
 *   internal:jarvis:ingest - trigger an ingest. Separate so that a credential
 *     able to read the wiki cannot also rewrite it.
 *
 * Roles must exist before `provision-service-token.js` can mint against them;
 * that script fails with "Role not found ... Run seed first."
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-jarvis-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-jarvis-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'jarvis-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'jarvis';
const APP_DISPLAY_NAME = 'Jarvis';
const APP_TYPE = 'user_facing';
const APP_DOMAIN = 'jarvis.alfares.cz';
const APP_DESCRIPTION =
  'LLM Wiki knowledge layer: owner-curated raw sources compiled into a maintained, citation-backed wiki';

const ROLES = [
  {
    // 'application', NOT 'app'. The role STRING renders as
    // app:<name>:user, but RoleScope.APPLICATION is the value stored on the
    // row, and assignDefaultApplicationAccess looks the default role up by
    // that scope. Seeding 'app' leaves the lookup empty, which surfaces at
    // login as "Invalid credentials" -- a configuration fault wearing a
    // credential fault's message.
    scope: 'application',
    name: 'user',
    description: 'Read the wiki and ask questions: GET /wiki/*, POST /query',
  },
  {
    scope: 'application',
    name: 'editor',
    description: 'Add raw sources and run wiki health checks: POST /ingest, POST /lint',
  },
  {
    scope: 'application',
    name: 'admin',
    description: 'Manage raw sources and wiki pages, including deletion',
  },
  {
    scope: 'internal',
    name: 'query',
    description:
      'Calling service may ask a question and read a page. Cannot ingest: an ingest mutates accumulated knowledge for every consumer',
  },
  {
    scope: 'internal',
    name: 'ingest',
    description: 'Calling service may trigger an ingest of a raw source',
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
      const roleString = `${role.scope === 'application' ? 'app' : role.scope}:${APP_NAME}:${role.name}`;

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
