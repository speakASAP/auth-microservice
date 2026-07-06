#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const DEFAULT_BASE_URL = 'https://auth.alfares.cz';
const DEFAULT_REPORT = 'reports/validation/profile-centralization-runtime-readiness.json';

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg.startsWith('--base-url=')) {
        options.baseUrl = arg.slice('--base-url='.length);
      } else if (arg.startsWith('--report=')) {
        options.report = arg.slice('--report='.length);
      } else if (arg === '--no-write-report') {
        options.writeReport = false;
      } else if (arg === '--insecure-tls') {
        options.insecureTls = true;
      } else if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else {
        throw new Error(`Unknown argument: ${arg}`);
      }
      return options;
    },
    {
      baseUrl: process.env.AUTH_PROFILE_CENTRALIZATION_BASE_URL || DEFAULT_BASE_URL,
      report: process.env.AUTH_PROFILE_CENTRALIZATION_RUNTIME_REPORT || DEFAULT_REPORT,
      writeReport: process.env.AUTH_PROFILE_CENTRALIZATION_RUNTIME_WRITE_REPORT !== '0',
      insecureTls: process.env.AUTH_PROFILE_CENTRALIZATION_INSECURE_TLS === '1',
      help: false,
    },
  );
}

function printHelp() {
  console.log(`Usage: node scripts/check-profile-centralization-runtime-readiness.js [--base-url=https://auth.alfares.cz] [--report=reports/validation/profile-centralization-runtime-readiness.json] [--no-write-report] [--insecure-tls]

GET-only runtime readiness snapshot for Auth profile centralization.

The script fetches /health, /profile, and /js/profile.js; checks only status
codes and static markers; and never sends Authorization headers, cookies,
request bodies, tokens, customer data, or database queries.`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function fetchText(baseUrl, requestPath, insecureTls, accept = '*/*') {
  const target = new URL(requestPath, baseUrl);
  const client = target.protocol === 'http:' ? http : https;

  return new Promise((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: 'GET',
        timeout: 10000,
        rejectUnauthorized: !insecureTls,
        headers: {
          Accept: accept,
          'User-Agent': 'auth-profile-centralization-runtime-readiness/1.0',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 500000) {
            req.destroy(new Error(`Response too large for ${requestPath}`));
          }
        });
        res.on('end', () => {
          resolve({ path: requestPath, statusCode: res.statusCode || 0, body });
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout while requesting ${requestPath}`)));
    req.on('error', reject);
    req.end();
  });
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const [health, profile, profileJs] = await Promise.all([
    fetchText(baseUrl, '/health', options.insecureTls, 'application/json,*/*;q=0.8'),
    fetchText(baseUrl, '/profile', options.insecureTls, 'text/html,*/*;q=0.8'),
    fetchText(baseUrl, '/js/profile.js', options.insecureTls, 'application/javascript,text/javascript,*/*;q=0.8'),
  ]);

  let healthJson = null;
  try {
    healthJson = JSON.parse(health.body);
  } catch {
    healthJson = null;
  }

  const healthChecks = [
    { marker: '/health HTTP 200', present: health.statusCode === 200 },
    { marker: 'health status ok', present: healthJson?.status === 'ok' || healthJson?.success === true },
  ];

  const profileMarkers = includesAll(profile.body, [
    'id="canonical-profile-form"',
    'id="email-change-form"',
    'name="avatarUrl"',
    'name="settings"',
    '<script src="/js/profile.js"></script>',
  ]);

  const scriptMarkers = includesAll(profileJs.body, [
    "fetchJson('/auth/profile')",
    "fetchJson('/auth/profile/checkout-data')",
    "fetchJson('/auth/email-change-request')",
    "setValue('profile-avatar-url', user.avatarUrl || canonical.avatarUrl)",
    "setValue('profile-settings-json', Object.keys(settings).length ? JSON.stringify(settings, null, 2) : '')",
    'avatarUrl,',
    'settings,',
    "return_url: window.location.origin + '/profile'",
  ]);

  const transportChecks = [
    { marker: '/profile HTTP 200', present: profile.statusCode === 200 },
    { marker: '/js/profile.js HTTP 200', present: profileJs.statusCode === 200 },
  ];

  const safetyChecks = [
    { marker: 'sendsAuthorizationHeader: false', present: true },
    { marker: 'sendsCookies: false', present: true },
    { marker: 'sendsRequestBody: false', present: true },
    { marker: 'printsResponseBody: false', present: true },
    { marker: 'readsDatabase: false', present: true },
  ];

  const allChecks = [
    ...healthChecks,
    ...transportChecks,
    ...profileMarkers,
    ...scriptMarkers,
    ...safetyChecks,
  ];
  const missing = allChecks.filter((entry) => !entry.present).map((entry) => entry.marker);
  const ok = missing.length === 0;
  const report = {
    ok,
    status: ok ? 'pass_profile_centralization_runtime_readiness' : 'fail_profile_centralization_runtime_readiness',
    baseUrl: baseUrl.origin,
    sourceOnly: false,
    liveReadOnly: true,
    mutatesDatabase: false,
    deploys: false,
    sendsAuthorizationHeader: false,
    sendsCookies: false,
    sendsRequestBody: false,
    printsResponseBody: false,
    readsDatabase: false,
    activationReady: ok,
    reasonNotReady: ok ? null : 'Live Auth is reachable, but deployed hosted profile assets do not yet expose all current profile centralization markers.',
    probes: {
      health: { path: health.path, statusCode: health.statusCode, statusOk: healthJson?.status === 'ok' || healthJson?.success === true },
      profile: { path: profile.path, statusCode: profile.statusCode },
      profileJs: { path: profileJs.path, statusCode: profileJs.statusCode },
    },
    checks: {
      health: summarize(healthChecks),
      transport: summarize(transportChecks),
      profileMarkers: summarize(profileMarkers),
      scriptMarkers: summarize(scriptMarkers),
      safety: summarize(safetyChecks),
    },
    missing,
  };

  if (options.writeReport) {
    const reportPath = path.resolve(process.cwd(), options.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }

  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
