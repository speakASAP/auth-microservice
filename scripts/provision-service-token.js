#!/usr/bin/env node
/**
 * Sole service-token provisioner. Follow
 * auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md; do not invent
 * alternate mint scripts or algorithms.
 *
 * Runs inside the auth pod against compiled `dist/`. Credentials never leave
 * the cluster. Token is written only to --token-output (mode 0600), never printed.
 *
 * Dry run (no writes, no token):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/provision-service-token.js \
 *     --email=catalog-warehouse-service@alfares.cz \
 *     --service-name=catalog-microservice \
 *     --role=internal:warehouse-microservice:admin \
 *     --dry-run
 *
 * Apply (writes to the auth DB, emits a token to a file):
 *   ... --apply \
 *     --confirm-db-mutation=SERVICE_PRINCIPAL \
 *     --confirm-token-issuance=SERVICE_JWT \
 *     --token-output=/tmp/<service>.jwt
 */

const { writeFileSync, chmodSync } = require('fs');
const { isAbsolute } = require('path');

// dist/ is required lazily, inside main(), after argument validation. Importing
// app.module eagerly pulls in auth.module, which throws at load time when
// JWT_SIGN_ALGORITHM/JWT_PRIVATE_KEY are absent. That is correct behaviour for
// the service, but at the top of this file it would mean a plain `--help`-shaped
// mistake dies with an unrelated signing-config stack trace, and it makes the
// argument gates untestable outside a configured pod.

const DB_CONFIRMATION = 'SERVICE_PRINCIPAL';
const TOKEN_CONFIRMATION = 'SERVICE_JWT';
const CONTRACT = 'auth-service-token-provisioning.v2';

const args = process.argv.slice(2);
const argValue = (name) => {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};
const hasFlag = (name) => args.includes(name);

function parseInternalRole(role) {
  const match = role.trim().match(/^internal:([^:]+):(.+)$/);
  if (!match) {
    throw new Error(`Only internal:<service>:<role> role strings are supported, got "${role}"`);
  }
  return { scope: 'internal', appName: match[1], name: match[2] };
}

function fail(message) {
  console.error(JSON.stringify({ contract: CONTRACT, status: 'failed', error: message }, null, 2));
  process.exit(1);
}

