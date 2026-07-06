#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const DEFAULT_BASE_URL = 'https://auth.alfares.cz';
const DEFAULT_REPORT = 'reports/validation/goal10-hosted-profile-static-smoke.json';

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg.startsWith('--base-url=')) {
        options.baseUrl = arg.slice('--base-url='.length);
      } else if (arg.startsWith('--report=')) {
        options.report = arg.slice('--report='.length);
      } else if (arg === '--insecure-tls') {
        options.insecureTls = true;
      } else if (arg === '--no-write-report') {
        options.writeReport = false;
      } else if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else {
        throw new Error(`Unknown argument: ${arg}`);
      }
      return options;
    },
    {
      baseUrl: process.env.AUTH_WALLET_HOSTED_PROFILE_BASE_URL || DEFAULT_BASE_URL,
      report: process.env.AUTH_WALLET_HOSTED_PROFILE_REPORT || DEFAULT_REPORT,
      insecureTls: process.env.AUTH_WALLET_HOSTED_PROFILE_INSECURE_TLS === '1',
      writeReport: process.env.AUTH_WALLET_HOSTED_PROFILE_WRITE_REPORT !== '0',
      help: false,
    },
  );
}

function printHelp() {
  console.log(`Usage: node scripts/check-customer-data-wallet-hosted-profile-static.js [--base-url=https://auth.alfares.cz] [--report=reports/validation/goal10-hosted-profile-static-smoke.json] [--no-write-report] [--insecure-tls]

GET-only live static smoke for hosted Auth profile wallet assets.

The script fetches /profile and /js/profile.js, checks wallet-management
markers, records booleans/status codes only, and never sends Authorization
headers, cookies, request bodies, tokens, customer data, or database queries.`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function fetchText(baseUrl, requestPath, insecureTls) {
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
          Accept: 'text/html,application/javascript,text/javascript,*/*;q=0.8',
          'User-Agent': 'auth-wallet-hosted-profile-static-smoke/1.0',
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
          resolve({
            path: requestPath,
            statusCode: res.statusCode || 0,
            body,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout while requesting ${requestPath}`));
    });
    req.on('error', reject);
    req.end();
  });
}

function includesAll(text, markers) {
  return markers.map((marker) => ({
    marker,
    present: text.includes(marker),
  }));
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
  const [profile, profileJs] = await Promise.all([
    fetchText(baseUrl, '/profile', options.insecureTls),
    fetchText(baseUrl, '/js/profile.js', options.insecureTls),
  ]);

  const profileMarkers = includesAll(profile.body, [
    'id="canonical-profile-form"',
    'id="delivery-addresses-section"',
    'id="delivery-address-form"',
    'id="invoice-profiles-section"',
    'id="invoice-profile-form"',
    'id="email-change-form"',
    'name="companyId"',
    'name="taxId"',
    'name="vatId"',
    'name="avatarUrl"',
    'name="settings"',
    '<script src="/js/profile.js"></script>',
  ]);

  const scriptMarkers = includesAll(profileJs.body, [
    "fetchJson('/auth/profile')",
    "fetchJson('/auth/profile/checkout-data')",
    "fetchJson('/auth/email-change-request')",
    "'/auth/profile/delivery-addresses'",
    "'/auth/profile/invoice-profiles'",
    "Authorization: 'Bearer ' + getToken()",
    "method: 'PATCH'",
    "method: 'POST'",
    "method: 'DELETE'",
    "history.replaceState(null, '', window.location.pathname + window.location.search)",
    "params.get('access_token') || params.get('accessToken')",
    "params.get('refresh_token') || params.get('refreshToken')",
    "body: JSON.stringify({ identifier, password })",
    "setValue('profile-avatar-url', user.avatarUrl || canonical.avatarUrl)",
    "setValue('profile-settings-json', Object.keys(settings).length ? JSON.stringify(settings, null, 2) : '')",
    "avatarUrl,",
    "settings,",
    "return_url: window.location.origin + '/profile'",
  ]);

  const negativeMarkers = [
    {
      marker: 'profile js does not use email-only login body',
      present: !profileJs.body.includes('body: JSON.stringify({ email, password })'),
    },
    {
      marker: 'profile js does not call console.log',
      present: !profileJs.body.includes('console.log'),
    },
    {
      marker: 'profile js does not use localStorage',
      present: !profileJs.body.includes('localStorage'),
    },
  ];

  const allChecks = [
    { marker: '/profile HTTP 200', present: profile.statusCode === 200 },
    { marker: '/js/profile.js HTTP 200', present: profileJs.statusCode === 200 },
    ...profileMarkers,
    ...scriptMarkers,
    ...negativeMarkers,
  ];
  const missing = allChecks.filter((entry) => !entry.present).map((entry) => entry.marker);
  const ok = missing.length === 0;
  const report = {
    ok,
    status: ok ? 'pass_goal10_hosted_profile_static_live_smoke' : 'fail_goal10_hosted_profile_static_live_smoke',
    baseUrl: baseUrl.origin,
    sourceOnly: false,
    liveStaticGetOnly: true,
    mutatesAuthWallet: false,
    sendsAuthorizationHeader: false,
    sendsCookies: false,
    sendsRequestBody: false,
    printsResponseBody: false,
    readsDatabase: false,
    probes: {
      profile: { path: profile.path, statusCode: profile.statusCode },
      profileJs: { path: profileJs.path, statusCode: profileJs.statusCode },
    },
    checks: {
      profileMarkers: summarize(profileMarkers),
      scriptMarkers: summarize(scriptMarkers),
      negativeMarkers: summarize(negativeMarkers),
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
  console.error(JSON.stringify({
    ok: false,
    status: 'goal10_hosted_profile_static_smoke_error',
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
});
