#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CONTRACT = 'auth-goal24-actor-token-provisioning.v1';
const TOKEN_CONFIRMATION = 'GOAL24_ACTOR_JWT';
const DEFAULT_REQUIRED_ROLES = ['app:flipflop-service:admin', 'global:superadmin'];

function argValue(args, name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function hasFlag(args, name) {
  return args.includes(name);
}

function dbConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (connectionString) return { connectionString, statement_timeout: 10000, query_timeout: 10000 };
  return {
    host: process.env.DB_HOST || 'db-server-postgres',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'dbadmin',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'auth',
    statement_timeout: 10000,
    query_timeout: 10000,
  };
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload, secret, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedBody}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function parseExpiresIn(raw) {
  const value = raw || '2h';
  const match = String(value).match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('--expires-in must use s, m, h, or d suffix, for example 2h');
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return amount * multiplier;
}

function tokenOutputPath(rawPath) {
  if (!rawPath) throw new Error('--token-output is required when --apply is used');
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function actorHash(userId) {
  return crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 16);
}

function actorHashByField(row, field) {
  if (field === 'id') return actorHash(row.id);
  if (field === 'emailLower') return actorHash(String(row.email || '').toLowerCase());
  throw new Error('--actor-hash-field must be id or emailLower');
}

async function getCandidateActors(client, selectedHash, hashField) {
  const result = await client.query(
    `SELECT id, email, "userType", "isActive", "isVerified"
     FROM users
     WHERE "isActive" = true AND "isVerified" = true`,
  );
  return result.rows.filter((row) => actorHashByField(row, hashField) === selectedHash);
}

async function getUserRoles(client, userId) {
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
  const checkOnly = hasFlag(args, '--check-only');
  const apply = hasFlag(args, '--apply');
  if (checkOnly === apply) throw new Error('Use exactly one of --check-only or --apply');
  const selectedHash = argValue(args, '--actor-hash');
  if (!/^[0-9a-f]{16}$/.test(selectedHash)) throw new Error('--actor-hash must be a 16-character lowercase hex hash');
  const hashField = argValue(args, '--actor-hash-field') || 'id';
  if (!['id', 'emailLower'].includes(hashField)) throw new Error('--actor-hash-field must be id or emailLower');
  const requiredRoles = argValue(args, '--required-role') ? [argValue(args, '--required-role')] : DEFAULT_REQUIRED_ROLES;
  const runnerId = argValue(args, '--runner-id') || 'codex-goal24-integration-thread';
  const approvalId = argValue(args, '--approval-id') || 'GOAL24-PAID-PROVIDER-SMOKE-20260704-CODEX-OWNER-APPROVED-003';
  const expiresInSeconds = parseExpiresIn(argValue(args, '--expires-in'));
  const confirmTokenIssuance = argValue(args, '--confirm-token-issuance');
  const outputPath = argValue(args, '--token-output');
  if (apply && confirmTokenIssuance !== TOKEN_CONFIRMATION) throw new Error(`--confirm-token-issuance=${TOKEN_CONFIRMATION} is required for --apply`);
  if (apply && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required for --apply');
  const client = new Client(dbConfig());
  await client.connect();
  try {
    const candidates = await getCandidateActors(client, selectedHash, hashField);
    if (candidates.length !== 1) throw new Error(`Expected exactly one active verified actor for hash; found ${candidates.length}`);
    const user = candidates[0];
    const roles = await getUserRoles(client, user.id);
    const requiredAdminRolePresent = requiredRoles.some((role) => roles.includes(role));
    if (!requiredAdminRolePresent) throw new Error('Selected actor does not carry an accepted Goal 24 admin role');
    const common = {
      contract: CONTRACT,
      mode: checkOnly ? 'check-only' : 'apply',
      selectedActorHash: selectedHash,
      actorHashMatches: true,
      actorHashField: hashField,
      selectedActorUserType: user.userType,
      selectedActorActive: Boolean(user.isActive),
      selectedActorVerified: Boolean(user.isVerified),
      requiredAdminRolePresent,
      acceptedRequiredRoles: requiredRoles,
      runnerId,
      approvalId,
      tokenOutput: false,
      decodedJwtOutput: false,
      rawUserOutput: false,
      rawEmailOutput: false,
      secretOutput: false,
      mutatesDatabase: false,
      roleMutation: false,
      userMutation: false,
      status: checkOnly ? 'ready-for-apply' : 'ok',
    };
    if (checkOnly) {
      console.log(JSON.stringify({ ...common, emitsToken: false, tokenOutputRequiredForApply: true, confirmationRequiredForApply: TOKEN_CONFIRMATION }, null, 2));
      return;
    }
    const token = signJwt({
      sub: user.id,
      type: user.userType || 'service',
      roles,
      auth_method: 'goal24-approved-actor-token',
      goal: 'GOAL-24',
      approvalId,
      runnerId,
    }, process.env.JWT_SECRET, expiresInSeconds);
    const resolvedOutputPath = tokenOutputPath(outputPath);
    fs.writeFileSync(resolvedOutputPath, `${token}\n`, { mode: 0o600 });
    fs.chmodSync(resolvedOutputPath, 0o600);
    console.log(JSON.stringify({ ...common, emitsToken: true, tokenPrinted: false, tokenOutputPath: resolvedOutputPath, tokenFileMode: '0600', expiresInSeconds }, null, 2));
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ contract: CONTRACT, status: 'failed', error: error && error.message ? error.message : 'unknown error' }, null, 2));
  process.exit(1);
});
