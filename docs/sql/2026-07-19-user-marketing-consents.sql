-- Marketing consent, immutable audit trail. Additive only.
-- Apply manually; auth-microservice runs with DB_SYNC=false and has no migration runner.
CREATE TABLE IF NOT EXISTS user_marketing_consents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product           varchar(50) NOT NULL,
  "documentVersion" varchar(100) NOT NULL,
  "grantedAt"       timestamp NOT NULL DEFAULT now(),
  "revokedAt"       timestamp NULL,
  ip                varchar(100) NULL,
  "userAgent"       text NULL,
  "createdAt"       timestamp NOT NULL DEFAULT now(),
  "updatedAt"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_umc_user_product_revoked
  ON user_marketing_consents ("userId", product, "revokedAt");
