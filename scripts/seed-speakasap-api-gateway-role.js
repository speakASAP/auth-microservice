#!/usr/bin/env node
/**
 * Ensures `speakasap-api-gateway` exists with `internal:speakasap-api-gateway:proxy`.
 *
 * Gateway `/api/v1/internal/*` entry requires this role (least privilege). Callers
 * mint via provision-service-token.js as svc-<caller>--speakasap-api-gateway@.
 *
 * Dry run:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-speakasap-api-gateway-role.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-speakasap-api-gateway-role.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'speakasap-api-gateway-role-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'speakasap-api-gateway';
const APP_DISPLAY_NAME = 'SpeakASAP API Gateway';
const ROLE_SCOPE = 'internal';
const ROLE_NAME = 'proxy';
const ROLE_DESCRIPTION =
  'Call SpeakASAP api-gateway /api/v1/internal/* entry (second hop stamps GATEWAY_TO_*)';

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
    applicationExisted: false,
    createdApplication: false,
    role: roleString,
    roleExists: false,
    createdRole: false,
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
        result.wouldCreateRole = true;
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

    if (application) {
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
