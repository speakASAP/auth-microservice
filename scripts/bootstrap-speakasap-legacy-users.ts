#!/usr/bin/env ts-node
/**
 * SpeakASAP legacy auth bootstrap.
 *
 * Dry-run is the default verified path. Apply mode exists but requires
 * explicit write confirmation and runs in a single transaction.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

config({ path: resolve(__dirname, '..', '.env') });

const { Client } = require('pg');

type Args = {
  dryRun: boolean;
  apply: boolean;
  confirmWrite: boolean;
  jsonReport: string;
  rollbackPlan: string;
  limit: number;
  passwordPolicy: string;
  approvalNote: string;
};

type SampleUser = {
  legacyUserId: number;
  maskedEmail: string;
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
};

type AuthEmailIndex = Map<string, string>;

type ApplyResult = {
  usersCreated: number;
  existingUsersMapped: number;
  mappingsUpserted: number;
  duplicateEmailUsersCreated: number;
  legacyPasswordHashesStored: number;
  skippedBlankEmail: number;
  skippedExistingMappings: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    apply: false,
    confirmWrite: false,
    jsonReport: '',
    rollbackPlan: '',
    limit: 25,
    passwordPolicy: 'legacy-pbkdf2-upgrade',
    approvalNote: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--confirm-write') {
      args.confirmWrite = true;
    } else if (arg === '--json-report') {
      args.jsonReport = argv[++i] || '';
    } else if (arg === '--rollback-plan') {
      args.rollbackPlan = argv[++i] || '';
    } else if (arg === '--limit') {
      args.limit = Number(argv[++i] || '25');
    } else if (arg === '--password-policy') {
      args.passwordPolicy = argv[++i] || '';
    } else if (arg === '--approval-note') {
      args.approvalNote = argv[++i] || '';
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(args.limit) || args.limit < 0) {
    throw new Error('--limit must be a non-negative number');
  }
  return args;
}

function printHelp(): void {
  console.log(`Usage:
  npx ts-node scripts/bootstrap-speakasap-legacy-users.ts --dry-run [--json-report /tmp/report.json] [--limit 25]
  npx ts-node scripts/bootstrap-speakasap-legacy-users.ts --apply --confirm-write --approval-note "owner approval ..." --json-report /tmp/report.json --rollback-plan /tmp/rollback.sql

Environment:
  SPEAKASAP_LEGACY_DATABASE_URL or SOURCE_DATABASE_URL  legacy speakasap-portal Postgres
  AUTH_DATABASE_URL or DATABASE_URL or DB_*             auth-microservice Postgres

Policy:
  --password-policy legacy-pbkdf2-upgrade              store legacy Django hashes in mapping table and upgrade on first login

Safety:
  apply requires --confirm-write and --approval-note.`);
}

function authDbConfig(): Record<string, unknown> {
  const url = process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL;
  if (url) {
    return { connectionString: url };
  }
  return {
    host: process.env.DB_HOST || 'db-server-postgres',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'dbadmin',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'auth',
  };
}

function legacyDbConfig(): Record<string, unknown> {
  const url = process.env.SPEAKASAP_LEGACY_DATABASE_URL || process.env.SOURCE_DATABASE_URL;
  if (!url) {
    throw new Error('Missing SPEAKASAP_LEGACY_DATABASE_URL or SOURCE_DATABASE_URL');
  }
  return { connectionString: url };
}

function toNumber(value: unknown): number {
  return Number(value || 0);
}

function maskEmail(value: string): string {
  const email = String(value || '').trim();
  const at = email.indexOf('@');
  if (at <= 0) {
    return email ? '[invalid-email]' : '';
  }
  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = name.length <= 2 ? name[0] : `${name[0]}${name[name.length - 1]}`;
  return `${visible || '*'}***@${domain}`;
}

function sampleRow(row: any): SampleUser {
  return {
    legacyUserId: Number(row.id),
    maskedEmail: maskEmail(row.email),
    isActive: Boolean(row.is_active),
    isStaff: Boolean(row.is_staff),
    isSuperuser: Boolean(row.is_superuser),
  };
}

function normalizedEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function userTypeFor(row: any): string {
  if (row.is_superuser) {
    return 'admin';
  }
  if (row.is_staff) {
    return 'staff';
  }
  return 'end_user';
}

function sourceSnapshot(row: any): Record<string, unknown> {
  return {
    legacyUserId: Number(row.id),
    maskedEmail: maskEmail(row.email),
    isActive: Boolean(row.is_active),
    isStaff: Boolean(row.is_staff),
    isSuperuser: Boolean(row.is_superuser),
    hasLastLogin: Boolean(row.last_login),
    language: row.language || null,
    country: row.country || null,
  };
}

async function one(client: any, sql: string, params: unknown[] = []): Promise<any> {
  const result = await client.query(sql, params);
  return result.rows[0] || {};
}

async function targetEmailIndex(auth: any): Promise<AuthEmailIndex> {
  const rows = await many(
    auth,
    "SELECT id::text, lower(trim(email)) AS email FROM users WHERE email IS NOT NULL AND length(trim(email)) > 0",
  );
  const index: AuthEmailIndex = new Map();
  for (const row of rows) {
    if (row.email) {
      index.set(row.email, row.id);
    }
  }
  return index;
}

async function duplicateLegacyEmails(legacy: any): Promise<Set<string>> {
  const rows = await many(
    legacy,
    `
      SELECT lower(trim(email)) AS email
      FROM auth_user
      WHERE email IS NOT NULL AND length(trim(email)) > 0
      GROUP BY lower(trim(email))
      HAVING COUNT(*) > 1
    `,
  );
  return new Set(rows.map((row) => row.email).filter(Boolean));
}

async function existingLegacyMappingIds(auth: any): Promise<Set<number>> {
  const rows = await many(
    auth,
    `
      SELECT "legacyUserId"::int AS legacy_user_id
      FROM legacy_identity_mappings
      WHERE "legacySystem" = 'speakasap-portal'
    `,
  );
  return new Set(rows.map((row) => Number(row.legacy_user_id)));
}

async function ensureMappingSchema(auth: any): Promise<void> {
  await auth.query(`
    CREATE TABLE IF NOT EXISTS legacy_identity_mappings (
      -- DEFAULT is required, not decorative: this script supplies its own ids, but the
      -- application does not. TypeORM's @PrimaryGeneratedColumn('uuid') emits
      -- INSERT ... VALUES (DEFAULT, ...) and relies on the database to fill it, so a
      -- column without a default fails every app-level insert with
      -- 'null value in column "id" violates not-null constraint'. That broke the SSO
      -- handoff for every student who had no mapping yet (2026-08-10). Every other uuid
      -- primary key in this database carries the same default.
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "legacySystem" varchar NOT NULL,
      "legacyUserId" integer NOT NULL,
      "authUserId" uuid NULL REFERENCES users(id) ON DELETE RESTRICT,
      "normalizedEmail" varchar NULL,
      status varchar(80) NOT NULL,
      reason text NULL,
      "legacyPasswordHash" text NULL,
      "legacyPasswordMigratedAt" timestamp NULL,
      "sourceSnapshot" jsonb NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `);
  // Existing installs created the table before the default above existed.
  await auth.query(`
    ALTER TABLE legacy_identity_mappings
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()
  `);
  await auth.query(`
    ALTER TABLE legacy_identity_mappings
    ADD COLUMN IF NOT EXISTS "legacyPasswordHash" text NULL
  `);
  await auth.query(`
    ALTER TABLE legacy_identity_mappings
    ADD COLUMN IF NOT EXISTS "legacyPasswordMigratedAt" timestamp NULL
  `);
  await auth.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS legacy_identity_mappings_legacy_system_user_id_key
    ON legacy_identity_mappings ("legacySystem", "legacyUserId")
  `);
  await auth.query(`
    CREATE INDEX IF NOT EXISTS legacy_identity_mappings_auth_user_id_idx
    ON legacy_identity_mappings ("authUserId")
  `);
  await auth.query(`
    CREATE INDEX IF NOT EXISTS legacy_identity_mappings_legacy_system_email_idx
    ON legacy_identity_mappings ("legacySystem", "normalizedEmail")
  `);
}

async function upsertMapping(
  auth: any,
  values: {
    legacyUserId: number;
    authUserId: string | null;
    normalizedEmailValue: string | null;
    status: string;
    reason: string | null;
    legacyPasswordHash: string | null;
    snapshot: Record<string, unknown>;
  },
): Promise<void> {
  await auth.query(
    `
      INSERT INTO legacy_identity_mappings (
        id, "legacySystem", "legacyUserId", "authUserId", "normalizedEmail",
        status, reason, "legacyPasswordHash", "legacyPasswordMigratedAt", "sourceSnapshot", "createdAt", "updatedAt"
      ) VALUES ($1, 'speakasap-portal', $2, $3::uuid, $4, $5, $6, $7, NULL, $8::jsonb, now(), now())
      ON CONFLICT ("legacySystem", "legacyUserId") DO UPDATE SET
        "authUserId" = EXCLUDED."authUserId",
        "normalizedEmail" = EXCLUDED."normalizedEmail",
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        "legacyPasswordHash" = CASE
          WHEN legacy_identity_mappings."legacyPasswordMigratedAt" IS NULL THEN EXCLUDED."legacyPasswordHash"
          ELSE legacy_identity_mappings."legacyPasswordHash"
        END,
        "legacyPasswordMigratedAt" = legacy_identity_mappings."legacyPasswordMigratedAt",
        "sourceSnapshot" = EXCLUDED."sourceSnapshot",
        "updatedAt" = now()
    `,
    [
      randomUUID(),
      values.legacyUserId,
      values.authUserId,
      values.normalizedEmailValue,
      values.status,
      values.reason,
      values.legacyPasswordHash,
      JSON.stringify(values.snapshot),
    ],
  );
}

async function applyBootstrap(legacy: any, auth: any): Promise<ApplyResult> {
  const emailIndex = await targetEmailIndex(auth);
  const duplicateEmails = await duplicateLegacyEmails(legacy);
  const result: ApplyResult = {
    usersCreated: 0,
    existingUsersMapped: 0,
    mappingsUpserted: 0,
    duplicateEmailUsersCreated: 0,
    legacyPasswordHashesStored: 0,
    skippedBlankEmail: 0,
    skippedExistingMappings: 0,
  };

  await auth.query('BEGIN');
  try {
    await ensureMappingSchema(auth);
    const existingMappingIds = await existingLegacyMappingIds(auth);
    const sourceRows = await many(
      legacy,
      `
        SELECT
          id, email, first_name, last_name, phone, language, country,
          password, is_active, is_staff, is_superuser, last_login
        FROM auth_user
        ORDER BY id
      `,
    );

    for (const row of sourceRows) {
      const legacyUserId = Number(row.id);
      if (existingMappingIds.has(legacyUserId)) {
        result.skippedExistingMappings += 1;
        continue;
      }
      const email = normalizedEmail(row.email);
      const snapshot = sourceSnapshot(row);

      if (!email) {
        await upsertMapping(auth, {
          legacyUserId,
          authUserId: null,
          normalizedEmailValue: null,
          status: 'skipped_blank_email',
          reason: 'Legacy auth_user row has no email.',
          legacyPasswordHash: row.password || null,
          snapshot,
        });
        if (row.password) {
          result.legacyPasswordHashesStored += 1;
        }
        result.skippedBlankEmail += 1;
        result.mappingsUpserted += 1;
        continue;
      }

      const isDuplicateEmail = duplicateEmails.has(email);
      let authUserId = isDuplicateEmail ? '' : emailIndex.get(email) || '';
      let status = 'mapped';
      let reason = 'Mapped to existing auth user by normalized email.';
      if (authUserId) {
        result.existingUsersMapped += 1;
      } else {
        authUserId = randomUUID();
        await auth.query(
          `
            INSERT INTO users (
              id, email, password, "firstName", "lastName", phone, source,
              "isActive", "isVerified", "userType", "createdAt", "updatedAt"
            ) VALUES ($1::uuid, $2, NULL, $3, $4, $5, 'speakasap-portal', $6, false, $7, now(), now())
          `,
          [
            authUserId,
            isDuplicateEmail ? null : email,
            row.first_name || null,
            row.last_name || null,
            row.phone || null,
            Boolean(row.is_active),
            userTypeFor(row),
          ],
        );
        if (isDuplicateEmail) {
          status = 'created_duplicate_email';
          reason = 'Created with null primary email because the legacy email is shared by multiple legacy users; login resolves through legacy identity mapping.';
          result.duplicateEmailUsersCreated += 1;
        } else {
          emailIndex.set(email, authUserId);
          status = 'created';
          reason = 'Created by SpeakASAP legacy bootstrap with Django PBKDF2 password-continuity policy.';
        }
        result.usersCreated += 1;
      }

      await upsertMapping(auth, {
        legacyUserId,
        authUserId,
        normalizedEmailValue: email,
        status,
        reason,
        legacyPasswordHash: row.password || null,
        snapshot,
      });
      if (row.password) {
        result.legacyPasswordHashesStored += 1;
      }
      result.mappingsUpserted += 1;
    }

    await auth.query('COMMIT');
    return result;
  } catch (error) {
    await auth.query('ROLLBACK');
    throw error;
  }
}

function rollbackPlanSql(): string {
  return `-- Rollback for approved SpeakASAP auth bootstrap.
-- Review counts before running. This removes mappings and only auth users
-- created by this bootstrap, preserving pre-existing target auth users.
BEGIN;

DELETE FROM users u
USING legacy_identity_mappings m
WHERE m."legacySystem" = 'speakasap-portal'
  AND m.status IN ('created', 'created_duplicate_email')
  AND m."authUserId" = u.id
  AND u.source = 'speakasap-portal';

DELETE FROM legacy_identity_mappings
WHERE "legacySystem" = 'speakasap-portal';

COMMIT;
`;
}

async function many(client: any, sql: string, params: unknown[] = []): Promise<any[]> {
  const result = await client.query(sql, params);
  return result.rows;
}

async function passwordKindCounts(legacy: any): Promise<Record<string, number>> {
  const result = await legacy.query('SELECT password FROM auth_user');
  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    const password = String(row.password || '');
    let kind = 'other';
    if (password.startsWith('$2')) {
      kind = 'bcrypt';
    } else if (password.startsWith('pbkdf2_sha256$')) {
      kind = 'django_pbkdf2_sha256';
    } else if (password.startsWith('md5$')) {
      kind = 'django_unsalted_md5';
    } else if (password.startsWith('!')) {
      kind = 'django_unusable_password';
    } else if (!password.trim()) {
      kind = 'empty';
    }
    counts[kind] = (counts[kind] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

async function targetEmails(auth: any): Promise<string[]> {
  const rows = await many(
    auth,
    "SELECT lower(trim(email)) AS email FROM users WHERE email IS NOT NULL AND length(trim(email)) > 0",
  );
  return rows.map((row) => row.email).filter(Boolean);
}

async function buildReport(
  legacy: any,
  auth: any,
  args: Args,
  applyResult?: ApplyResult,
): Promise<Record<string, unknown>> {
  const emailList = await targetEmails(auth);
  const sampleLimit = args.limit;

  const legacyTotals = await one(
    legacy,
    `
      SELECT
        COUNT(*)::int AS users,
        COUNT(*) FILTER (WHERE is_active)::int AS active_users,
        COUNT(*) FILTER (WHERE is_staff)::int AS staff_users,
        COUNT(*) FILTER (WHERE is_superuser)::int AS superuser_users,
        COUNT(*) FILTER (WHERE last_login IS NOT NULL)::int AS users_with_last_login,
        COUNT(*) FILTER (WHERE email IS NOT NULL AND length(trim(email)) > 0)::int AS users_with_email
      FROM auth_user
    `,
  );

  const emailQuality = await one(
    legacy,
    `
      WITH d AS (
        SELECT lower(trim(email)) AS email, COUNT(*)::int AS n
        FROM auth_user
        WHERE email IS NOT NULL AND length(trim(email)) > 0
        GROUP BY lower(trim(email))
        HAVING COUNT(*) > 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM auth_user WHERE email IS NULL OR length(trim(email)) = 0) AS blank_email_users,
        COUNT(*)::int AS duplicate_email_groups,
        COALESCE(SUM(n), 0)::int AS rows_in_duplicate_groups,
        COALESCE(MAX(n), 0)::int AS max_duplicate_group_size
      FROM d
    `,
  );

  const duplicateProfileRefs = await one(
    legacy,
    `
      WITH d AS (
        SELECT lower(trim(email)) AS email
        FROM auth_user
        WHERE email IS NOT NULL AND length(trim(email)) > 0
        GROUP BY lower(trim(email))
        HAVING COUNT(*) > 1
      ), du AS (
        SELECT u.id
        FROM auth_user u
        JOIN d ON lower(trim(u.email)) = d.email
      )
      SELECT
        COUNT(DISTINCT s.user_id)::int AS student_user_refs,
        COUNT(DISTINCT t.user_id)::int AS teacher_user_refs,
        COUNT(DISTINCT m.user_id)::int AS manager_user_refs,
        COUNT(DISTINCT e.user_id)::int AS employee_profile_user_refs
      FROM du
      LEFT JOIN students_student s ON s.user_id = du.id
      LEFT JOIN employees_teacher t ON t.user_id = du.id
      LEFT JOIN employees_manager m ON m.user_id = du.id
      LEFT JOIN employees_employeeprofile e ON e.user_id = du.id
    `,
  );

  const targetTotals = await one(
    auth,
    `
      SELECT
        COUNT(*)::int AS users,
        COUNT(email)::int AS users_with_email,
        COUNT(password)::int AS users_with_password
      FROM users
    `,
  );

  const targetDuplicateEmails = await one(
    auth,
    `
      SELECT COUNT(*)::int AS duplicate_email_groups
      FROM (
        SELECT lower(trim(email)) AS email
        FROM users
        WHERE email IS NOT NULL AND length(trim(email)) > 0
        GROUP BY lower(trim(email))
        HAVING COUNT(*) > 1
      ) d
    `,
  );

  const decisionCounts = await one(
    legacy,
    `
      WITH normalized AS (
        SELECT id, lower(trim(email)) AS email
        FROM auth_user
        WHERE email IS NOT NULL AND length(trim(email)) > 0
      ), duplicate_emails AS (
        SELECT email
        FROM normalized
        GROUP BY email
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*) FILTER (WHERE d.email IS NULL AND n.email = ANY($1))::int AS existing_target_email_matches,
        COUNT(*) FILTER (WHERE d.email IS NULL AND NOT (n.email = ANY($1)))::int AS create_candidates,
        COUNT(*) FILTER (WHERE d.email IS NOT NULL)::int AS duplicate_email_candidates,
        (SELECT COUNT(*)::int FROM auth_user WHERE email IS NULL OR length(trim(email)) = 0) AS blank_email_skips
      FROM normalized n
      LEFT JOIN duplicate_emails d ON d.email = n.email
    `,
    [emailList],
  );

  const existingTargetMatchSamples = await many(
    legacy,
    `
      SELECT id, email, is_active, is_staff, is_superuser
      FROM auth_user
      WHERE email IS NOT NULL
        AND length(trim(email)) > 0
        AND lower(trim(email)) = ANY($1)
        AND lower(trim(email)) NOT IN (
          SELECT lower(trim(email))
          FROM auth_user
          WHERE email IS NOT NULL AND length(trim(email)) > 0
          GROUP BY lower(trim(email))
          HAVING COUNT(*) > 1
        )
      ORDER BY id
      LIMIT $2
    `,
    [emailList, sampleLimit],
  );

  const createCandidateSamples = await many(
    legacy,
    `
      WITH normalized AS (
        SELECT id, email, lower(trim(email)) AS normalized_email, is_active, is_staff, is_superuser
        FROM auth_user
        WHERE email IS NOT NULL AND length(trim(email)) > 0
      ), duplicate_emails AS (
        SELECT normalized_email
        FROM normalized
        GROUP BY normalized_email
        HAVING COUNT(*) > 1
      )
      SELECT n.id, n.email, n.is_active, n.is_staff, n.is_superuser
      FROM normalized n
      LEFT JOIN duplicate_emails d ON d.normalized_email = n.normalized_email
      WHERE d.normalized_email IS NULL
        AND NOT (n.normalized_email = ANY($1))
      ORDER BY n.id
      LIMIT $2
    `,
    [emailList, sampleLimit],
  );

  const duplicateCandidateSamples = await many(
    legacy,
    `
      WITH duplicate_emails AS (
        SELECT lower(trim(email)) AS normalized_email
        FROM auth_user
        WHERE email IS NOT NULL AND length(trim(email)) > 0
        GROUP BY lower(trim(email))
        HAVING COUNT(*) > 1
      )
      SELECT u.id, u.email, u.is_active, u.is_staff, u.is_superuser
      FROM auth_user u
      JOIN duplicate_emails d ON lower(trim(u.email)) = d.normalized_email
      ORDER BY lower(trim(u.email)), u.id
      LIMIT $1
    `,
    [sampleLimit],
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    writes: Boolean(args.apply),
    passwordPolicy: args.passwordPolicy,
    approvalNote: args.approvalNote || null,
    sampleLimit,
    source: {
      legacySystem: 'speakasap-portal',
      authUser: {
        users: toNumber(legacyTotals.users),
        activeUsers: toNumber(legacyTotals.active_users),
        staffUsers: toNumber(legacyTotals.staff_users),
        superuserUsers: toNumber(legacyTotals.superuser_users),
        usersWithLastLogin: toNumber(legacyTotals.users_with_last_login),
        usersWithEmail: toNumber(legacyTotals.users_with_email),
      },
      emailQuality: {
        blankEmailUsers: toNumber(emailQuality.blank_email_users),
        duplicateEmailGroups: toNumber(emailQuality.duplicate_email_groups),
        rowsInDuplicateGroups: toNumber(emailQuality.rows_in_duplicate_groups),
        maxDuplicateGroupSize: toNumber(emailQuality.max_duplicate_group_size),
      },
      duplicateProfileRefs: {
        studentUserRefs: toNumber(duplicateProfileRefs.student_user_refs),
        teacherUserRefs: toNumber(duplicateProfileRefs.teacher_user_refs),
        managerUserRefs: toNumber(duplicateProfileRefs.manager_user_refs),
        employeeProfileUserRefs: toNumber(duplicateProfileRefs.employee_profile_user_refs),
      },
      passwordKindCounts: await passwordKindCounts(legacy),
    },
    target: {
      users: toNumber(targetTotals.users),
      usersWithEmail: toNumber(targetTotals.users_with_email),
      usersWithPassword: toNumber(targetTotals.users_with_password),
      duplicateEmailGroups: toNumber(targetDuplicateEmails.duplicate_email_groups),
      indexedEmails: emailList.length,
    },
    decisions: {
      existingTargetEmailMatches: toNumber(decisionCounts.existing_target_email_matches),
      createCandidates: toNumber(decisionCounts.create_candidates),
      duplicateEmailCandidates: toNumber(decisionCounts.duplicate_email_candidates),
      blankEmailSkips: toNumber(decisionCounts.blank_email_skips),
      plannedUserWrites: toNumber(decisionCounts.create_candidates) + toNumber(decisionCounts.duplicate_email_candidates),
      plannedDuplicateEmailUserWrites: toNumber(decisionCounts.duplicate_email_candidates),
      plannedMappingWrites: (
        toNumber(decisionCounts.existing_target_email_matches)
        + toNumber(decisionCounts.create_candidates)
        + toNumber(decisionCounts.duplicate_email_candidates)
        + toNumber(decisionCounts.blank_email_skips)
      ),
      actualWrites: applyResult || {
        usersCreated: 0,
        existingUsersMapped: 0,
        mappingsUpserted: 0,
        duplicateEmailUsersCreated: 0,
        legacyPasswordHashesStored: 0,
        skippedBlankEmail: 0,
        skippedExistingMappings: 0,
      },
      samples: {
        existingTargetEmailMatches: existingTargetMatchSamples.map(sampleRow),
        createCandidates: createCandidateSamples.map(sampleRow),
        duplicateEmailCandidates: duplicateCandidateSamples.map(sampleRow),
      },
    },
    notes: [
      args.apply
        ? 'Apply mode executed in one transaction with Django PBKDF2 password-continuity policy.'
        : 'Read-only report; no auth users or mapping rows were written.',
      'Password hashes are classified by family only and are never printed.',
      'Duplicate legacy-email rows are created with null primary email and resolved through legacy_identity_mappings during first login.',
    ],
  };
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    printHelp();
    return 2;
  }

  if (args.apply && args.dryRun) {
    console.error('Use either --dry-run or --apply, not both.');
    return 2;
  }
  if (!args.dryRun && !args.apply) {
    console.error('Refusing to run without --dry-run or --apply.');
    return 2;
  }
  if (args.apply && !args.confirmWrite) {
    console.error('--apply requires --confirm-write.');
    return 2;
  }
  if (args.apply && !args.approvalNote.trim()) {
    console.error('--apply requires --approval-note with the owner approval reference.');
    return 2;
  }
  if (args.passwordPolicy !== 'legacy-pbkdf2-upgrade') {
    console.error('Only --password-policy legacy-pbkdf2-upgrade is supported in this version.');
    return 2;
  }

  const legacy = new Client(legacyDbConfig());
  const auth = new Client(authDbConfig());
  await legacy.connect();
  await auth.connect();
  try {
    let applyResult: ApplyResult | undefined;
    if (args.apply) {
      applyResult = await applyBootstrap(legacy, auth);
    }
    const report = await buildReport(legacy, auth, args, applyResult);
    const source = report.source as any;
    const target = report.target as any;
    const decisions = report.decisions as any;
    console.log(`mode=${report.mode} writes=${report.writes} passwordPolicy=${report.passwordPolicy}`);
    console.log(`legacyUsers=${source.authUser.users} targetUsers=${target.users}`);
    console.log(`duplicateEmailGroups=${source.emailQuality.duplicateEmailGroups} duplicateEmailRows=${source.emailQuality.rowsInDuplicateGroups}`);
    console.log(`existingTargetEmailMatches=${decisions.existingTargetEmailMatches} createCandidates=${decisions.createCandidates} duplicateEmailCandidates=${decisions.duplicateEmailCandidates}`);
    console.log(`plannedUserWrites=${decisions.plannedUserWrites} plannedMappingWrites=${decisions.plannedMappingWrites}`);
    if (args.apply) {
      console.log(`actualWrites=${JSON.stringify(decisions.actualWrites)}`);
    }
    if (args.rollbackPlan) {
      writeFileSync(args.rollbackPlan, rollbackPlanSql(), 'utf8');
      console.log(`rollbackPlan=${args.rollbackPlan}`);
    }
    if (args.jsonReport) {
      writeFileSync(args.jsonReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.log(`jsonReport=${args.jsonReport}`);
    }
  } finally {
    await auth.end();
    await legacy.end();
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error((error as Error).message);
    process.exit(1);
  });
