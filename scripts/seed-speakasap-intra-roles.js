#!/usr/bin/env node
/**
 * Ensures SpeakASAP intra-service applications and least-privilege machine roles
 * exist, idempotently. Gateway entry already has speakasap-api-gateway/proxy
 * (see seed-speakasap-api-gateway-role.js). Downstream guards and second-hop
 * GATEWAY_TO_* mints need these roles before provision-service-token.js can mint.
 *
 * Guarded today:
 *   internal:user-service:internal
 *   internal:education-service:internal
 *   internal:financial-service:internal
 *   internal:notification-service:dispatch
 *   internal:certification-service:internal
 *
 * Second-hop mintable (may lack @Roles yet):
 *   internal:content-service:internal
 *   internal:salary-service:internal
 *   internal:course-service:internal
 *   internal:payment-service:internal
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-speakasap-intra-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-speakasap-intra-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'speakasap-intra-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';
const ROLE_SCOPE = 'internal';

const TARGETS = [
  {
    name: 'user-service',
    displayName: 'SpeakASAP User Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP user-service internal routes (least privilege machine)',
      },
    ],
  },
  {
    name: 'education-service',
    displayName: 'SpeakASAP Education Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP education-service internal routes (least privilege machine)',
      },
    ],
  },
  {
    name: 'financial-service',
    displayName: 'SpeakASAP Financial Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP financial-service internal routes (least privilege machine)',
      },
    ],
  },
  {
    name: 'notification-service',
    displayName: 'SpeakASAP Notification Service',
    roles: [
      {
        name: 'dispatch',
        description: 'Dispatch SpeakASAP notification-service internal notifications',
      },
    ],
  },
  {
    name: 'certification-service',
    displayName: 'SpeakASAP Certification Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP certification-service internal routes (least privilege machine)',
      },
    ],
  },
  {
    name: 'content-service',
    displayName: 'SpeakASAP Content Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP content-service internal routes (gateway second hop)',
      },
    ],
  },
  {
    name: 'salary-service',
    displayName: 'SpeakASAP Salary Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP salary-service internal routes (gateway second hop)',
      },
    ],
  },
  {
    name: 'course-service',
    displayName: 'SpeakASAP Course Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP course-service internal routes (gateway second hop)',
      },
    ],
  },
  {
    name: 'payment-service',
    displayName: 'SpeakASAP Payment Service',
    roles: [
      {
        name: 'internal',
        description: 'Call SpeakASAP payment-service internal routes (gateway second hop)',
      },
    ],
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
    applications: [],
    mutatedDatabase: false,
    status: 'ok',
  };

  try {
    const applicationsService = app.get(ApplicationsService);
    const rolesService = app.get(RolesService);

    for (const target of TARGETS) {
      const appResult = {
        application: target.name,
        applicationExisted: false,
        createdApplication: false,
        roles: [],
      };

      let application = await applicationsService.findByName(target.name);
      appResult.applicationExisted = Boolean(application);

      if (!application) {
        if (!apply) {
          appResult.wouldCreateApplication = true;
        } else {
          application = await applicationsService.create({
            name: target.name,
            displayName: target.displayName,
            type: 'internal',
          });
          appResult.createdApplication = true;
          result.mutatedDatabase = true;
        }
      }

      for (const role of target.roles) {
        const roleString = `${ROLE_SCOPE}:${target.name}:${role.name}`;

        if (!application) {
          appResult.roles.push({ role: roleString, roleExists: false, wouldCreateRole: true });
          continue;
        }

        const existing = await rolesService.findByName(role.name, ROLE_SCOPE, application.id);
        if (existing) {
          appResult.roles.push({ role: roleString, roleExists: true, createdRole: false });
          continue;
        }

        if (!apply) {
          appResult.roles.push({ role: roleString, roleExists: false, wouldCreateRole: true });
          continue;
        }

        await rolesService.create({
          name: role.name,
          scope: ROLE_SCOPE,
          description: role.description,
          applicationId: application.id,
        });
        appResult.roles.push({ role: roleString, roleExists: false, createdRole: true });
        result.mutatedDatabase = true;
      }

      result.applications.push(appResult);
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
