#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sqlPath = path.join(root, 'scripts', 'create-email-change-table.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredFragments = [
  'CREATE TABLE IF NOT EXISTS email_change_tokens',
  'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
  '"userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
  'token VARCHAR(255) NOT NULL UNIQUE',
  '"oldEmail" VARCHAR(255)',
  '"newEmail" VARCHAR(255) NOT NULL',
  '"returnUrl" TEXT',
  '"expiresAt" TIMESTAMP NOT NULL',
  'used BOOLEAN NOT NULL DEFAULT false',
  '"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'CREATE INDEX IF NOT EXISTS idx_email_change_tokens_token',
  'CREATE INDEX IF NOT EXISTS idx_email_change_tokens_user_id',
  'CREATE INDEX IF NOT EXISTS idx_email_change_tokens_new_email_active',
  'WHERE used = false',
];

for (const fragment of requiredFragments) {
  assert(sql.includes(fragment), `Email-change SQL is missing required fragment: ${fragment}`);
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

assert(
  forbiddenLines.length === 0,
  `Email-change SQL contains forbidden mutating/destructive lines: ${forbiddenLines.map(({ number }) => number).join(', ')}`,
);

const metadataPreflightSql = [
  "SELECT to_regclass('public.users');",
  "SELECT to_regclass('public.email_change_tokens');",
  "SELECT to_regproc('gen_random_uuid');",
].join('\n');

const postApplyVerificationSql = [
  'SELECT table_name',
  'FROM information_schema.tables',
  "WHERE table_schema = 'public'",
  "AND table_name = 'email_change_tokens';",
  '',
  'SELECT table_name, column_name, data_type, is_nullable, column_default',
  'FROM information_schema.columns',
  "WHERE table_schema = 'public'",
  "AND table_name = 'email_change_tokens'",
  'ORDER BY ordinal_position;',
  '',
  'SELECT tablename, indexname, indexdef',
  'FROM pg_indexes',
  "WHERE schemaname = 'public'",
  "AND tablename = 'email_change_tokens'",
  'ORDER BY indexname;',
].join('\n');

const psqlBase = 'PGPASSWORD="$DB_PASSWORD" psql --host="$DB_HOST" --port="${DB_PORT:-5432}" --username="$DB_USER" --dbname="${DB_NAME:-auth}" --set=ON_ERROR_STOP=1';

console.log(JSON.stringify({
  ok: true,
  status: 'pass_auth_email_change_preflight_source_gate',
  sourceOnly: true,
  nonMutating: true,
  doesNotReadEnvironment: true,
  doesNotConnectToDatabase: true,
  printsSecrets: false,
  sqlFile: path.relative(root, sqlPath),
  sqlShape: {
    emailChangeTokenTable: true,
    userForeignKey: true,
    tokenUnique: true,
    newEmailRequired: true,
    returnUrlStored: true,
    expiryRequired: true,
    usedFlag: true,
    lookupIndexes: true,
    activeNewEmailIndex: true,
    forbiddenMutatingLines: 0,
  },
  approvalRequired: [
    'schema-only live DB preflight',
    'DB connection environment use without printing values',
    'live SQL apply',
    'Auth deploy',
    'post-deploy hosted profile static smoke',
    'bounded synthetic email-change request/confirm smoke',
  ],
  metadataPreflightSql,
  postApplyVerificationSql,
  applyCommandTemplate: `${psqlBase} --single-transaction --file=scripts/create-email-change-table.sql`,
}, null, 2));
