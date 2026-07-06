#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const DEFAULT_BASE_URL = 'https://auth.alfares.cz';
const DEFAULT_REPORT = 'reports/validation/auth-email-change-runtime-smoke.json';
const REQUIRED_RUN_FLAG = '1';
const REQUIRED_CONFIRM = 'VERIFIED_EMAIL_CHANGE';

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg === '--execute') {
        options.execute = true;
      } else if (arg.startsWith('--mode=')) {
        options.mode = arg.slice('--mode='.length);
      } else if (arg.startsWith('--base-url=')) {
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
      execute: false,
      mode: process.env.AUTH_EMAIL_CHANGE_SMOKE_MODE || 'request',
      baseUrl: process.env.AUTH_EMAIL_CHANGE_SMOKE_BASE_URL || DEFAULT_BASE_URL,
      report: process.env.AUTH_EMAIL_CHANGE_SMOKE_REPORT || DEFAULT_REPORT,
      writeReport: process.env.AUTH_EMAIL_CHANGE_SMOKE_WRITE_REPORT !== '0',
      insecureTls: process.env.AUTH_EMAIL_CHANGE_SMOKE_INSECURE_TLS === '1',
      help: false,
    },
  );
}

function printHelp() {
  console.log(`Usage: node scripts/check-auth-email-change-runtime-smoke.js [--execute] [--mode=request|confirm|request-confirm] [--base-url=https://auth.alfares.cz] [--report=reports/validation/auth-email-change-runtime-smoke.json] [--no-write-report] [--insecure-tls]

Approval-gated Auth verified-email-change runtime smoke.

Default mode is source-only and non-mutating. Live execution requires all gates:
  --execute
  RUN_AUTH_EMAIL_CHANGE_SMOKE=1
  AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID=<non-secret approval id>
  AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE

Request mode additionally requires:
  AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE=<file containing bearer token>
    or AUTH_EMAIL_CHANGE_SMOKE_BEARER_TOKEN=<owner-approved synthetic bearer>
  AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL_FILE=<file containing synthetic new email>
    or AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL=<synthetic new email>
  optional AUTH_EMAIL_CHANGE_SMOKE_CURRENT_PASSWORD_FILE=<file containing current password>

Confirm mode additionally requires:
  AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE=<file containing email-change token from approved operator/inbox path>

The script never prints bearer tokens, passwords, confirmation tokens, email
addresses, request bodies, response bodies, decoded JWT claims, or customer data.
Output is limited to booleans, HTTP statuses, mode, approval id presence, and
whether expected response fields were present.`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function readOptionalFile(filePath) {
  if (!filePath) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
}

function readBearerToken() {
  return (process.env.AUTH_EMAIL_CHANGE_SMOKE_BEARER_TOKEN || readOptionalFile(process.env.AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE)).trim();
}

function readNewEmail() {
  return (process.env.AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL || readOptionalFile(process.env.AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL_FILE)).trim();
}

function readCurrentPassword() {
  return readOptionalFile(process.env.AUTH_EMAIL_CHANGE_SMOKE_CURRENT_PASSWORD_FILE);
}

function readConfirmToken() {
  return readOptionalFile(process.env.AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE);
}

function hasRequestInputs() {
  return Boolean(
    (process.env.AUTH_EMAIL_CHANGE_SMOKE_BEARER_TOKEN || process.env.AUTH_EMAIL_CHANGE_SMOKE_TOKEN_FILE) &&
      (process.env.AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL || process.env.AUTH_EMAIL_CHANGE_SMOKE_NEW_EMAIL_FILE),
  );
}

function hasConfirmInputs() {
  return Boolean(process.env.AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE);
}

function requestJson(baseUrl, requestPath, options = {}) {
  const target = new URL(requestPath, baseUrl);
  const client = target.protocol === 'http:' ? http : https;
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: options.method || 'GET',
        timeout: 10000,
        rejectUnauthorized: !options.insecureTls,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'auth-email-change-runtime-smoke/1.0',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 200000) {
            req.destroy(new Error(`Response too large for ${requestPath}`));
          }
        });
        res.on('end', () => {
          let data = null;
          if (raw.trim()) {
            try {
              data = JSON.parse(raw);
            } catch {
              data = null;
            }
          }
          resolve({ statusCode: res.statusCode || 0, data });
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout while requesting ${requestPath}`)));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildGateReport(options) {
  const gates = {
    execute: options.execute,
    runFlagPresent: process.env.RUN_AUTH_EMAIL_CHANGE_SMOKE === REQUIRED_RUN_FLAG,
    approvalIdPresent: Boolean(process.env.AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID),
    confirmPhrasePresent: process.env.AUTH_EMAIL_CHANGE_SMOKE_CONFIRM === REQUIRED_CONFIRM,
    requestInputsPresent: hasRequestInputs(),
    confirmInputsPresent: hasConfirmInputs(),
  };
  const modeNeedsRequest = ['request', 'request-confirm'].includes(options.mode);
  const modeNeedsConfirm = ['confirm', 'request-confirm'].includes(options.mode);
  const missing = [];
  if (!gates.execute) missing.push('--execute');
  if (!gates.runFlagPresent) missing.push('RUN_AUTH_EMAIL_CHANGE_SMOKE=1');
  if (!gates.approvalIdPresent) missing.push('AUTH_EMAIL_CHANGE_SMOKE_APPROVAL_ID');
  if (!gates.confirmPhrasePresent) missing.push('AUTH_EMAIL_CHANGE_SMOKE_CONFIRM=VERIFIED_EMAIL_CHANGE');
  if (modeNeedsRequest && !gates.requestInputsPresent) missing.push('request token/new-email inputs');
  if (modeNeedsConfirm && !gates.confirmInputsPresent) missing.push('AUTH_EMAIL_CHANGE_CONFIRM_TOKEN_FILE');
  return {
    ok: false,
    status: 'approval_required_auth_email_change_runtime_smoke',
    sourceOnly: true,
    mutatesAuthEmail: false,
    sendsAuthorizationHeader: false,
    sendsRequestBody: false,
    printsRequestBody: false,
    printsResponseBody: false,
    printsBearerToken: false,
    printsPassword: false,
    printsEmailChangeToken: false,
    printsEmailAddress: false,
    readsDatabase: false,
    mode: options.mode,
    gates,
    missing,
  };
}

function assertMode(mode) {
  if (!['request', 'confirm', 'request-confirm'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }
}

async function runRequest(baseUrl, options) {
  const token = readBearerToken();
  const newEmail = readNewEmail();
  const currentPassword = readCurrentPassword();
  const response = await requestJson(baseUrl, '/auth/email-change-request', {
    method: 'POST',
    token,
    insecureTls: options.insecureTls,
    body: {
      newEmail,
      ...(currentPassword ? { currentPassword } : {}),
      return_url: `${baseUrl.origin}/profile`,
    },
  });
  return {
    path: '/auth/email-change-request',
    method: 'POST',
    statusCode: response.statusCode,
    successStatus: response.statusCode >= 200 && response.statusCode <= 299,
    messageFieldPresent: Boolean(response.data && typeof response.data.message === 'string'),
  };
}

async function runConfirm(baseUrl, options) {
  const token = readConfirmToken();
  const response = await requestJson(baseUrl, '/auth/email-change-confirm', {
    method: 'POST',
    insecureTls: options.insecureTls,
    body: { token },
  });
  return {
    path: '/auth/email-change-confirm',
    method: 'POST',
    statusCode: response.statusCode,
    successStatus: response.statusCode >= 200 && response.statusCode <= 299,
    messageFieldPresent: Boolean(response.data && typeof response.data.message === 'string'),
    userFieldPresent: Boolean(response.data && response.data.user),
    returnUrlFieldPresent: Boolean(response.data && Object.prototype.hasOwnProperty.call(response.data, 'returnUrl')),
  };
}

function writeReport(reportPath, report) {
  const resolved = path.resolve(process.cwd(), reportPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2) + '\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  assertMode(options.mode);

  const gateReport = buildGateReport(options);
  if (gateReport.missing.length > 0) {
    console.log(JSON.stringify(gateReport, null, 2));
    return;
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const steps = [];
  if (['request', 'request-confirm'].includes(options.mode)) {
    steps.push(await runRequest(baseUrl, options));
  }
  if (['confirm', 'request-confirm'].includes(options.mode)) {
    steps.push(await runConfirm(baseUrl, options));
  }

  const ok = steps.length > 0 && steps.every((step) => step.successStatus);
  const report = {
    ok,
    status: ok ? 'pass_auth_email_change_runtime_smoke' : 'fail_auth_email_change_runtime_smoke',
    sourceOnly: false,
    mutatesAuthEmail: options.mode === 'confirm' || options.mode === 'request-confirm',
    sendsAuthorizationHeader: ['request', 'request-confirm'].includes(options.mode),
    sendsRequestBody: true,
    printsRequestBody: false,
    printsResponseBody: false,
    printsBearerToken: false,
    printsPassword: false,
    printsEmailChangeToken: false,
    printsEmailAddress: false,
    readsDatabase: false,
    baseUrl: baseUrl.origin,
    mode: options.mode,
    approvalIdPresent: true,
    steps,
  };
  if (options.writeReport) {
    writeReport(options.report, report);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    status: 'auth_email_change_runtime_smoke_error',
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
});
