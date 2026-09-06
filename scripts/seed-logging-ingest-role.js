#!/usr/bin/env node
/**
 * Creates the `internal:logging-microservice:ingest` role, idempotently.
 *
 * Why it is needed: `POST /api/logs` was gated by static shared credential sets
 * (`LOG_INGEST_API_KEYS`, `LOG_INGEST_BEARER_TOKENS`), which
 * `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md` prohibits. `LogIngestGuard` now
 * verifies an Auth-issued per-pair credential first and requires this role;
 * `provision-service-token.js` cannot mint against it until it exists.
 *
 * Why `ingest` and not the existing `admin`/`readonly`: logging already has
 * both, but neither fits. `readonly` cannot authorize a write, and `admin` is
 * far more authority than appending a log line needs — roughly twenty services
 * ingest here, and granting each of them logging-admin to write a log line would
 * make the fleet's least-privileged call one of its most privileged credentials.
 * Roles are classified by effect, per the standard.
 *
 * `logging-microservice` already exists as an application with internal roles,
 * so unlike seed-docs-rag-roles.js this script never creates the application; if
 * it is missing, the RBAC baseline is wrong and creating it here would hide that.
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-logging-ingest-role.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-logging-ingest-role.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'logging-ingest-role-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'logging-microservice';
const ROLE_SCOPE = 'internal';
const ROLE_NAME = 'ingest';
const ROLE_DESCRIPTION = 'Write log entries to logging-microservice (POST /api/logs)';

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
