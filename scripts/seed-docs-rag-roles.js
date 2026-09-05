#!/usr/bin/env node
/**
 * Registers `docs-rag-microservice` as an application and creates its
 * `internal:docs-rag-microservice:readonly` and `:ingest` roles, idempotently.
 *
 * Why this is not in `seed-rbac.ts`: that script's application list is hardcoded
 * and does not include docs-rag, and its per-service internal roles are only
 * `admin` and `action-admin`. Neither `readonly` nor `ingest` exists there, and
 * widening the seed's loop would create `ingest` on every internal service as a
 * side effect of wanting it on one. Same reasoning as
 * `seed-auth-readonly-role.js`, which this follows.
 *
 * Why two roles: docs-RAG's routes split by effect, not verb. `readonly` covers
 * semantic search, agent context and ingestion status - what every consuming
 * service and agent needs. `ingest` covers the two ingestion triggers, one of
 * which re-indexes every repository in the ecosystem. Before this split, any
 * credential that could read one document could also call
 * POST /ingestion/trigger-all.
 *
 * Roles must exist before `provision-service-token.js` can mint against them;
 * that script fails with "Role not found ... Run seed first."
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-docs-rag-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-docs-rag-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'docs-rag-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'docs-rag-microservice';
const APP_DISPLAY_NAME = 'Docs RAG Microservice';
const ROLE_SCOPE = 'internal';
const ROLES = [
  { name: 'readonly', description: 'Read-only retrieval access to docs-RAG (search, agent context, ingestion status)' },
  { name: 'ingest', description: 'Trigger docs-RAG ingestion' },
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
          type: 'internal',
        });
        result.createdApplication = true;
        result.mutatedDatabase = true;
      }
    }

    for (const role of ROLES) {
      const roleString = `${ROLE_SCOPE}:${APP_NAME}:${role.name}`;

      if (!application) {
        // Dry run with no application yet: the role cannot be looked up.
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
