/**
 * Ensures `ai-microservice` has `internal:ai-microservice:invoke` and
 * `:operator` roles, idempotently. The application already exists (admin /
 * action-admin from seed-rbac); this adds the least-privilege machine roles
 * required by SERVICE_IDENTITY_CONSUMER_STANDARD.md.
 *
 *   invoke   - inference spend (complete, voice, shop, email-triage, …)
 *   operator - Claude Code / Codex job enqueue
 *
 * Roles must exist before `provision-service-token.js` can mint against them.
 *
 * Dry run (default):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-ai-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-ai-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'ai-microservice-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'ai-microservice';
const APP_DISPLAY_NAME = 'AI Microservice';
const ROLE_SCOPE = 'internal';
const ROLES = [
  {
    name: 'invoke',
    description: 'Invoke AI inference and document extraction endpoints (not code execution)',
  },
  {
    name: 'operator',
    description: 'Enqueue Claude Code / Codex execution jobs on ai-microservice',
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
          type: 'internal',
        });
        result.createdApplication = true;
        result.mutatedDatabase = true;
      }
    }

    for (const role of ROLES) {
      const roleString = `${ROLE_SCOPE}:${APP_NAME}:${role.name}`;

      if (!application) {
        result.roles.push({ role: roleString, roleExists: false, wouldCreateRole: true });
        continue;
      }

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
  console.error(JSON.stringify({ contract: CONTRACT, status: 'error', message: error.message }, null, 2));
  process.exit(1);
});
