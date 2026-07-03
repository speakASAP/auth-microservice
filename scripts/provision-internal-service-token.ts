#!/usr/bin/env ts-node
/**
 * Generic approval-gated helper for Auth-issued internal service JWTs.
 *
 * Check-only example:
 *   npx ts-node scripts/provision-internal-service-token.ts \
 *     --email=orders-status-cleanup@internal.invalid \
 *     --service-name=orders-status-cleanup \
 *     --role=internal:orders-microservice:admin \
 *     --check-db-only --create-if-missing
 *
 * Dry-run example:
 *   npx ts-node scripts/provision-internal-service-token.ts \
 *     --email=orders-status-cleanup@internal.invalid \
 *     --service-name=orders-status-cleanup \
 *     --role=internal:orders-microservice:admin \
 *     --dry-run --create-if-missing
 *
 * Apply example:
 *   npx ts-node scripts/provision-internal-service-token.ts \
 *     --email=orders-status-cleanup@internal.invalid \
 *     --service-name=orders-status-cleanup \
 *     --role=internal:orders-microservice:admin \
 *     --create-if-missing --apply \
 *     --confirm-db-mutation=INTERNAL_SERVICE_PRINCIPAL \
 *     --confirm-token-issuance=INTERNAL_SERVICE_JWT \
 *     --token-output=/secure/operator/path/orders-status-cleanup.jwt
 *
 * The token value is never printed. It is written only to --token-output with
 * mode 0600 so operators can move it into Vault without exposing it in logs.
 */

