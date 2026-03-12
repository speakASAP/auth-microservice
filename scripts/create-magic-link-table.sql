-- Create magic_link_tokens table (run once when DB_SYNC=false, e.g. production).
-- Usage: psql -h <DB_HOST> -U <DB_USER> -d auth -f scripts/create-magic-link-table.sql

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  "returnUrl" TEXT NOT NULL,
  "clientId" VARCHAR(255),
  state TEXT,
  "expiresAt" TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token ON magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_user_id ON magic_link_tokens("userId");
