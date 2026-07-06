#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function checkMarkers(name, text, markers) {
  return markers.map((marker) => ({
    scope: name,
    marker,
    present: text.includes(marker),
  }));
}

function main() {
  const packageJson = JSON.parse(read('package.json'));
  const packet = read('docs/orchestrator/2026-07-06-profile-centralization-owner-approved-execution-packet.md');
  const status = read('docs/orchestrator/STATUS.md');
  const state = read('docs/IMPLEMENTATION_STATE.md');
  const audit = read('docs/orchestrator/2026-07-06-profile-centralization-completion-audit.md');

  const checks = [
    ...checkMarkers('packet', packet, [
      'Status: source-only packet prepared; execution remains blocked until all listed owner inputs are present.',
      'Gate A - Marathon Reconciliation Apply And Migrated-User Smoke',
      '4977534 (HEAD -> main, origin/main) fix: optimize marathon reconciliation apply phase',
      'MARATHON_AUTH_RECONCILIATION_APPLY=OWNER_APPROVED_MARATHON_AUTH_RECONCILIATION_2026_07_06',
      '--apply --phase=auth --limit=<positive-integer>',
      '--apply --phase=marathon --limit=<positive-integer>',
      'Known migrated completed user/test account token for post-apply smoke',
      '[MISSING: resolution policy for one numeric legacy id without Auth mapping]',
      '[MISSING: resolution policy for 348 UUID-like Marathon user ids missing in Auth]',
      'Gate B - Cliplot Synthetic Browser-Session Wallet/Profile Read',
      'ENABLE_AUTH_WALLET_BROWSER_SESSION_SMOKE=true',
      'CLIPLOT_AUTH_WALLET_SMOKE_APPROVAL_ID=CLIPLOT-AUTH-WALLET-SMOKE-<ID>',
      'AUTH_WALLET_SYNTHETIC_BEARER=<approved-synthetic-bearer>',
      '/auth/profile/checkout-data',
      '/auth/profile/delivery-addresses',
      '/auth/profile/invoice-profiles',
      '[MISSING: current synthetic browser-session packet source that can be used without printing or persisting the bearer/session]',
      'Parallel Execution Matrix',
      'Stop Conditions',
      'Do not print raw user IDs, emails, phones, names, JWTs, cookies, DSNs, `.env` values, DB rows, raw Auth responses, or raw customer data.',
      'Do not print Authorization headers, bearer/JWT/refresh tokens, cookies, decoded token claims, raw wallet response bodies, customer PII, service credentials, emails, customer data, or raw response bodies.',
    ]),
    ...checkMarkers('status/state/audit', status + state + audit, [
      'Profile Centralization Owner-Approved Execution Packet',
      'Marathon current observed head is 4977534',
      'Cliplot current observed head is 7bfb686',
      'Execution remains blocked until all listed owner inputs are present',
    ]),
    {
      scope: 'package',
      marker: 'package script check:profile-centralization-owner-approved-execution-packet',
      present: packageJson.scripts?.['check:profile-centralization-owner-approved-execution-packet'] === 'node scripts/check-profile-centralization-owner-approved-execution-packet.js',
    },
  ];

  const missing = checks.filter((entry) => !entry.present);
  const report = {
    ok: missing.length === 0,
    status: missing.length === 0
      ? 'pass_profile_centralization_owner_approved_execution_packet_source_gate'
      : 'fail_profile_centralization_owner_approved_execution_packet_source_gate',
    sourceOnly: true,
    mutatesDatabase: false,
    deploys: false,
    callsRuntime: false,
    readsEnvironment: false,
    printsSecrets: false,
    executesApprovalGatedPacket: false,
    missing: missing.map((entry) => `${entry.scope}: ${entry.marker}`),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
