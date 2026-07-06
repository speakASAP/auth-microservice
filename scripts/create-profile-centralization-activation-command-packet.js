#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(text, marker, label) {
  if (!text.includes(marker)) {
    throw new Error(`${label} missing marker: ${marker}`);
  }
}

const packageJson = JSON.parse(read('package.json'));
const runtimeGate = read('docs/orchestrator/2026-07-06-auth-email-change-runtime-gate.md');
const preflight = read('scripts/check-auth-email-change-preflight.js');
const activationPacket = read('scripts/check-profile-centralization-activation-packet.js');
const readiness = read('scripts/check-profile-centralization-runtime-readiness.js');
const runtimeSmoke = read('scripts/check-auth-email-change-runtime-smoke.js');

const requiredScripts = [
  'check:auth-email-change-activation-source',
  'check:auth-email-change-preflight',
  'check:profile-centralization-activation-packet',
  'check:profile-centralization-runtime-readiness',
  'check:customer-data-wallet-hosted-profile-static',
  'check:auth-email-change-runtime',
];

for (const name of requiredScripts) {
  if (!packageJson.scripts?.[name]) {
    throw new Error(`package script missing: ${name}`);
  }
}

for (const marker of [
  'applyCommandTemplate',
  'postApplyVerificationSql',
  'metadataPreflightSql',
  'doesNotReadEnvironment: true',
  'doesNotConnectToDatabase: true',
]) {
  assertIncludes(preflight, marker, 'preflight');
}

for (const marker of [
  'pass_profile_centralization_activation_packet_source_gate',
  'Owner-approved DB/deploy window',
  'post-deploy hosted profile static smoke',
]) {
  assertIncludes(activationPacket + runtimeGate, marker, 'activation packet');
}

for (const marker of [
  'fail_profile_centralization_runtime_readiness',
  'activationReady',
  'sendsAuthorizationHeader: false',
  'readsDatabase: false',
]) {
  assertIncludes(readiness, marker, 'runtime readiness');
}

for (const marker of [
  'RUN_AUTH_EMAIL_CHANGE_SMOKE=1',
  'AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE',
  'AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID',
  'AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE',
  'AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE',
]) {
  assertIncludes(runtimeSmoke + runtimeGate, marker, 'runtime smoke');
}

const psqlBase = 'PGPASSWORD="$DB_PASSWORD" psql --host="$DB_HOST" --port="${DB_PORT:-5432}" --username="$DB_USER" --dbname="${DB_NAME:-auth}" --set=ON_ERROR_STOP=1';

const packet = {
  ok: true,
  status: 'pass_profile_centralization_activation_command_packet_source_gate',
  sourceOnly: true,
  mutatesDatabase: false,
  deploys: false,
  callsRuntime: false,
  readsEnvironment: false,
  printsSecrets: false,
  commandPacket: {
    purpose: 'Owner-approved Auth profile-centralization activation window',
    approvalRequired: true,
    prerequisites: [
      'owner-approved DB/deploy window id',
      'DB connection env available to operator without printing values',
      'clean Auth main deployed only after SQL apply succeeds',
      'synthetic Auth account bearer token in 0600 file',
      'synthetic new email in 0600 file',
      'current password file only for password accounts',
      'confirmation token file from approved operator/inbox path',
    ],
    forbiddenOutputs: [
      'DB password or connection string values',
      'bearer tokens',
      'passwords',
      'email-change tokens',
      'email addresses',
      'request bodies',
      'response bodies',
      'raw customer data',
    ],
    steps: [
      {
        order: 0,
        name: 'source gate preflight',
        mutates: false,
        command: 'npm run check:auth-email-change-activation-source && npm run check:auth-email-change-preflight && npm run check:profile-centralization-activation-packet',
      },
      {
        order: 1,
        name: 'current runtime readiness snapshot',
        mutates: false,
        command: 'npm run check:profile-centralization-runtime-readiness -- --base-url=https://auth.alfares.cz --no-write-report',
        expectedBeforeDeploy: 'may fail with fail_profile_centralization_runtime_readiness while deployed assets are stale',
      },
      {
        order: 2,
        name: 'schema metadata preflight',
        mutates: false,
        commandTemplate: `${psqlBase} --command="SELECT to_regclass('public.users'); SELECT to_regclass('public.email_change_tokens'); SELECT to_regproc('gen_random_uuid');"`,
      },
      {
        order: 3,
        name: 'apply email-change SQL',
        mutates: true,
        requiresApproval: true,
        commandTemplate: `${psqlBase} --single-transaction --file=scripts/create-email-change-table.sql`,
      },
      {
        order: 4,
        name: 'post-apply schema verification',
        mutates: false,
        commandTemplate: `${psqlBase} --command="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_change_tokens';"`,
      },
      {
        order: 5,
        name: 'deploy Auth current main',
        mutates: true,
        requiresApproval: true,
        command: './scripts/deploy.sh',
      },
      {
        order: 6,
        name: 'post-deploy readiness/static smoke',
        mutates: false,
        command: 'npm run check:profile-centralization-runtime-readiness -- --base-url=https://auth.alfares.cz --no-write-report && npm run check:customer-data-wallet-hosted-profile-static -- --base-url=https://auth.alfares.cz --no-write-report',
      },
      {
        order: 7,
        name: 'synthetic email-change request smoke',
        mutates: true,
        requiresApproval: true,
        commandTemplate: 'RUN_AUTH_EMAIL_CHANGE_SMOKE=1 AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID=<non-secret approval id> AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE=<0600 bearer file> AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL_FILE=<0600 synthetic new email file> AUTH_EMAIL_CHANGE_SMOKE_CURRENT_PASSWORD_FILE=<0600 current password file if needed> npm run check:auth-email-change-runtime -- --execute --mode=request',
      },
      {
        order: 8,
        name: 'synthetic email-change confirm smoke',
        mutates: true,
        requiresApproval: true,
        commandTemplate: 'RUN_AUTH_EMAIL_CHANGE_SMOKE=1 AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID=<same or linked non-secret approval id> AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE=<0600 email-change token file> npm run check:auth-email-change-runtime -- --execute --mode=confirm',
      },
    ],
    stopConditions: [
      'any preflight failure',
      'schema metadata preflight missing users or gen_random_uuid',
      'SQL apply failure',
      'deploy failure or rollout health failure',
      'post-deploy runtime readiness/static smoke failure',
      'missing approved synthetic token/email/password/confirmation-token files',
      'any command would print secret, token, password, email body, request body, response body, DB rows, or raw customer data',
    ],
  },
};

console.log(JSON.stringify(packet, null, 2));
