#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const packetPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-runtime-gate-execution-packet.md');
const goalPath = path.join(root, 'implementation-goals/GOAL-10-auth-customer-data-wallet.md');
const statusPath = path.join(root, 'docs/orchestrator/STATUS.md');
const statePath = path.join(root, 'docs/IMPLEMENTATION_STATE.md');
const packagePath = path.join(root, 'package.json');
const remainingAuditPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-remaining-gates-readiness-audit.md');
const postFlipFlopAuditPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-post-flipflop-owner-gated-audit.md');
const ownerDecisionPacketPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-owner-decision-packet.md');
const completionGapAuditPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-completion-gap-audit.md');
const approvedLaneEvidencePath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-approved-lane-execution-evidence.md');

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
  const remainingAudit = readText(remainingAuditPath);
  const postFlipFlopAudit = readText(postFlipFlopAuditPath);
  const ownerDecisionPacket = readText(ownerDecisionPacketPath);
  const completionGapAudit = readText(completionGapAuditPath);
  const approvedLaneEvidence = readText(approvedLaneEvidencePath);

  const gateMarkers = [
    '## Gate 1 - Auth Authenticated Wallet Smoke',
    '## Gate 2 - FlipFlop Guarded Gateway Wallet Smoke',
    '## Gate 3 - FlipFlop Authenticated Browser/Session Selector Smoke',
    '## Gate 4 - ChytraKoupe Guarded Selector Smoke',
    '## Gate 5 - Cliplot Browser/Session Wallet-Read Evidence',
    '## Gate 6 - Rent-a-box Metadata-Only Production Preflight',
  ];

  const requiredInputMarkers = [
    '[MISSING: owner-approved bounded live checkout submit/live commerce window]',
    '[MISSING: owner-approved RENT_AUTH_ADAPTER_ENABLED route migration window]',
  ];

  const resolvedGateMarkers = [
    'gate1-auth-wallet-smoke-20260703-vault-test-login',
    'pass_authenticated_wallet_crud_default_delete_smoke',
    'gate2-flipflop-auth-wallet-smoke-20260703-vault-test-login',
    'pass_flipflop_auth_wallet_gateway_smoke',
    'gate3-flipflop-auth-wallet-browser-smoke-20260703-vault-test-login',
    'pass_flipflop_auth_wallet_browser_session_smoke',
    'gate4-chytrakoupe-auth-wallet-selector-smoke-20260703-vault-test-login',
    'pass_chytrakoupe_auth_wallet_selector_smoke',
    'CLIPLOT-AUTH-WALLET-SMOKE-20260703-GATE5',
    'sanitized_auth_wallet_browser_session_smoke_recorded',
    'gate6-rent-a-box-auth-wallet-metadata-preflight-20260703',
    'pass_goal12_rent_auth_metadata_preflight',
    'auth_subject_id_column_missing',
    'e518725',
    'approval_required_goal12_route_onboarding_migration_gate',
    'route migration remains inactive',
    'Goal 10.84 remaining gates readiness audit completed',
    'docs/orchestrator/2026-07-03-goal10-remaining-gates-readiness-audit.md',
    'GOAL10-AUTH-SUBJECT-CREATE-READ-CANCEL-20260703',
    'pass_auth_wallet_order_snapshot_create_read_cancel_smoke',
    '7f0ef44',
  ];

  const commandMarkers = [
    'npm run check:customer-data-wallet-authenticated -- --execute',
    'npm run smoke:auth-wallet-checkout-profile -- --execute',
    'npm run verify:auth-wallet-checkout-selectors',
    'npm run smoke:auth-wallet-checkout-selectors',
    'npm run readiness:auth-wallet-checkout',
    'npm run smoke:auth-wallet-browser-session',
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
  const completionGapScript = packageJson.scripts?.['check:customer-data-wallet-completion-gap'] || null;
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
      'Goal 10.84 remaining gates readiness audit completed',
      'docs/orchestrator/2026-07-03-goal10-remaining-gates-readiness-audit.md',
      'Goal 10.91 post-FlipFlop owner-gated audit completed',
      'docs/orchestrator/2026-07-03-goal10-post-flipflop-owner-gated-audit.md',
      'Goal 10.92 owner decision packet prepared',
      'docs/orchestrator/2026-07-03-goal10-owner-decision-packet.md',
      'Goal 10.93 completion gap audit recorded',
      'docs/orchestrator/2026-07-03-goal10-completion-gap-audit.md',
    ]),
    remainingAuditMarkers: includesAll(remainingAudit, [
      'FlipFlop order snapshot create/read/cancel smoke passed at `origin/main` `7f0ef44`',
      'GOAL10-AUTH-SUBJECT-CREATE-READ-CANCEL-20260703',
      'owner-approved bounded live checkout submit/live commerce window',
      'owner-approved RENT_AUTH_ADAPTER_ENABLED route migration window',
      'No remaining Goal 10 gate is safely executable as a mutating/runtime transition from current state without additional owner inputs and Cliplot/Rent window decisions.',
    ]),
    postFlipFlopAuditMarkers: includesAll(postFlipFlopAudit, [
      'Goal 10 Post-FlipFlop Owner-Gated Audit',
      'no remaining safe source-only lane before Cliplot or Rent owner inputs',
      'owner approval for a bounded live checkout submit/live commerce window',
      'owner-approved RENT_AUTH_ADAPTER_ENABLED route migration window',
      'No additional source-only Cliplot hardening/verifier lane was found before that approval gate.',
      'No additional source-only Rent-a-box hardening/verifier lane was found before that approval gate.',
    ]),
    ownerDecisionPacketMarkers: includesAll(ownerDecisionPacket, [
      'Goal 10 Owner Decision Packet',
      '[MISSING: CLIPLOT_LIVE_ORDER_APPROVAL_ID]',
      '[MISSING: CLIPLOT_LIVE_PAYMENT_APPROVAL_ID]',
      '[MISSING: CLIPLOT_LIVE_NOTIFICATION_APPROVAL_ID]',
      '[MISSING: CLIPLOT_LIVE_ORDER_WAREHOUSE_SMOKE_APPROVAL_ID]',
      '[MISSING: one unused orderIdempotencyKey]',
      'ENABLE_LIVE_ORDER_SUBMIT=true',
      'duplicateCheck=IDEMPOTENCY_KEYS_NOT_USED',
      'CLIPLOT_OWNER_CREATE_REPLAY_CANCEL_SMOKE',
      '[MISSING: owner-approved RENT_AUTH_ADAPTER_ENABLED route migration window]',
      '[MISSING: owner decision for RENT_AUTH_TRANSITIONAL_ONBOARDING_ENABLED]',
      '[MISSING: owner-approved route ownership list before replacing local auth dependencies]',
      'apps/api/app/api/lifecycle.py',
      'apps/api/app/api/post_rental.py',
      'apps/api/app/api/admin/admin.py',
      'Rent-a-box has source implementation remaining, but it is dependency-gated on route/onboarding owner approval',
    ]),
    approvedLaneEvidenceMarkers: includesAll(approvedLaneEvidence, [
      'Cliplot lane complete',
      'Rent-a-box source/config migration complete',
      'Rent-a-box runtime activation blocked by Kubernetes node runtime',
      'd8e875c ops: add bounded live checkout operator',
      '4ff0b5c feat: migrate rent auth routes to hosted auth',
      '6191ba3 chore: enable rent hosted auth rollout flags',
      'b3a607c fix: align rent database url deployment secret',
      'Goal 10 is still not complete because Rent-a-box runtime activation must be rerun',
      'c11cb1d test: add rent hosted auth runtime rollout smoke',
      'npm run check:goal12-runtime-rollout-smoke',
    ]),
    completionGapAuditMarkers: includesAll(completionGapAudit, [
      'Goal 10 Completion Gap Audit',
      'Status: source-only completion audit; full goal not complete',
      'Multiple delivery addresses per authenticated user',
      'Sanitized checkout aggregate response',
      'Hosted profile wallet management UI',
      'FlipFlop can select Auth delivery/invoice entries and save back',
      'ChytraKoupe selector behavior and snapshot boundary',
      'Cliplot bounded live commerce window',
      'Rent-a-box route/onboarding migration',
      'Do not mark Goal 10 complete.',
    ]),
    packageScript,
    completionGapScript,
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
    ...missing(checks.remainingAuditMarkers),
    ...missing(checks.postFlipFlopAuditMarkers),
    ...missing(checks.ownerDecisionPacketMarkers),
    ...missing(checks.approvedLaneEvidenceMarkers),
    ...missing(checks.completionGapAuditMarkers),
    ...(packageScript === 'node scripts/check-customer-data-wallet-runtime-gate-packet.js'
      ? []
      : ['package script check:customer-data-wallet-runtime-gate-packet']),
    ...(completionGapScript === 'node scripts/check-customer-data-wallet-completion-gap.js'
      ? []
      : ['package script check:customer-data-wallet-completion-gap']),
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
      remainingGateReadinessAudit: missing(checks.remainingAuditMarkers).length === 0,
      postFlipFlopOwnerGatedAudit: missing(checks.postFlipFlopAuditMarkers).length === 0,
      ownerDecisionPacket: missing(checks.ownerDecisionPacketMarkers).length === 0,
      approvedLaneEvidence: missing(checks.approvedLaneEvidenceMarkers).length === 0,
      completionGapAudit: missing(checks.completionGapAuditMarkers).length === 0,
      packageScript: packageScript === 'node scripts/check-customer-data-wallet-runtime-gate-packet.js',
      completionGapScript: completionGapScript === 'node scripts/check-customer-data-wallet-completion-gap.js',
    },
    missing: missingMarkers,
    allowedNextAction: 'Goal 10 remains active; repair Alfares Kubernetes node/runtime, then rerun Rent-a-box deploy and post-deploy smoke for the Auth-migrated pods',
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
