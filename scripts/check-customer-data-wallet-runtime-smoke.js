#!/usr/bin/env node
const http = require('http');
const https = require('https');

const DEFAULT_BASE_URL = 'https://auth.alfares.cz';
const WALLET_PATHS = [
  '/auth/profile/checkout-data',
  '/auth/profile/delivery-addresses',
  '/auth/profile/invoice-profiles',
];

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg.startsWith('--base-url=')) {
        options.baseUrl = arg.slice('--base-url='.length);
      } else if (arg.startsWith('--expect=')) {
        options.expect = arg.slice('--expect='.length);
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
      baseUrl: process.env.AUTH_WALLET_SMOKE_BASE_URL || DEFAULT_BASE_URL,
      expect: process.env.AUTH_WALLET_SMOKE_EXPECT || 'auto',
      insecureTls: process.env.AUTH_WALLET_SMOKE_INSECURE_TLS === '1',
      help: false,
    },
  );
}

function printHelp() {
  console.log(`Usage: node scripts/check-customer-data-wallet-runtime-smoke.js [--expect=auto|predeploy|deployed] [--base-url=https://auth.alfares.cz] [--insecure-tls]

Checks public Auth customer-data-wallet route availability without credentials.

Modes:
  auto       pass when /health is 200 and wallet routes are uniformly 404 or 401
  predeploy  require /health 200 and wallet routes 404, proving code is not live yet
  deployed   require /health 200 and wallet routes 401, proving protected routes are live

The script does not send Authorization headers, request bodies, cookies, DB
queries, or token values, and it does not print response bodies or headers.`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function requestStatus(baseUrl, requestPath, insecureTls) {
  const target = new URL(requestPath, baseUrl);
  const client = target.protocol === 'http:' ? http : https;

  return new Promise((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: 'GET',
        timeout: 8000,
        rejectUnauthorized: !insecureTls,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'auth-wallet-runtime-smoke/1.0',
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          resolve({
            path: requestPath,
            statusCode: res.statusCode || 0,
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

function classify(expect, healthStatus, walletStatuses) {
  const healthOk = healthStatus.statusCode === 200;
  const allWallet404 = walletStatuses.every((entry) => entry.statusCode === 404);
  const allWallet401 = walletStatuses.every((entry) => entry.statusCode === 401);
  const noWalletServerErrors = walletStatuses.every((entry) => entry.statusCode < 500);

  if (expect === 'predeploy') {
    return {
      ok: healthOk && allWallet404,
      status: healthOk && allWallet404 ? 'pass_predeploy_wallet_routes_not_deployed' : 'fail_predeploy_expected_wallet_404',
    };
  }

  if (expect === 'deployed') {
    return {
      ok: healthOk && allWallet401,
      status: healthOk && allWallet401 ? 'pass_post_deploy_wallet_401_smoke' : 'fail_deployed_expected_wallet_401',
    };
  }

  if (expect !== 'auto') {
    throw new Error(`Invalid --expect value: ${expect}`);
  }

  if (healthOk && allWallet401) {
    return { ok: true, status: 'pass_post_deploy_wallet_401_smoke' };
  }

  if (healthOk && allWallet404) {
    return { ok: true, status: 'dependency_gated_wallet_routes_not_deployed' };
  }

  return {
    ok: false,
    status: healthOk && noWalletServerErrors ? 'fail_unexpected_wallet_status' : 'fail_auth_health_or_wallet_server_error',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const [healthStatus, ...walletStatuses] = await Promise.all([
    requestStatus(baseUrl, '/health', options.insecureTls),
    ...WALLET_PATHS.map((requestPath) => requestStatus(baseUrl, requestPath, options.insecureTls)),
  ]);
  const result = classify(options.expect, healthStatus, walletStatuses);

  console.log(JSON.stringify(
    {
      ok: result.ok,
      status: result.status,
      expect: options.expect,
      baseUrl: baseUrl.origin,
      probes: {
        health: healthStatus,
        wallet: walletStatuses,
      },
      sensitiveData: {
        sendsAuthorizationHeader: false,
        sendsCookies: false,
        sendsRequestBody: false,
        printsResponseBody: false,
        readsDatabase: false,
      },
    },
    null,
    2,
  ));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, status: 'runtime_smoke_error', message: error.message }, null, 2));
  process.exitCode = 1;
});
