#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(text, markers) {
  return markers.map((marker) => ({ marker, present: text.includes(marker) }));
}

function summarize(results) {
  return results.reduce((acc, entry) => {
    acc[entry.marker] = entry.present;
    return acc;
  }, {});
}

function main() {
  const databaseModule = read('shared/database/database.module.ts');
  const authModule = read('src/auth/auth.module.ts');
  const entity = read('src/auth/entities/email-change-token.entity.ts');
  const sql = read('scripts/create-email-change-table.sql');
  const hostedStatic = read('scripts/check-customer-data-wallet-hosted-profile-static.js');
  const runtimeSmoke = read('scripts/check-auth-email-change-runtime-smoke.js');
  const preflight = read('scripts/check-auth-email-change-preflight.js');
  const deploy = read('scripts/deploy.sh');
  const packageJson = JSON.parse(read('package.json'));

  const checks = {
    rootTypeOrmEntityRegistration: includesAll(databaseModule, [
      "import { EmailChangeToken } from '../../src/auth/entities/email-change-token.entity';",
      'EmailChangeToken',
      'synchronize: process.env.DB_SYNC === \'true\'',
    ]),
    featureRepositoryRegistration: includesAll(authModule, [
      "import { EmailChangeToken } from './entities/email-change-token.entity';",
      'TypeOrmModule.forFeature([PasswordResetToken, MagicLinkToken, EmailChangeToken, LegacyIdentityMapping])',
    ]),
    entityContract: includesAll(entity, [
      "@Entity('email_change_tokens')",
      "userId: string",
      "token: string",
      "oldEmail: string | null",
      "newEmail: string",
      "returnUrl: string | null",
      "expiresAt: Date",
      "used: boolean",
    ]),
    sqlContract: includesAll(sql, [
      'CREATE TABLE IF NOT EXISTS email_change_tokens',
      '"userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      'token VARCHAR(255) NOT NULL UNIQUE',
      '"newEmail" VARCHAR(255) NOT NULL',
      '"returnUrl" TEXT',
      '"expiresAt" TIMESTAMP NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_email_change_tokens_token',
      'CREATE INDEX IF NOT EXISTS idx_email_change_tokens_user_id',
      'CREATE INDEX IF NOT EXISTS idx_email_change_tokens_new_email_active',
    ]),
    hostedProfileStaticMarkers: includesAll(hostedStatic, [
      'id="email-change-form"',
      "fetchJson('/auth/email-change-request')",
      "return_url: window.location.origin + '/profile'",
    ]),
    preflightSafety: includesAll(preflight, [
      'pass_auth_email_change_preflight_source_gate',
      'doesNotReadEnvironment: true',
      'doesNotConnectToDatabase: true',
      'forbiddenMutatingLines: 0',
      'schema-only live DB preflight',
      'applyCommandTemplate',
      'scripts/create-email-change-table.sql',
    ]),
    runtimeSmokeSafety: includesAll(runtimeSmoke, [
      'approval_required_auth_email_change_runtime_smoke',
      'RUN_AUTH_EMAIL_CHANGE_SMOKE',
      'AUTH_EMAIL_CHANGE_SMOKE_CONFIRM',
      'VERIFIED_EMAIL_CHANGE',
      'AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE',
      'AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE',
      'printsBearerToken: false',
      'printsPassword: false',
      'printsEmailChangeToken: false',
      'printsEmailAddress: false',
      'readsDatabase: false',
    ]),
    deployBoundary: includesAll(deploy, [
      'npm run test:auth-contract',
      'docker build --no-cache',
      'deploy_timing_k8s_rollout_wait kubectl',
    ]),
    packageScripts: [
      {
        marker: 'package script check:auth-email-change-runtime',
        present: packageJson.scripts?.['check:auth-email-change-runtime'] === 'node scripts/check-auth-email-change-runtime-smoke.js',
      },
      {
        marker: 'package script check:auth-email-change-activation-source',
        present: packageJson.scripts?.['check:auth-email-change-activation-source'] === 'node scripts/check-auth-email-change-activation-source.js',
      },
      {
        marker: 'package script check:auth-email-change-preflight',
        present: packageJson.scripts?.['check:auth-email-change-preflight'] === 'node scripts/check-auth-email-change-preflight.js',
      },
    ],
    negativeDeployBoundary: [
      {
        marker: 'deploy script does not apply create-email-change-table.sql',
        present: !deploy.includes('create-email-change-table.sql'),
      },
      {
        marker: 'deploy script does not enable DB_SYNC=true',
        present: !deploy.includes('DB_SYNC=true'),
      },
    ],
  };

  const allChecks = Object.values(checks).flat();
  const missing = allChecks.filter((entry) => !entry.present).map((entry) => entry.marker);
  const ok = missing.length === 0;
  const report = {
    ok,
    status: ok ? 'pass_auth_email_change_activation_source_gate' : 'fail_auth_email_change_activation_source_gate',
    sourceOnly: true,
    mutatesDatabase: false,
    deploys: false,
    callsRuntime: false,
    readsEnvironment: false,
    printsSecrets: false,
    checks: Object.fromEntries(Object.entries(checks).map(([key, results]) => [key, summarize(results)])),
    missing,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

main();
