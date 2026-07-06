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
  const packageJson = JSON.parse(read('package.json'));
  const audit = read('docs/orchestrator/2026-07-06-profile-centralization-audit.md');
  const emailRuntimeGate = read('docs/orchestrator/2026-07-06-auth-email-change-runtime-gate.md');
  const status = read('docs/orchestrator/STATUS.md');
  const state = read('docs/IMPLEMENTATION_STATE.md');
  const contract = read('docs/UNIFIED_AUTH_CONTRACT.md');
  const authService = read('src/auth/auth.service.ts');
  const authController = read('src/auth/auth.controller.ts');
  const authModule = read('src/auth/auth.module.ts');
  const databaseModule = read('shared/database/database.module.ts');
  const profileHtml = read('web/public/profile.html');
  const profileJs = read('web/public/js/profile.js');
  const hostedStatic = read('scripts/check-customer-data-wallet-hosted-profile-static.js');
  const emailActivation = read('scripts/check-auth-email-change-activation-source.js');
  const emailPreflight = read('scripts/check-auth-email-change-preflight.js');
  const emailRuntime = read('scripts/check-auth-email-change-runtime-smoke.js');
  const completionAudit = read('docs/orchestrator/2026-07-06-profile-centralization-completion-audit.md');
  const activationPacket = read('scripts/check-profile-centralization-activation-packet.js');
  const runtimeReadiness = read('scripts/check-profile-centralization-runtime-readiness.js');

  const checks = {
    authProfileSourceOfTruth: includesAll(authService + authController + contract, [
      'async getProfile',
      'async updateProfile',
      'avatarUrl',
      'profileImageUrl',
      'profileSettings',
      'delivery-addresses',
      'invoice-profiles',
      'checkout-data',
      'changePassword',
      'setInitialPassword',
    ]),
    verifiedEmailChangeSource: includesAll(authService + authController + authModule + databaseModule + contract + audit, [
      'EmailChangeToken',
      'requestEmailChange',
      'confirmEmailChange',
      "Post('email-change-request')",
      "Post('email-change-confirm')",
      "Get('email-change-confirm')",
      'PATCH /auth/profile` still does not mutate email',
      'Email changed successfully',
    ]),
    hostedProfileUi: includesAll(profileHtml + profileJs + hostedStatic, [
      'id="canonical-profile-form"',
      'name="avatarUrl"',
      'name="settings"',
      'id="email-change-form"',
      "fetchJson('/auth/profile')",
      "fetchJson('/auth/profile/checkout-data')",
      "fetchJson('/auth/email-change-request')",
      "return_url: window.location.origin + '/profile'",
    ]),
    sourceActivationGates: includesAll(emailActivation + emailPreflight + activationPacket + runtimeReadiness + emailRuntimeGate + emailRuntime + packageJsonToText(packageJson), [
      'pass_auth_email_change_activation_source_gate',
      'approval_required_auth_email_change_runtime_smoke',
      'RUN_AUTH_EMAIL_CHANGE_SMOKE',
      'VERIFIED_EMAIL_CHANGE',
      'AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE',
      'AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE',
      'check:auth-email-change-activation-source',
      'check:auth-email-change-runtime',
      'schema-only live DB preflight',
      'pass_auth_email_change_preflight_source_gate',
      'check:auth-email-change-preflight',
      'Activation packet is prepared',
      'pass_profile_centralization_activation_packet_source_gate',
      'check:profile-centralization-activation-packet',
      'activationReady',
      'fail_profile_centralization_runtime_readiness',
      'check:profile-centralization-runtime-readiness',
      'scripts/create-email-change-table.sql',
      'SQL apply: not run',
      'Deploy: not run',
      'Live request/confirm smoke: not run',
    ]),
    consumerAuditAndParallelWorkers: includesAll(audit + status, [
      'Consumer Audit Matrix',
      'Spawned Follow-Up Workers',
      '`marathon`',
      '`payments-microservice`',
      '`aukro`',
      '`cliplot`',
      'Source-changed profile flow',
      'Added safe `GET /auth/profile` wrapper',
      'Added Auth-hosted `profile`, `wallet`, and `settings` links',
      'Kept Cliplot read-only',
      'No worker deployed',
    ]),
    consumerRefreshEvidence: includesAll(completionAudit + status + state, [
      'Consumer Profile-Centralization Refresh',
      'Consumer Refresh Update',
      'Marathon `main` is clean at `bec1564`',
      'hosted Auth contract checker passed 17/17',
      'Payments `main` now includes `55a1785 test: harden hosted auth contract checker`',
      'node scripts/check-hosted-auth-contract.js` passed',
      'Aukro `main` is clean at `c521762`',
      'Cliplot `main` is clean at `7bfb686`',
      'Owner-approved admin test session packet for authenticated UI proof',
      'Owner-approved mutation contract before any write-surface implementation',
    ]),
    remainingRuntimeGatesExplicit: includesAll(audit + emailRuntimeGate + status + state, [
      'approved runtime activation',
      'production DB apply/deploy remains gated',
      'Owner-approved Auth DB migration window',
      'Auth deploy from clean `main`',
      'GET-only hosted `/profile` static smoke',
      'Request smoke with synthetic account/new email',
      'No SQL apply, deploy, live static smoke, live email-change request/confirm',
    ]),
    packageScripts: [
      {
        marker: 'package script check:auth-email-change-activation-source',
        present: packageJson.scripts?.['check:auth-email-change-activation-source'] === 'node scripts/check-auth-email-change-activation-source.js',
      },
      {
        marker: 'package script check:auth-email-change-runtime',
        present: packageJson.scripts?.['check:auth-email-change-runtime'] === 'node scripts/check-auth-email-change-runtime-smoke.js',
      },
      {
        marker: 'package script check:auth-email-change-preflight',
        present: packageJson.scripts?.['check:auth-email-change-preflight'] === 'node scripts/check-auth-email-change-preflight.js',
      },
      {
        marker: 'package script check:profile-centralization-current-state',
        present: packageJson.scripts?.['check:profile-centralization-current-state'] === 'node scripts/check-profile-centralization-current-state.js',
      },
      {
        marker: 'package script check:profile-centralization-activation-packet',
        present: packageJson.scripts?.['check:profile-centralization-activation-packet'] === 'node scripts/check-profile-centralization-activation-packet.js',
      },
      {
        marker: 'package script check:profile-centralization-runtime-readiness',
        present: packageJson.scripts?.['check:profile-centralization-runtime-readiness'] === 'node scripts/check-profile-centralization-runtime-readiness.js',
      },
    ],
  };

  const allChecks = Object.values(checks).flat();
  const missing = allChecks.filter((entry) => !entry.present).map((entry) => entry.marker);
  const ok = missing.length === 0;
  const report = {
    ok,
    status: ok ? 'pass_profile_centralization_current_state_source_audit' : 'fail_profile_centralization_current_state_source_audit',
    sourceOnly: true,
    goalComplete: false,
    reasonGoalNotComplete: 'Runtime activation remains gated on approved DB SQL apply, Auth deploy, hosted static smoke, and bounded synthetic email-change request/confirm smoke.',
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

function packageJsonToText(packageJson) {
  return JSON.stringify(packageJson, null, 2);
}

main();
