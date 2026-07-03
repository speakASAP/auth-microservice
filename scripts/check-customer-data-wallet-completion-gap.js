#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-completion-gap-audit.md');
const ownerPacketPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-owner-decision-packet.md');
const goalPath = path.join(root, 'implementation-goals/GOAL-10-auth-customer-data-wallet.md');
const statePath = path.join(root, 'docs/IMPLEMENTATION_STATE.md');
const statusPath = path.join(root, 'docs/orchestrator/STATUS.md');
const packagePath = path.join(root, 'package.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(text, markers) {
  return markers.map((marker) => ({ marker, present: text.includes(marker) }));
}

function missing(results) {
  return results.filter((entry) => !entry.present).map((entry) => entry.marker);
}

function main() {
  const audit = readText(auditPath);
  const ownerPacket = readText(ownerPacketPath);
  const goal = readText(goalPath);
  const state = readText(statePath);
  const status = readText(statusPath);
  const packageJson = JSON.parse(readText(packagePath));

  const provenRequirementMarkers = includesAll(audit, [
    'Multiple delivery addresses per authenticated user',
    'Multiple invoice profiles per authenticated user',
    'Per-user ownership and default selection',
    'Sanitized checkout aggregate response',
    'Hosted profile wallet management UI',
    'Contract/tests',
    'FlipFlop can select Auth delivery/invoice entries and save back',
    'Orders stores immutable snapshots and is not reusable profile truth',
    'ChytraKoupe selector behavior and snapshot boundary',
  ]);

  const openGateMarkers = includesAll(audit, [
    'Goal 10 is not complete.',
    '[MISSING: owner answer to Cliplot bounded live commerce approval packet]',
    '[MISSING: owner answer to Rent-a-box route/onboarding approval packet]',
    'Cliplot bounded live commerce window',
    'Rent-a-box route/onboarding migration',
    'Do not mark Goal 10 complete.',
  ]);

  const ownerPacketMarkers = includesAll(ownerPacket, [
    '[MISSING: CLIPLOT_LIVE_ORDER_APPROVAL_ID]',
    '[MISSING: CLIPLOT_LIVE_PAYMENT_APPROVAL_ID]',
    '[MISSING: CLIPLOT_LIVE_NOTIFICATION_APPROVAL_ID]',
    '[MISSING: CLIPLOT_LIVE_ORDER_WAREHOUSE_SMOKE_APPROVAL_ID]',
    '[MISSING: owner-approved RENT_AUTH_ADAPTER_ENABLED route migration window]',
    '[MISSING: owner decision for RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED]',
    '[MISSING: owner-approved route ownership list before replacing local auth dependencies]',
  ]);

  const coordinatorMarkers = [
    ...includesAll(goal, [
      '10.93 Completion gap audit recorded',
      'completion gap audit and verifier keep Goal 10 active until Cliplot and Rent-a-box owner-gated lanes close',
      '[MISSING: owner answer to Cliplot bounded live commerce approval packet',
      '[MISSING: owner answer to Rent-a-box route/onboarding approval packet',
    ]),
    ...includesAll(state, [
      'Goal 10.93 completion gap audit recorded',
      'docs/orchestrator/2026-07-03-goal10-completion-gap-audit.md',
    ]),
    ...includesAll(status, [
      'Goal 10.93 Completion Gap Audit',
      'Cliplot live commerce and Rent-a-box route/onboarding remain incomplete owner-gated lanes',
    ]),
  ];

  const packageScript = packageJson.scripts?.['check:customer-data-wallet-completion-gap'] || null;
  const missingMarkers = [
    ...missing(provenRequirementMarkers),
    ...missing(openGateMarkers),
    ...missing(ownerPacketMarkers),
    ...missing(coordinatorMarkers),
    ...(packageScript === 'node scripts/check-customer-data-wallet-completion-gap.js'
      ? []
      : ['package script check:customer-data-wallet-completion-gap']),
  ];

  const ok = missingMarkers.length === 0;
  const result = {
    ok,
    status: ok ? 'pass_goal10_completion_gap_source_only' : 'fail_goal10_completion_gap_source_only',
    sourceOnly: true,
    doesNotReadEnvironment: true,
    doesNotConnectToDatabase: true,
    doesNotCallRuntime: true,
    goalComplete: false,
    provenRequirementMarkers: missing(provenRequirementMarkers).length === 0,
    openGatesPreserved: missing(openGateMarkers).length === 0,
    ownerPacketLinked: missing(ownerPacketMarkers).length === 0,
    coordinatorLinked: missing(coordinatorMarkers).length === 0,
    missing: missingMarkers,
    allowedNextAction: 'Goal 10 remains active; answer the Cliplot or Rent-a-box owner packet before opening the next implementation/runtime lane',
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
    status: 'goal10_completion_gap_check_error',
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
}