import { config } from 'dotenv';
import { chmodSync, writeFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { JwtService } from '@nestjs/jwt';

config({ path: resolve(__dirname, '..', '.env') });

const DB_CONFIRMATION = 'INTERNAL_SERVICE_PRINCIPAL';
const TOKEN_CONFIRMATION = 'INTERNAL_SERVICE_JWT';
const CONTRACT = 'auth-internal-service-token-provisioning.v1';

type Mode = 'check-db-only' | 'dry-run' | 'apply';
type RoleScope = 'internal';
type ParsedRole = {
  name: string;
  scope: RoleScope;
  appName: string;
};
type DbApplication = {
  id: string;
  name: string;
};
type DbRole = {
  id: string;
  name: string;
  scope: string;
  applicationId: string | null;
};
type DbUser = {
  id: string;
  email: string;
  name: string | null;
  userType: string;
  isActive: boolean;
  isVerified: boolean;
  perApplicationPreferences: Record<string, unknown> | null;
};

function argValue(args: string[], name: string): string {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseInternalRole(role: string): ParsedRole {
  const match = role.trim().match(/^internal:([^:]+):(.+)$/);
  if (!match) {
    throw new Error('Only internal:<service>:<role> role strings are supported by this helper');
  }
  return { scope: 'internal', appName: match[1], name: match[2] };
}

function resolveMode(args: string[]): Mode {
  const modes: Mode[] = [];
  if (hasFlag(args, '--check-db-only')) modes.push('check-db-only');
  if (hasFlag(args, '--dry-run')) modes.push('dry-run');
  if (hasFlag(args, '--apply')) modes.push('apply');
  if (modes.length !== 1) {
    throw new Error('Use exactly one of --check-db-only, --dry-run, or --apply');
  }
  return modes[0];
}

function tokenOutputPath(rawPath: string): string {
  if (!rawPath) {
    throw new Error('--token-output is required when --apply is used');
  }
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function sanitizeUserForReport(user: DbUser | null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    isActive: user.isActive,
    isVerified: user.isVerified,
  };
}

function dbConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (connectionString) {
    return { connectionString, statement_timeout: 10_000, query_timeout: 10_000 };
  }
  return {
    host: process.env.DB_HOST || 'db-server-postgres',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'dbadmin',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'auth',
    statement_timeout: 10_000,
    query_timeout: 10_000,
  };
}

async function getApplication(client: Client, name: string): Promise<DbApplication | null> {
  const result = await client.query('SELECT id, name FROM applications WHERE name = $1 LIMIT 1', [name]);
  return result.rows[0] || null;
}

async function getRole(client: Client, name: string, scope: RoleScope, applicationId: string): Promise<DbRole | null> {
  const result = await client.query(
    'SELECT id, name, scope, "applicationId" FROM roles WHERE name = $1 AND scope = $2 AND "applicationId" = $3 LIMIT 1',
    [name, scope, applicationId],
  );
  return result.rows[0] || null;
}

async function getUser(client: Client, email: string): Promise<DbUser | null> {
  const result = await client.query(
    'SELECT id, email, name, "userType", "isActive", "isVerified", "perApplicationPreferences" FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  return result.rows[0] || null;
}

async function hasRoleAssignment(client: Client, userId: string, roleId: string, applicationId: string): Promise<boolean> {
  const result = await client.query(
    'SELECT 1 FROM user_roles WHERE "userId" = $1 AND "roleId" = $2 AND "applicationId" = $3 LIMIT 1',
    [userId, roleId, applicationId],
  );
  return Boolean(result.rows[0]);
}

async function createServiceUser(client: Client, email: string, serviceName: string): Promise<DbUser> {
  const id = randomUUID();
  const prefs = {
    serviceIdentity: {
      serviceName,
      clientId: serviceName,
      authMethod: 'auth-service-jwt',
    },
  };
  const result = await client.query(
    `INSERT INTO users (
      id, email, name, source, "userType", "isActive", "isVerified",
      "perApplicationPreferences", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, 'service', true, true, $5::jsonb, NOW(), NOW())
    RETURNING id, email, name, "userType", "isActive", "isVerified", "perApplicationPreferences"`,
    [id, email, serviceName, 'service-principal', JSON.stringify(prefs)],
  );
  return result.rows[0];
}

async function normalizeServiceUser(client: Client, user: DbUser, serviceName: string): Promise<DbUser> {
  const prefs = {
    ...(user.perApplicationPreferences || {}),
    serviceIdentity: {
      serviceName,
      clientId: serviceName,
      authMethod: 'auth-service-jwt',
    },
  };
  const result = await client.query(
    `UPDATE users
     SET name = COALESCE(NULLIF(name, ''), $2),
         "userType" = 'service',
         "isActive" = true,
         "isVerified" = true,
         "perApplicationPreferences" = $3::jsonb,
         "updatedAt" = NOW()
     WHERE id = $1
     RETURNING id, email, name, "userType", "isActive", "isVerified", "perApplicationPreferences"`,
    [user.id, serviceName, JSON.stringify(prefs)],
  );
  return result.rows[0];
}

async function assignRole(client: Client, userId: string, roleId: string, applicationId: string): Promise<boolean> {
  if (await hasRoleAssignment(client, userId, roleId, applicationId)) return false;
  await client.query(
    `INSERT INTO user_roles (id, "userId", "roleId", "applicationId", "grantedAt")
     VALUES ($1, $2, $3, $4, NOW())`,
    [randomUUID(), userId, roleId, applicationId],
  );
  return true;
}

async function getUserRoles(client: Client, userId: string): Promise<string[]> {
  const result = await client.query(
    `SELECT role.name, role.scope, app.name AS "appName"
     FROM user_roles ur
     JOIN roles role ON role.id = ur."roleId"
     LEFT JOIN applications app ON app.id = ur."applicationId"
     WHERE ur."userId" = $1 AND (ur."expiresAt" IS NULL OR ur."expiresAt" > NOW())`,
    [userId],
  );
  return result.rows.flatMap((row) => {
    if (row.scope === 'global') return [`global:${row.name}`];
    if (row.scope === 'application' && row.appName) return [`app:${row.appName}:${row.name}`];
    if (row.scope === 'internal' && row.appName) return [`internal:${row.appName}:${row.name}`];
    return [];
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mode = resolveMode(args);
  const email = argValue(args, '--email').toLowerCase();
  const serviceName = argValue(args, '--service-name');
  const roleString = argValue(args, '--role');
  const expiresIn = argValue(args, '--expires-in') || process.env.SERVICE_JWT_EXPIRES_IN || '30d';
  const createIfMissing = hasFlag(args, '--create-if-missing');
  const confirmDbMutation = argValue(args, '--confirm-db-mutation');
  const confirmTokenIssuance = argValue(args, '--confirm-token-issuance');
  const outputPath = argValue(args, '--token-output');

  if (!email) throw new Error('--email is required');
  if (!serviceName) throw new Error('--service-name is required');
  if (!roleString) throw new Error('--role=internal:<service>:<role> is required');
  if (mode === 'apply' && confirmDbMutation !== DB_CONFIRMATION) {
    throw new Error(`--confirm-db-mutation=${DB_CONFIRMATION} is required for --apply`);
  }
  if (mode === 'apply' && confirmTokenIssuance !== TOKEN_CONFIRMATION) {
    throw new Error(`--confirm-token-issuance=${TOKEN_CONFIRMATION} is required for --apply`);
  }
  if (mode === 'apply' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for --apply');
  }

  const parsedRole = parseInternalRole(roleString);
  const client = new Client(dbConfig());
  await client.connect();

  try {
    const application = await getApplication(client, parsedRole.appName);
    if (!application) throw new Error(`Application not found for role ${roleString}. Run seed first.`);
    const role = await getRole(client, parsedRole.name, parsedRole.scope, application.id);
    if (!role) throw new Error(`Role not found for ${roleString}. Run seed first.`);

    let user = await getUser(client, email);
    const wouldCreateUser = !user && createIfMissing;
    const wouldAssignRole = Boolean(user || wouldCreateUser);

    if (!user && !createIfMissing) {
      throw new Error('Service principal user does not exist. Re-run with --create-if-missing after owner approval.');
    }
    if (user && user.userType !== 'service') {
      throw new Error(`Existing user ${email} has userType=${user.userType}; refusing to use a non-service principal.`);
    }

    if (mode !== 'apply') {
      console.log(JSON.stringify({
        contract: CONTRACT,
        mode,
        mutatesDatabase: false,
        emitsToken: false,
        serviceName,
        role: roleString,
        applicationFound: true,
        roleFound: true,
        principal: sanitizeUserForReport(user),
        wouldCreateUser,
        wouldAssignRole,
        tokenOutputRequiredForApply: true,
        confirmationRequiredForApply: {
          confirmDbMutation: DB_CONFIRMATION,
          confirmTokenIssuance: TOKEN_CONFIRMATION,
        },
        status: 'ready-for-owner-approval',
      }, null, 2));
      return;
    }

    await client.query('BEGIN');
    try {
      user = user ? await normalizeServiceUser(client, user, serviceName) : await createServiceUser(client, email, serviceName);
      const roleAssigned = await assignRole(client, user.id, role.id, application.id);
      const roles = await getUserRoles(client, user.id);
      if (!roles.includes(roleString)) {
        throw new Error(`Role assignment did not produce required role ${roleString}`);
      }

      const jwtService = new JwtService({ secret: process.env.JWT_SECRET });
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

      const resolvedOutputPath = tokenOutputPath(outputPath);
      writeFileSync(resolvedOutputPath, `${token}\n`, { mode: 0o600 });
      chmodSync(resolvedOutputPath, 0o600);
      await client.query('COMMIT');

      console.log(JSON.stringify({
        contract: CONTRACT,
        mode,
        mutatesDatabase: true,
        emitsToken: true,
        tokenPrinted: false,
        tokenOutputPath: resolvedOutputPath,
        tokenFileMode: '0600',
        serviceName,
        role: roleString,
        principal: sanitizeUserForReport(user),
        roleAssigned,
        status: 'ok',
      }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(JSON.stringify({
    contract: CONTRACT,
    status: 'failed',
    error: error?.message || 'unknown error',
  }, null, 2));
  process.exit(1);
});
