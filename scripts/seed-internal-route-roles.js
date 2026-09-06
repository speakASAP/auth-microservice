#!/usr/bin/env node
/**
 * Creates the least-privilege `internal:auth-microservice:*` roles that gate
 * auth's own `/auth/internal/*` and `/internal/*` routes, idempotently.
 *
 * Why these exist: those routes were gated by `InternalServiceGuard` — a static
 * shared `INTERNAL_SERVICE_TOKEN` plus a self-asserted `x-service-name` header.
 * Both are prohibited by `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`. Replacing
 * that guard with a per-pair RS256 principal needs a role per route group first;
 * `provision-service-token.js` refuses to mint against a role that does not
 * exist ("Role not found ... Run seed first.").
 *
 * Why four roles and not one `admin`: the standard requires the smallest
 * authority that lets the call succeed, classified by effect rather than HTTP
 * verb. These routes do materially different things, and one role would let any
 * caller of the cheapest route do the most dangerous one:
 *
 *   - `email-check`     reads whether an email exists. A pure existence probe.
 *   - `user-existence`  reads whether a userId still resolves. Also an existence
 *                       probe, but keyed by id and used for offboarding
 *                       reconciliation, so it is separable from email lookup.
 *   - `preferences`     reads AND writes registered-user communication
 *                       preferences, including unsubscribe state. A write.
 *   - `magic-link`      mints a magic-link verify URL — that is, it can create a
 *                       usable user session. This is by far the most dangerous
 *                       route on the list and must never be reachable by a
 *                       credential provisioned for an email lookup.
 *
 * `auth-microservice` is typed INFRASTRUCTURE, so `seed-rbac.ts` creates no
 * internal roles for it (see `inferType`). This follows
 * `seed-auth-readonly-role.js`, which created `readonly` here for the same
 * reason: widening the generic seed's loop would create these four roles on
 * every infrastructure app as a side effect of wanting them on one.
 *
 * Runs inside the auth pod against the compiled dist/, like its siblings, so DB
 * credentials never leave the cluster.
 *
 * Dry run (default, no writes):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-internal-route-roles.js
 *
 * Apply:
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/seed-internal-route-roles.js --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL
 */

const CONTRACT = 'auth-internal-route-roles-seed.v1';
const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';

const APP_NAME = 'auth-microservice';
const ROLE_SCOPE = 'internal';
const ROLES = [
  {
    name: 'email-check',
    description: 'Check whether an email exists in Auth (GET /auth/internal/check-email)',
  },
  {
    name: 'user-existence',
    description: 'Confirm a userId still resolves to an Auth account (GET /internal/users/:userId/existence)',
  },
  {
    name: 'preferences',
    description: 'Read and update registered-user communication preferences and unsubscribe state',
  },
  {
    name: 'magic-link',
    description: 'Mint a magic-link verify URL for a user (POST /auth/internal/magic-link/token)',
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
    roles: [],
    mutatedDatabase: false,
    status: 'ok',
  };

  try {
    const applicationsService = app.get(ApplicationsService);
    const rolesService = app.get(RolesService);

    const application = await applicationsService.findByName(APP_NAME);
    result.applicationExisted = Boolean(application);

    // Unlike the docs-rag seed, this script never creates the application.
    // `auth-microservice` must already exist; if it does not, something is wrong
    // with the RBAC baseline and silently creating it here would hide that.
    if (!application) {
      throw new Error(`Application ${APP_NAME} not found. Seed base RBAC first.`);
    }

    for (const role of ROLES) {
      const roleString = `${ROLE_SCOPE}:${APP_NAME}:${role.name}`;

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
