#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sqlPath = path.join(root, 'scripts', 'create-customer-data-wallet-tables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredFragments = [
  'CREATE TABLE IF NOT EXISTS user_delivery_addresses',
  'CREATE TABLE IF NOT EXISTS user_invoice_profiles',
  '"userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
  'DEFAULT gen_random_uuid()',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_delivery_addresses_one_default',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invoice_profiles_one_default',
  'WHERE "isDefault" = true AND "deletedAt" IS NULL',
];

for (const fragment of requiredFragments) {
  assert(sql.includes(fragment), `Wallet SQL is missing required fragment: ${fragment}`);
}

const forbiddenLinePatterns = [
  /^\s*INSERT\s+INTO\b/i,
  /^\s*UPDATE\s+\S+\s+SET\b/i,
  /^\s*DELETE\s+FROM\b/i,
  /^\s*DROP\b/i,
  /^\s*TRUNCATE\b/i,
  /^\s*ALTER\s+TABLE\s+.*\bDROP\b/i,
  /^\s*COPY\s+/i,
];

const forbiddenLines = sql
  .split(/\r?\n/)
  .map((line, index) => ({ line, number: index + 1 }))
  .filter(({ line }) => forbiddenLinePatterns.some((pattern) => pattern.test(line)));

assert(forbiddenLines.length === 0, `Wallet SQL contains forbidden mutating/destructive lines: ${forbiddenLines.map(({ number }) => number).join(', ')}`);

const metadataPreflightSql = [
  "SELECT to_regclass('public.users');",
  "SELECT to_regclass('public.user_delivery_addresses');",
  "SELECT to_regclass('public.user_invoice_profiles');",
  "SELECT to_regproc('gen_random_uuid');",
].join('\n');

const postApplyVerificationSql = [
  'SELECT table_name',
  'FROM information_schema.tables',
  "WHERE table_schema = 'public'",
  "AND table_name IN ('user_delivery_addresses', 'user_invoice_profiles');",
  '',
  'SELECT table_name, column_name, data_type, is_nullable, column_default',
  'FROM information_schema.columns',
  "WHERE table_schema = 'public'",
  "AND table_name IN ('user_delivery_addresses', 'user_invoice_profiles')",
  'ORDER BY table_name, ordinal_position;',
  '',
  'SELECT tablename, indexname, indexdef',
  'FROM pg_indexes',
  "WHERE schemaname = 'public'",
  "AND tablename IN ('user_delivery_addresses', 'user_invoice_profiles')",
  'ORDER BY tablename, indexname;',
].join('\n');

const psqlBase = 'PGPASSWORD="$DB_PASSWORD" psql --host="$DB_HOST" --port="${DB_PORT:-5432}" --username="$DB_USER" --dbname="${DB_NAME:-auth}" --set=ON_ERROR_STOP=1';

console.log(JSON.stringify({
  ok: true,
  nonMutating: true,
  doesNotReadEnvironment: true,
  doesNotConnectToDatabase: true,
  sqlFile: path.relative(root, sqlPath),
  sqlShape: {
    deliveryAddressTable: true,
    invoiceProfileTable: true,
    userForeignKeys: true,
    genRandomUuidDefault: true,
    oneDefaultPerUserIndexes: true,
    forbiddenMutatingLines: 0,
  },
  approvalRequired: [
    'schema-only live DB preflight',
    'DB connection environment use without printing values',
    'live SQL apply',
    'Auth deploy',
    'post-deploy wallet endpoint smoke',
  ],
  metadataPreflightSql,
  postApplyVerificationSql,
  applyCommandTemplate: `${psqlBase} --single-transaction --file=scripts/create-customer-data-wallet-tables.sql`,
}, null, 2));
