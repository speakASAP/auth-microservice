#!/usr/bin/env node
const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
  }
}

const seed = read('scripts/seed-rbac.ts');
const helper = read('scripts/provision-internal-service-token.ts');

assert(seed.includes("name: 'action-admin'"), 'RBAC seed must define internal action-admin role');
assert(seed.includes('RoleScope.INTERNAL'), 'RBAC seed must keep action-admin as an internal role');
assert(seed.includes('orders-microservice'), 'RBAC seed must register orders-microservice as an internal application');
assert(helper.includes('--role=internal:<service>:<role>'), 'token helper must remain generic for internal service roles');
assert(helper.includes('tokenPrinted: false'), 'token helper must report tokenPrinted=false in apply mode');
assert(helper.includes('writeFileSync(resolvedOutputPath'), 'token helper must write token to a file instead of printing it');

console.log(JSON.stringify({
  ok: true,
  verifier: 'orders-action-admin-rbac-seed.v1',
  role: 'internal:orders-microservice:action-admin',
  runtimeMutation: false,
  sensitiveOutput: 'redacted-source-only',
}, null, 2));
