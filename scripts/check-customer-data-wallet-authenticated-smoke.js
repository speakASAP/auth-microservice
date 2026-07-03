#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');

const DEFAULT_BASE_URL = 'https://auth.alfares.cz';
const REQUIRED_CONFIRM = 'CREATE_UPDATE_DEFAULT_DELETE';
const REQUIRED_RUN_FLAG = '1';

const PATHS = {
  checkoutData: '/auth/profile/checkout-data',
  deliveryAddresses: '/auth/profile/delivery-addresses',
  invoiceProfiles: '/auth/profile/invoice-profiles',
};

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg === '--execute') {
        options.execute = true;
      } else if (arg.startsWith('--base-url=')) {
        options.baseUrl = arg.slice('--base-url='.length);
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
      baseUrl: process.env.AUTH_WALLET_SMOKE_BASE_URL || DEFAULT_BASE_URL,
      insecureTls: process.env.AUTH_WALLET_SMOKE_INSECURE_TLS === '1',
      help: false,
    },
  );
}

function printHelp() {
  console.log(`Usage: node scripts/check-customer-data-wallet-authenticated-smoke.js [--execute] [--base-url=https://auth.alfares.cz] [--insecure-tls]

Approval-gated authenticated Auth customer-data-wallet CRUD/default/delete smoke.

Default mode is source-only and non-mutating. Live execution requires all gates:
  --execute
  RUN_AUTH_WALLET_AUTHENTICATED_SMOKE=1
  AUTH_WALLET_SMOKE_APPROVAL_ID=<non-secret approval id>
  AUTH_WALLET_SMOKE_CONFIRM=CREATE_UPDATE_DEFAULT_DELETE
  AUTH_WALLET_SMOKE_BEARER_TOKEN=<owner-approved synthetic token>
    or AUTH_WALLET_SMOKE_TOKEN_FILE=<file containing the token>

The script creates only synthetic delivery/invoice wallet rows for the approved
authenticated subject, updates them, sets them as defaults, verifies checkout
aggregate visibility, and deletes the rows it created. Output is sanitized:
HTTP statuses, schema version, booleans, and short ID hashes only.`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function readToken() {
  if (process.env.AUTH_WALLET_SMOKE_BEARER_TOKEN) {
    return process.env.AUTH_WALLET_SMOKE_BEARER_TOKEN.trim();
  }
  if (process.env.AUTH_WALLET_SMOKE_TOKEN_FILE) {
    return fs.readFileSync(process.env.AUTH_WALLET_SMOKE_TOKEN_FILE, 'utf8').trim();
  }
  return '';
}

function hashId(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function summarizeStep(path, method, statusCode, id) {
  return {
    method,
    path,
    statusCode,
    idPresent: Boolean(id),
    idHash: hashId(id),
  };
}

function requestJson(baseUrl, token, requestPath, options = {}) {
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
          'User-Agent': 'auth-wallet-authenticated-smoke/1.0',
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
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
          resolve({
            statusCode: res.statusCode || 0,
            data,
          });
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout while requesting ${requestPath}`)));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function assertSuccess(response, label) {
  if (response.statusCode < 200 || response.statusCode > 299) {
    throw new Error(`${label} returned HTTP ${response.statusCode}`);
  }
}

function unwrap(data, key) {
  if (!data || typeof data !== 'object') return null;
  return data[key] || null;
}

function findById(items, id) {
  return Array.isArray(items) ? items.find((item) => item && item.id === id) : null;
}

function buildSyntheticPayloads(runId) {
  return {
    deliveryCreate: {
      label: `codex-wallet-smoke-${runId}`,
      firstName: 'Synthetic',
      lastName: 'WalletSmoke',
      company: 'Synthetic Wallet Smoke',
      street: 'Smoke Street 10',
      street2: 'Suite Source',
      city: 'Praha',
      region: 'Praha',
      postalCode: '11000',
      country: 'CZ',
      phone: '+420777000111',
      email: `auth-wallet-smoke-${runId}@example.invalid`,
      deliveryInstructions: 'Synthetic smoke row. Delete after test.',
      isDefault: false,
      sourceApplication: 'codex-auth-wallet-smoke',
    },
    deliveryUpdate: {
      label: `codex-wallet-smoke-${runId}-updated`,
      city: 'Brno',
      postalCode: '60200',
      isDefault: false,
      sourceApplication: 'codex-auth-wallet-smoke',
    },
    invoiceCreate: {
      label: `codex-invoice-smoke-${runId}`,
      type: 'company',
      firstName: 'Synthetic',
      lastName: 'InvoiceSmoke',
      companyName: 'Synthetic Wallet Smoke s.r.o.',
      companyId: '12345678',
      taxId: 'CZ12345678',
      vatId: 'CZ12345678',
      street: 'Invoice Street 20',
      street2: 'Floor 1',
      city: 'Praha',
      region: 'Praha',
      postalCode: '11000',
      country: 'CZ',
      phone: '+420777000222',
      email: `auth-invoice-smoke-${runId}@example.invalid`,
      isDefault: false,
      sourceApplication: 'codex-auth-wallet-smoke',
    },
    invoiceUpdate: {
      label: `codex-invoice-smoke-${runId}-updated`,
      city: 'Ostrava',
      postalCode: '70200',
      isDefault: false,
      sourceApplication: 'codex-auth-wallet-smoke',
    },
  };
}

function assertLiveGates(options) {
  const missing = [];
  if (!options.execute) missing.push('--execute');
  if (process.env.RUN_AUTH_WALLET_AUTHENTICATED_SMOKE !== REQUIRED_RUN_FLAG) {
    missing.push(`RUN_AUTH_WALLET_AUTHENTICATED_SMOKE=${REQUIRED_RUN_FLAG}`);
  }
  if (!process.env.AUTH_WALLET_SMOKE_APPROVAL_ID) {
    missing.push('AUTH_WALLET_SMOKE_APPROVAL_ID');
  }
  if (process.env.AUTH_WALLET_SMOKE_CONFIRM !== REQUIRED_CONFIRM) {
    missing.push(`AUTH_WALLET_SMOKE_CONFIRM=${REQUIRED_CONFIRM}`);
  }
  if (!readToken()) {
    missing.push('AUTH_WALLET_SMOKE_BEARER_TOKEN or AUTH_WALLET_SMOKE_TOKEN_FILE');
  }
  return missing;
}

async function cleanupCreated(baseUrl, token, created, insecureTls, steps) {
  const cleanup = [];
  if (created.deliveryAddressId) {
    const response = await requestJson(baseUrl, token, `${PATHS.deliveryAddresses}/${encodeURIComponent(created.deliveryAddressId)}`, {
      method: 'DELETE',
      insecureTls,
    }).catch((error) => ({ statusCode: 0, error: error.message }));
    cleanup.push({
      resource: 'deliveryAddress',
      idHash: hashId(created.deliveryAddressId),
      statusCode: response.statusCode,
      successBody: response.data?.success === true,
      ok: response.statusCode >= 200 && response.statusCode <= 299,
    });
    steps.push(summarizeStep(`${PATHS.deliveryAddresses}/:id`, 'DELETE', response.statusCode, created.deliveryAddressId));
  }
  if (created.invoiceProfileId) {
    const response = await requestJson(baseUrl, token, `${PATHS.invoiceProfiles}/${encodeURIComponent(created.invoiceProfileId)}`, {
      method: 'DELETE',
      insecureTls,
    }).catch((error) => ({ statusCode: 0, error: error.message }));
    cleanup.push({
      resource: 'invoiceProfile',
      idHash: hashId(created.invoiceProfileId),
      statusCode: response.statusCode,
      successBody: response.data?.success === true,
      ok: response.statusCode >= 200 && response.statusCode <= 299,
    });
    steps.push(summarizeStep(`${PATHS.invoiceProfiles}/:id`, 'DELETE', response.statusCode, created.invoiceProfileId));
  }
  return cleanup;
}

async function verifyDeleted(baseUrl, token, created, insecureTls, steps) {
  const deleted = {};
  if (created.deliveryAddressId) {
    const response = await requestJson(baseUrl, token, PATHS.deliveryAddresses, { insecureTls });
    assertSuccess(response, 'list delivery addresses after delete');
    steps.push(summarizeStep(PATHS.deliveryAddresses, 'GET', response.statusCode));
    deleted.deliveryAddressAbsent = !findById(response.data?.deliveryAddresses, created.deliveryAddressId);
  }
  if (created.invoiceProfileId) {
    const response = await requestJson(baseUrl, token, PATHS.invoiceProfiles, { insecureTls });
    assertSuccess(response, 'list invoice profiles after delete');
    steps.push(summarizeStep(PATHS.invoiceProfiles, 'GET', response.statusCode));
    deleted.invoiceProfileAbsent = !findById(response.data?.invoiceProfiles, created.invoiceProfileId);
  }
  return deleted;
}

async function executeSmoke(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const token = readToken();
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const payloads = buildSyntheticPayloads(runId);
  const created = {};
  const steps = [];
  const assertions = {};

  try {
    const initialCheckout = await requestJson(baseUrl, token, PATHS.checkoutData, { insecureTls: options.insecureTls });
    assertSuccess(initialCheckout, 'initial checkout-data');
    steps.push(summarizeStep(PATHS.checkoutData, 'GET', initialCheckout.statusCode));
    assertions.schemaVersion = initialCheckout.data?.schemaVersion || null;

    const deliveryCreate = await requestJson(baseUrl, token, PATHS.deliveryAddresses, {
      method: 'POST',
      body: payloads.deliveryCreate,
      insecureTls: options.insecureTls,
    });
    assertSuccess(deliveryCreate, 'create delivery address');
    const deliveryAddress = unwrap(deliveryCreate.data, 'deliveryAddress');
    created.deliveryAddressId = deliveryAddress?.id;
    if (!created.deliveryAddressId) throw new Error('create delivery address response missing id');
    steps.push(summarizeStep(PATHS.deliveryAddresses, 'POST', deliveryCreate.statusCode, created.deliveryAddressId));

    const deliveryUpdate = await requestJson(baseUrl, token, `${PATHS.deliveryAddresses}/${encodeURIComponent(created.deliveryAddressId)}`, {
      method: 'PATCH',
      body: payloads.deliveryUpdate,
      insecureTls: options.insecureTls,
    });
    assertSuccess(deliveryUpdate, 'update delivery address');
    steps.push(summarizeStep(`${PATHS.deliveryAddresses}/:id`, 'PATCH', deliveryUpdate.statusCode, created.deliveryAddressId));

    const deliveryDefault = await requestJson(baseUrl, token, `${PATHS.deliveryAddresses}/${encodeURIComponent(created.deliveryAddressId)}/default`, {
      method: 'POST',
      insecureTls: options.insecureTls,
    });
    assertSuccess(deliveryDefault, 'default delivery address');
    const defaultDeliveryAddress = unwrap(deliveryDefault.data, 'deliveryAddress');
    assertions.deliveryDefaultSelected = defaultDeliveryAddress?.id === created.deliveryAddressId && defaultDeliveryAddress?.isDefault === true;
    steps.push(summarizeStep(`${PATHS.deliveryAddresses}/:id/default`, 'POST', deliveryDefault.statusCode, created.deliveryAddressId));

    const invoiceCreate = await requestJson(baseUrl, token, PATHS.invoiceProfiles, {
      method: 'POST',
      body: payloads.invoiceCreate,
      insecureTls: options.insecureTls,
    });
    assertSuccess(invoiceCreate, 'create invoice profile');
    const invoiceProfile = unwrap(invoiceCreate.data, 'invoiceProfile');
    created.invoiceProfileId = invoiceProfile?.id;
    if (!created.invoiceProfileId) throw new Error('create invoice profile response missing id');
    steps.push(summarizeStep(PATHS.invoiceProfiles, 'POST', invoiceCreate.statusCode, created.invoiceProfileId));

    const invoiceUpdate = await requestJson(baseUrl, token, `${PATHS.invoiceProfiles}/${encodeURIComponent(created.invoiceProfileId)}`, {
      method: 'PATCH',
      body: payloads.invoiceUpdate,
      insecureTls: options.insecureTls,
    });
    assertSuccess(invoiceUpdate, 'update invoice profile');
    steps.push(summarizeStep(`${PATHS.invoiceProfiles}/:id`, 'PATCH', invoiceUpdate.statusCode, created.invoiceProfileId));

    const invoiceDefault = await requestJson(baseUrl, token, `${PATHS.invoiceProfiles}/${encodeURIComponent(created.invoiceProfileId)}/default`, {
      method: 'POST',
      insecureTls: options.insecureTls,
    });
    assertSuccess(invoiceDefault, 'default invoice profile');
    const defaultInvoiceProfile = unwrap(invoiceDefault.data, 'invoiceProfile');
    assertions.invoiceDefaultSelected = defaultInvoiceProfile?.id === created.invoiceProfileId && defaultInvoiceProfile?.isDefault === true;
    steps.push(summarizeStep(`${PATHS.invoiceProfiles}/:id/default`, 'POST', invoiceDefault.statusCode, created.invoiceProfileId));

    const checkoutAfterDefault = await requestJson(baseUrl, token, PATHS.checkoutData, { insecureTls: options.insecureTls });
    assertSuccess(checkoutAfterDefault, 'checkout-data after defaults');
    steps.push(summarizeStep(PATHS.checkoutData, 'GET', checkoutAfterDefault.statusCode));
    const deliveryInCheckout = findById(checkoutAfterDefault.data?.deliveryAddresses, created.deliveryAddressId);
    const invoiceInCheckout = findById(checkoutAfterDefault.data?.invoiceProfiles, created.invoiceProfileId);
    assertions.deliveryVisibleInCheckoutData = Boolean(deliveryInCheckout);
    assertions.invoiceVisibleInCheckoutData = Boolean(invoiceInCheckout);
    assertions.checkoutDeliveryDefaultSelected = checkoutAfterDefault.data?.defaults?.deliveryAddressId === created.deliveryAddressId;
    assertions.checkoutInvoiceDefaultSelected = checkoutAfterDefault.data?.defaults?.invoiceProfileId === created.invoiceProfileId;
  } finally {
    assertions.cleanup = await cleanupCreated(baseUrl, token, created, options.insecureTls, steps);
  }
  assertions.deletedRowsAbsentFromLists = await verifyDeleted(baseUrl, token, created, options.insecureTls, steps);

  const cleanupOk = assertions.cleanup.every((entry) => entry.ok && entry.successBody);
  const deleteVisibilityOk = Object.values(assertions.deletedRowsAbsentFromLists).every(Boolean);
  const ok = Boolean(
    assertions.schemaVersion &&
      assertions.deliveryDefaultSelected &&
      assertions.invoiceDefaultSelected &&
      assertions.deliveryVisibleInCheckoutData &&
      assertions.invoiceVisibleInCheckoutData &&
      assertions.checkoutDeliveryDefaultSelected &&
      assertions.checkoutInvoiceDefaultSelected &&
      cleanupOk &&
      deleteVisibilityOk,
  );

  return {
    ok,
    status: ok ? 'pass_authenticated_wallet_crud_default_delete_smoke' : 'fail_authenticated_wallet_assertions',
    baseUrl: baseUrl.origin,
    approvalIdPresent: Boolean(process.env.AUTH_WALLET_SMOKE_APPROVAL_ID),
    steps,
    assertions,
    sensitiveData: {
      sendsAuthorizationHeader: true,
      sendsCookies: false,
      sendsSyntheticRequestBodies: true,
      printsAuthorizationHeader: false,
      printsToken: false,
      printsCookies: false,
      printsRequestBody: false,
      printsResponseBody: false,
      readsDatabase: false,
      usesSyntheticWalletRowsOnly: true,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const missing = assertLiveGates(options);
  if (missing.length > 0) {
    console.log(JSON.stringify(
      {
        ok: true,
        status: 'approval_required_no_live_mutation',
        missing,
        baseUrl: normalizeBaseUrl(options.baseUrl).origin,
        wouldCall: [
          `GET ${PATHS.checkoutData}`,
          `POST ${PATHS.deliveryAddresses}`,
          `PATCH ${PATHS.deliveryAddresses}/:id`,
          `POST ${PATHS.deliveryAddresses}/:id/default`,
          `DELETE ${PATHS.deliveryAddresses}/:id`,
          `GET ${PATHS.deliveryAddresses}`,
          `POST ${PATHS.invoiceProfiles}`,
          `PATCH ${PATHS.invoiceProfiles}/:id`,
          `POST ${PATHS.invoiceProfiles}/:id/default`,
          `DELETE ${PATHS.invoiceProfiles}/:id`,
          `GET ${PATHS.invoiceProfiles}`,
        ],
        sensitiveData: {
          liveRequestSent: false,
          sendsAuthorizationHeader: false,
          sendsCookies: false,
          sendsRequestBody: false,
          printsToken: false,
          printsResponseBody: false,
          readsDatabase: false,
        },
      },
      null,
      2,
    ));
    return;
  }

  const result = await executeSmoke(options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify(
    {
      ok: false,
      status: 'authenticated_wallet_smoke_error',
      message: error.message,
      sensitiveData: {
        printsToken: false,
        printsResponseBody: false,
        readsDatabase: false,
      },
    },
    null,
    2,
  ));
  process.exitCode = 1;
});