async function main() {
  const email = argValue('--email').toLowerCase();
  const serviceName = argValue('--service-name');
  const roleString = argValue('--role');
  const expiresIn = argValue('--expires-in') || process.env.SERVICE_JWT_EXPIRES_IN || '30d';
  const checkDbOnly = hasFlag('--check-db-only');
  const dryRun = hasFlag('--dry-run');
  const apply = hasFlag('--apply');
  const createIfMissing = hasFlag('--create-if-missing');
  const outputPath = argValue('--token-output');

  if (!email) throw new Error('--email is required');
  if (!serviceName) throw new Error('--service-name is required');
  if (!roleString) throw new Error('--role is required');
  const modeCount = [checkDbOnly, dryRun, apply].filter(Boolean).length;
  if (modeCount !== 1) throw new Error('Use exactly one of --check-db-only, --dry-run, or --apply');
  if (apply && argValue('--confirm-db-mutation') !== DB_CONFIRMATION) {
    throw new Error(`--confirm-db-mutation=${DB_CONFIRMATION} is required for --apply`);
  }
  if (apply && argValue('--confirm-token-issuance') !== TOKEN_CONFIRMATION) {
    throw new Error(`--confirm-token-issuance=${TOKEN_CONFIRMATION} is required for --apply`);
  }
  if (apply && !outputPath) throw new Error('--token-output is required when --apply is used');
  if (apply && !isAbsolute(outputPath)) throw new Error('--token-output must be an absolute path');

  const parsedRole = parseInternalRole(roleString);

  // Deferred until every argument has been validated — see the note at the top.
  const { NestFactory } = require('@nestjs/core');
  const { JwtService } = require('@nestjs/jwt');
  const { AppModule } = require('../dist/src/app.module');
  const { UsersService } = require('../dist/src/users/users.service');
  const { RolesService } = require('../dist/src/roles/roles.service');
  const { ApplicationsService } = require('../dist/src/applications/applications.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const usersService = app.get(UsersService);
    const applicationsService = app.get(ApplicationsService);
    const rolesService = app.get(RolesService);
    const jwtService = app.get(JwtService);

    const application = await applicationsService.findByName(parsedRole.appName);
    if (!application) {
      throw new Error(`Application "${parsedRole.appName}" not found for role ${roleString}. Run seed first.`);
    }
    const role = await rolesService.findByName(parsedRole.name, parsedRole.scope, application.id);
    if (!role) {
      throw new Error(`Role not found for ${roleString}. Run seed first.`);
    }

    // The principal is looked up by email, so a typo here does not fail — with
    // --create-if-missing it silently mints a SECOND principal for the same
    // service, with its own id and the same admin role, and reports success.
    // Always confirm wouldCreateUser:false in --dry-run before --apply on a
    // service that already has a principal.
    let user = await usersService.findByEmail(email);
    const wouldCreateUser = !user && createIfMissing;

    // Read-only inspection: report what exists without asserting anything about
    // intent. Safe to run against production at any time.
    if (checkDbOnly) {
      const existingRoles = user ? await rolesService.getUserRoles(user.id) : [];
      console.log(JSON.stringify({
        contract: CONTRACT,
        mode: 'check-db-only',
        mutatesDatabase: false,
        emitsToken: false,
        serviceName,
        role: roleString,
        applicationFound: true,
        roleFound: true,
        principal: user
          ? { id: user.id, email: user.email, userType: user.userType, isActive: user.isActive }
          : null,
        principalExists: Boolean(user),
        hasRequiredRole: existingRoles.includes(roleString),
        currentRoles: existingRoles,
        signAlgorithm: process.env.JWT_SIGN_ALGORITHM || 'UNSET',
        status: 'ok',
      }, null, 2));
      return;
    }

    if (!user && !createIfMissing) {
      throw new Error(`Service principal ${email} does not exist. Re-run with --create-if-missing after owner approval.`);
    }
    if (user && user.userType !== 'service') {
      throw new Error(`Existing user ${email} has userType=${user.userType}; refusing to use a non-service principal.`);
    }

    if (dryRun) {
      console.log(JSON.stringify({
        contract: CONTRACT,
        mode: 'dry-run',
        mutatesDatabase: false,
        emitsToken: false,
        serviceName,
        role: roleString,
        principal: user
          ? { id: user.id, email: user.email, userType: user.userType, isActive: user.isActive }
          : null,
        wouldCreateUser,
        wouldAssignRole: Boolean(user || wouldCreateUser),
        signAlgorithm: process.env.JWT_SIGN_ALGORITHM || 'UNSET',
        expiresIn,
        status: 'ready-for-owner-approval',
      }, null, 2));
      return;
    }

    if (!user) {
      user = await usersService.create({
        email,
        name: serviceName,
        source: 'service-principal',
        userType: 'service',
        isActive: true,
        isVerified: true,
        perApplicationPreferences: {
          serviceIdentity: { serviceName, clientId: serviceName, authMethod: 'auth-service-jwt' },
        },
      });
    }

    try {
      await rolesService.assignRoleToUser(user.id, role.id, application.id);
    } catch (error) {
      if (!String((error && error.message) || '').includes('already assigned')) throw error;
    }

    const roles = await rolesService.getUserRoles(user.id);
    if (!roles.includes(roleString)) {
      throw new Error(`Role assignment did not produce required role ${roleString}`);
    }

    const token = jwtService.sign({
      sub: user.id,
      email: user.email,
      type: 'service',
      roles,
      serviceName,
      service: serviceName,
      clientId: serviceName,
      auth_method: 'auth-service-jwt',
    }, { expiresIn });

    // Assert the algorithm rather than trust the module config. Emitting an
    // HS256 token here would recreate exactly the outage this script repairs:
    // a credential that looks healthy, carries a far-future exp, and is refused
    // by every verifier in the ecosystem.
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    if (header.alg !== 'RS256') {
      throw new Error(
        `Refusing to emit a ${header.alg} token: auth verifies RS256 only (TASK-KEY-F3 step 4). ` +
        'Check JWT_SIGN_ALGORITHM and JWT_PRIVATE_KEY on this pod.',
      );
    }

    writeFileSync(outputPath, `${token}\n`, { mode: 0o600 });
    chmodSync(outputPath, 0o600);

    console.log(JSON.stringify({
      contract: CONTRACT,
      mode: 'apply',
      mutatesDatabase: true,
      emitsToken: true,
      tokenPrinted: false,
      tokenOutputPath: outputPath,
      tokenFileMode: '0600',
      algorithm: header.alg,
      keyId: header.kid || null,
      serviceName,
      role: roleString,
      principal: { id: user.id, email: user.email },
      createdUser: wouldCreateUser,
      expiresIn,
      status: 'ok',
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((error) => fail((error && error.message) || 'unknown error'));
