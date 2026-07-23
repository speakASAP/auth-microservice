-- Password recovery after one-time-code login. Additive only.
-- Apply manually; auth-microservice runs with DB_SYNC=false and has no migration runner.
-- Usage: psql -h <DB_HOST> -U <DB_USER> -d auth -f docs/sql/2026-07-23-password-recovery-columns.sql

-- Distinguishes a passwordless sign-in code from a recovery code. Existing rows are logins,
-- so the default keeps their meaning and lets this run while the old build is still serving.
ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'login';

-- Lets a reset grant remember where the user was going, server-side, so the completion target
-- cannot be tampered with between the email and the confirm call.
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS "returnUrl" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "clientId" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS state TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_purpose
  ON magic_link_tokens(purpose);
