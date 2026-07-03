#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-completion-gap-audit.md');
const ownerPacketPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-owner-decision-packet.md');
const handoffPacketPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-approved-lane-handoff-packet.md');
const laneReadinessIndexPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-lane-readiness-index.json');
const hostedProfileStaticReportPath = path.join(root, 'reports/validation/goal10-hosted-profile-static-smoke.json');
const parallelLaneRefreshPath = path.join(root, 'docs/orchestrator/2026-07-03-goal10-parallel-lane-refresh.md');
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
  const handoffPacket = readText(handoffPacketPath);
  const laneReadinessIndex = JSON.parse(readText(laneReadinessIndexPath));
  const hostedProfileStaticReport = JSON.parse(readText(hostedProfileStaticReportPath));
  const parallelLaneRefresh = readText(parallelLaneRefreshPath);
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

  const auditHostedProfileMarkers = includesAll(audit, [
    'Hosted profile wallet management UI | Proven in source/tests and fresh live static smoke',
    'reports/validation/goal10-hosted-profile-static-smoke.json',
    'live GET-only `/profile` and `/js/profile.js` HTTP 200 evidence',
    'npm run check:customer-data-wallet-hosted-profile-static -- --base-url=https://auth.alfares.cz --no-write-report',
  ]);

  const staleAuditMarkers = [
    {
      marker: 'stale hosted profile weak audit marker removed',
      present: !audit.includes('fresh live Auth hosted profile/browser smoke was not rerun in this audit')
        && !audit.includes('Fresh browser live smoke was not rerun in this audit')
        && !audit.includes('Fresh live Auth hosted profile verification:'),
    },
  ];

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

  const handoffPacketMarkers = includesAll(handoffPacket, [
    'Goal 10 Approved Lane Handoff Packet',
    'Status: inactive source-only handoff; owner approval required before use',
    'Lane A - Cliplot Bounded Live Commerce Worker Prompt',
    'Lane B - Rent-a-box Route/Onboarding Migration Worker Prompt',
    'This packet is not approval.',
    'Do not start either lane from this packet alone.',
    '`ENABLE_LIVE_ORDER_SUBMIT=false`',
    'RENT_AUTH_ADAPTER_ENABLED',
    'apps/api/app/api/lifecycle.py',
    'npm run check:customer-data-wallet-completion-gap',
  ]);

  const laneReadinessIndexChecks = [
    {
      marker: 'lane readiness index schema/status',
      present: laneReadinessIndex.schemaVersion === 'auth.customer-data-wallet.goal10.lane-readiness-index.v1'
        && laneReadinessIndex.sourceOnly === true
        && laneReadinessIndex.goalComplete === false,
    },
    {
      marker: 'lane readiness index has exactly two lanes',
      present: Array.isArray(laneReadinessIndex.lanes) && laneReadinessIndex.lanes.length === 2,
    },
    {
      marker: 'cliplot lane remains owner-gated and non-startable',
      present: laneReadinessIndex.lanes?.some((lane) => lane.id === 'cliplot-bounded-live-commerce'
        && lane.status === 'blocked_on_owner_approval'
        && lane.canStartNow === false
        && lane.requiredOwnerInputs?.includes('CLIPLOT_LIVE_ORDER_APPROVAL_ID')
        && lane.forbiddenUntilApproval?.includes('POST /api/checkout/submit')
        && lane.completionEvidenceRequired?.includes('ENABLE_LIVE_ORDER_SUBMIT=false after cleanup')),
    },
    {
      marker: 'rent-a-box lane remains owner-gated and non-startable',
      present: laneReadinessIndex.lanes?.some((lane) => lane.id === 'rent-a-box-route-onboarding-migration'
        && lane.status === 'blocked_on_owner_approval'
        && lane.canStartNow === false
        && lane.requiredOwnerInputs?.includes('owner-approved route ownership list before replacing local auth dependencies')
        && lane.forbiddenUntilApproval?.includes('live DB migration/backfill')
        && lane.allowedFilesAfterApproval?.includes('apps/api/app/api/lifecycle.py')),
    },
    {
      marker: 'lane readiness index links source packets',
      present: laneReadinessIndex.evidenceSources?.includes('docs/orchestrator/2026-07-03-goal10-owner-decision-packet.md')
        && laneReadinessIndex.evidenceSources?.includes('docs/orchestrator/2026-07-03-goal10-approved-lane-handoff-packet.md')
        && laneReadinessIndex.evidenceSources?.includes('docs/orchestrator/2026-07-03-goal10-parallel-lane-refresh.md'),
    },
  ];

  const parallelLaneRefreshMarkers = includesAll(parallelLaneRefresh, [
    'Goal 10 Parallel Lane Refresh',
    'read-only parallel subagent refresh; owner-gated lanes remain closed',
    'ddceee8 docs: record auth wallet live fetch evidence',
    'e518725 test: add goal 12 route onboarding gate',
    'npm run readiness:auth-wallet-checkout',
    'npm run readiness:auth-wallet-runtime-checkout-evidence',
    'python3 -B scripts/check_goal12_auth_wallet_readiness.py --root .',
    'approval_required_goal12_route_onboarding_migration_gate',
    'Goal 10 remains active and not complete.',
    'no safe source-only consumer lane to start',
  ]);

  const hostedProfileStaticReportChecks = [
    {
      marker: 'hosted profile static report passed',
      present: hostedProfileStaticReport.ok === true
        && hostedProfileStaticReport.status === 'pass_goal10_hosted_profile_static_live_smoke',
    },
    {
      marker: 'hosted profile static report is GET-only and non-mutating',
      present: hostedProfileStaticReport.liveStaticGetOnly === true
        && hostedProfileStaticReport.mutatesAuthWallet === false
        && hostedProfileStaticReport.sendsAuthorizationHeader === false
        && hostedProfileStaticReport.sendsCookies === false
        && hostedProfileStaticReport.sendsRequestBody === false
        && hostedProfileStaticReport.printsResponseBody === false
        && hostedProfileStaticReport.readsDatabase === false,
    },
    {
      marker: 'hosted profile static report saw live profile assets',
      present: hostedProfileStaticReport.probes?.profile?.statusCode === 200
        && hostedProfileStaticReport.probes?.profileJs?.statusCode === 200,
    },
  ];

  const coordinatorMarkers = [
    ...includesAll(goal, [
      '10.93 Completion gap audit recorded',
      '10.95 Approved-lane handoff packet prepared',
      'approved-lane handoff packet is ready but inactive',
      '[MISSING: owner answer to Cliplot bounded live commerce approval packet',
      '[MISSING: owner answer to Rent-a-box route/onboarding approval packet',
    ]),
    ...includesAll(state, [
      'Goal 10.93 completion gap audit recorded',
      'docs/orchestrator/2026-07-03-goal10-completion-gap-audit.md',
      'Goal 10.95 approved-lane handoff packet prepared',
      'docs/orchestrator/2026-07-03-goal10-approved-lane-handoff-packet.md',
      'Goal 10.96 lane readiness index prepared',
      'docs/orchestrator/2026-07-03-goal10-lane-readiness-index.json',
      'Goal 10.99 parallel lane refresh recorded',
      'docs/orchestrator/2026-07-03-goal10-parallel-lane-refresh.md',
      'Goal 10.97 hosted profile static live smoke prepared',
      'reports/validation/goal10-hosted-profile-static-smoke.json',
    ]),
    ...includesAll(status, [
      'Goal 10.93 Completion Gap Audit',
      'Cliplot live commerce and Rent-a-box route/onboarding remain incomplete owner-gated lanes',
      'Goal 10.95 Approved Lane Handoff Packet',
      'Goal 10.96 Lane Readiness Index',
      'Goal 10.97 Hosted Profile Static Live Smoke',
    ]),
  ];

  const packageScript = packageJson.scripts?.['check:customer-data-wallet-completion-gap'] || null;
  const missingMarkers = [
    ...missing(provenRequirementMarkers),
    ...missing(auditHostedProfileMarkers),
    ...missing(staleAuditMarkers),
    ...missing(openGateMarkers),
    ...missing(ownerPacketMarkers),
    ...missing(handoffPacketMarkers),
    ...missing(laneReadinessIndexChecks),
    ...missing(parallelLaneRefreshMarkers),
    ...missing(hostedProfileStaticReportChecks),
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
    auditHostedProfileEvidenceCurrent: missing(auditHostedProfileMarkers).length === 0 && missing(staleAuditMarkers).length === 0,
    openGatesPreserved: missing(openGateMarkers).length === 0,
    ownerPacketLinked: missing(ownerPacketMarkers).length === 0,
    handoffPacketLinked: missing(handoffPacketMarkers).length === 0,
    laneReadinessIndexLinked: missing(laneReadinessIndexChecks).length === 0,
    parallelLaneRefreshLinked: missing(parallelLaneRefreshMarkers).length === 0,
    hostedProfileStaticLiveSmoke: missing(hostedProfileStaticReportChecks).length === 0,
    coordinatorLinked: missing(coordinatorMarkers).length === 0,
    missing: missingMarkers,
    allowedNextAction: 'Goal 10 remains active; after owner approval use docs/orchestrator/2026-07-03-goal10-approved-lane-handoff-packet.md to start the bounded lane',
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
