#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function checkAll(text, markers) {
  return markers.map((marker) => ({ marker, present: text.includes(marker) }));
}

function summarize(results) {
  return results.reduce((acc, entry) => {
    acc[entry.marker] = entry.present;
    return acc;
  }, {});
}

const packageJson = JSON.parse(read('package.json'));
const runtimeGate = read('docs/orchestrator/2026-07-06-auth-email-change-runtime-gate.md');
const status = read('docs/orchestrator/STATUS.md');
const state = read('docs/IMPLEMENTATION_STATE.md');
const preflight = read('scripts/check-auth-email-change-preflight.js');
const activation = read('scripts/check-auth-email-change-activation-source.js');
const runtime = read('scripts/check-auth-email-change-runtime-smoke.js');
const staticSmoke = read('scripts/check-customer-data-wallet-hosted-profile-static.js');
const deploy = read('scripts/deploy.sh');

const checks = {
  packageScripts: [
    {
      marker: 'package script check:auth-email-change-preflight',
      present: packageJson.scripts?.['check:auth-email-change-preflight'] === 'node scripts/check-auth-email-change-preflight.js',
    },
    {
      marker: 'package script check:auth-email-change-activation-source',
      present: packageJson.scripts?.['check:auth-email-change-activation-source'] === 'node scripts/check-auth-email-change-activation-source.js',
    },
    {
      marker: 'package script check:auth-email-change-runtime',
      present: packageJson.scripts?.['check:auth-email-change-runtime'] === 'node scripts/check-auth-email-change-runtime-smoke.js',
    },
    {
      marker: 'package script check:customer-data-wallet-hosted-profile-static',
      present: packageJson.scripts?.['check:customer-data-wallet-hosted-profile-static'] === 'node scripts/check-customer-data-wallet-hosted-profile-static.js',
    },
  ],
  gateOrder: checkAll(runtimeGate, [
    'npm run check:auth-email-change-activation-source',
    'npm run check:auth-email-change-preflight',
    'Apply `scripts/create-email-change-table.sql` in the approved Auth DB change window.',
    'Deploy Auth from a clean `main` head containing the email-change source commit.',
    'npm run check:customer-data-wallet-hosted-profile-static -- --no-write-report',
    'npm run check:auth-email-change-runtime -- --execute --mode=request',
    'npm run check:auth-email-change-runtime -- --execute --mode=confirm',
  ]),
  approvalAndInputGates: checkAll(runtimeGate + runtime, [
    'RUN_AUTH_EMAIL_CHANGE_SMOKE=1',
    'AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE',
    'AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID=<non-secret approval id>',
    'AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE=<0600 bearer file>',
    'AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL_FILE=<0600 synthetic new email file>',
    'AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE=<0600 email-change token file>',
    'approval_required_auth_email_change_runtime_smoke',
  ]),
  outputAndSecretBoundaries: checkAll(runtimeGate + runtime + preflight, [
    'Forbidden output:',
    'bearer tokens',
    'passwords',
    'email-change tokens',
    'email addresses',
    'request bodies',
    'response bodies',
    'DB rows',
    'printsSecrets: false',
    'doesNotReadEnvironment: true',
    'doesNotConnectToDatabase: true',
  ]),
  sqlDeployBoundaries: [
    {
      marker: 'deploy script does not apply create-email-change-table.sql',
      present: !deploy.includes('create-email-change-table.sql'),
    },
    {
      marker: 'deploy script does not enable DB_SYNC=true',
      present: !deploy.includes('DB_SYNC=true'),
    },
    ...checkAll(preflight + activation + runtimeGate, [
      'pass_auth_email_change_preflight_source_gate',
      'forbiddenMutatingLines: 0',
      'schema-only live DB preflight',
      'postApplyVerificationSql',
      'applyCommandTemplate',
      'scripts/create-email-change-table.sql',
    ]),
  ],
  stopConditions: checkAll(runtimeGate, [
    'Any DB migration failure.',
    'Auth deploy failure or rollout health failure.',
    'Hosted `/profile` static smoke fails after deploy.',
    'Email-change request returns a non-2xx status for the approved synthetic account.',
    'Confirmation token cannot be obtained through the approved operator/inbox path without printing email/token contents.',
    'Confirmation returns a non-2xx status.',
  ]),
  currentBlockedState: checkAll(status + state + runtimeGate, [
    'Owner-approved DB/deploy window',
    'SQL apply: not run',
    'Deploy: not run',
    'Live request/confirm smoke: not run',
    'post-deploy hosted profile static smoke',
  ]),
  staticSmokeSafety: checkAll(staticSmoke, [
    'liveStaticGetOnly: true',
    'sendsAuthorizationHeader: false',
    'sendsCookies: false',
    'sendsRequestBody: false',
    'printsResponseBody: false',
    'readsDatabase: false',
  ]),
};

const allChecks = Object.values(checks).flat();
const missing = allChecks.filter((entry) => !entry.present).map((entry) => entry.marker);
const ok = missing.length === 0;
const report = {
  ok,
  status: ok ? 'pass_profile_centralization_activation_packet_source_gate' : 'fail_profile_centralization_activation_packet_source_gate',
  sourceOnly: true,
  mutatesDatabase: false,
  deploys: false,
  callsRuntime: false,
  readsEnvironment: false,
  printsSecrets: false,
  goalComplete: false,
  reasonGoalNotComplete: 'Activation packet is prepared, but SQL apply, Auth deploy, static smoke, and bounded email-change request/confirm smoke remain owner-approved runtime gates.',
  checks: Object.fromEntries(Object.entries(checks).map(([key, results]) => [key, summarize(results)])),
  missing,
};

console.log(JSON.stringify(report, null, 2));
if (!ok) {
  process.exitCode = 1;
}
