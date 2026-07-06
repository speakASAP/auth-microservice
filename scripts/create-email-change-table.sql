-- One-time verified email-change token schema for deployments with DB_SYNC=false.
-- Apply only after owner-approved database change window.

CREATE TABLE IF NOT EXISTS email_change_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  "oldEmail" VARCHAR(255),
  "newEmail" VARCHAR(255) NOT NULL,
  "returnUrl" TEXT,
  "expiresAt" TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_change_tokens_token
  ON email_change_tokens(token);

CREATE INDEX IF NOT EXISTS idx_email_change_tokens_user_id
  ON email_change_tokens("userId");

CREATE INDEX IF NOT EXISTS idx_email_change_tokens_new_email_active
  ON email_change_tokens(LOWER("newEmail"))
  WHERE used = false;
