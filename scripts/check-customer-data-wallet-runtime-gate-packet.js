#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const packetPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-runtime-gate-execution-packet.md');
const goalPath = path.join(root, 'implementation-goals/GOAL-10-auth-customer-data-wallet.md');
const statusPath = path.join(root, 'docs/orchestrator/STATUS.md');
const statePath = path.join(root, 'docs/IMPLEMENTATION_STATE.md');
const packagePath = path.join(root, 'package.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(text, markers) {
  return markers.map((marker) => ({
    marker,
    present: text.includes(marker),
  }));
}

function missing(results) {
  return results.filter((entry) => !entry.present).map((entry) => entry.marker);
}

function main() {
  const packet = readText(packetPath);
  const goal = readText(goalPath);
  const status = readText(statusPath);
  const state = readText(statePath);
  const packageJson = JSON.parse(readText(packagePath));

  const gateMarkers = [
    '## Gate 1 - Auth Authenticated Wallet Smoke',
    '## Gate 2 - FlipFlop Guarded Gateway Wallet Smoke',
    '## Gate 3 - FlipFlop Authenticated Browser/Session Selector Smoke',
    '## Gate 4 - ChytraKoupe Guarded Selector Smoke',
    '## Gate 5 - Cliplot Browser/Session Wallet-Read Evidence',
    '## Gate 6 - Rent-a-box Metadata-Only Production Preflight',
  ];

  const requiredInputMarkers = [
    '[MISSING: owner-approved synthetic Auth account/token for ChytraKoupe wallet selector smoke]',
    '[MISSING: owner-approved synthetic checkout test data for ChytraKoupe wallet selector smoke]',
    '[MISSING: non-secret owner approval id for ChytraKoupe wallet selector smoke]',
    '[MISSING: approved synthetic Auth browser/session wallet-read evidence]',
    '[MISSING: owner-approved metadata-only production row-count/migration-complexity preflight]',
    '[MISSING: owner-approved live DB migration/backfill scope for local users and customer_profiles]',
  ];

  const resolvedGateMarkers = [
    'gate1-auth-wallet-smoke-20260703-vault-test-login',
    'pass_authenticated_wallet_crud_default_delete_smoke',
    'gate2-flipflop-auth-wallet-smoke-20260703-vault-test-login',
    'pass_flipflop_auth_wallet_gateway_smoke',
    'gate3-flipflop-auth-wallet-browser-smoke-20260703-vault-test-login',
    'pass_flipflop_auth_wallet_browser_session_smoke',
  ];

  const commandMarkers = [
    'npm run check:customer-data-wallet-authenticated -- --execute',
    'npm run smoke:auth-wallet-checkout-profile -- --execute',
    'npm run verify:auth-wallet-checkout-selectors',
    'npm run readiness:auth-wallet-checkout',
  ];

  const safetyMarkers = [
    '## Shared Output Contract',
    '## Stop Conditions',
    'Forbidden output across all gates:',
    'Stop immediately and do not retry automatically if:',
    'Auth single-source-of-truth boundary',
  ];

  const coordinatorMarkers = [
    '10.63 Consolidated runtime gate execution packet prepared',
    'docs/orchestrator/2026-07-03-goal10-runtime-gate-execution-packet.md',
  ];

  const packageScript = packageJson.scripts?.['check:customer-data-wallet-runtime-gate-packet'] || null;
  const checks = {
    packetFilePresent: fs.existsSync(packetPath),
    gateMarkers: includesAll(packet, gateMarkers),
    requiredInputMarkers: includesAll(packet, requiredInputMarkers),
    resolvedGateMarkers: includesAll(packet, resolvedGateMarkers),
    commandMarkers: includesAll(packet, commandMarkers),
    safetyMarkers: includesAll(packet, safetyMarkers),
    goalLinks: includesAll(goal, coordinatorMarkers),
    statusLinks: includesAll(status, [
      'Goal 10.63 Runtime Gate Execution Packet',
      'docs/orchestrator/2026-07-03-goal10-runtime-gate-execution-packet.md',
    ]),
    stateLinks: includesAll(state, [
      'Goal 10.63 consolidated runtime gate execution packet prepared',
      'docs/orchestrator/2026-07-03-goal10-runtime-gate-execution-packet.md',
    ]),
    packageScript,
  };

  const missingMarkers = [
    ...missing(checks.gateMarkers),
    ...missing(checks.requiredInputMarkers),
    ...missing(checks.resolvedGateMarkers),
    ...missing(checks.commandMarkers),
    ...missing(checks.safetyMarkers),
    ...missing(checks.goalLinks),
    ...missing(checks.statusLinks),
    ...missing(checks.stateLinks),
    ...(packageScript === 'node scripts/check-customer-data-wallet-runtime-gate-packet.js'
      ? []
      : ['package script check:customer-data-wallet-runtime-gate-packet']),
  ];

  const ok = checks.packetFilePresent && missingMarkers.length === 0;
  const result = {
    ok,
    status: ok ? 'pass_goal10_runtime_gate_packet_source_only' : 'fail_goal10_runtime_gate_packet_source_only',
    docFile: 'docs/orchestrator/2026-07-03-goal10-runtime-gate-execution-packet.md',
    sourceOnly: true,
    doesNotReadEnvironment: true,
    doesNotConnectToDatabase: true,
    doesNotCallRuntime: true,
    checks: {
      intentChain: packet.includes('Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation.'),
      executionOrder: missing(checks.gateMarkers).length === 0,
      resolvedGatesRecorded: missing(checks.resolvedGateMarkers).length === 0,
      remainingOwnerInputsMarkedMissing: missing(checks.requiredInputMarkers).length === 0,
      commandShapes: missing(checks.commandMarkers).length === 0,
      sharedOutputContract: packet.includes('## Shared Output Contract'),
      forbiddenOutputContract: packet.includes('Forbidden output across all gates:'),
      stopConditions: packet.includes('## Stop Conditions'),
      validationSection: packet.includes('## Validation For This Packet'),
      coordinatorLinks: missing(checks.goalLinks).length === 0 && missing(checks.statusLinks).length === 0 && missing(checks.stateLinks).length === 0,
      packageScript: packageScript === 'node scripts/check-customer-data-wallet-runtime-gate-packet.js',
    },
    missing: missingMarkers,
    allowedNextAction: 'execute Gate 4 or another remaining named gate only after its missing owner inputs exist',
  };

  console.log(JSON.stringify(result, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    status: 'customer_data_wallet_runtime_gate_packet_check_error',
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
}
