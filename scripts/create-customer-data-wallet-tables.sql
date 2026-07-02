-- One-time Auth customer data wallet schema for deployments with DB_SYNC=false.
-- Apply only after owner-approved database change window.

CREATE TABLE IF NOT EXISTS user_delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(120),
  "firstName" VARCHAR(100),
  "lastName" VARCHAR(100),
  company VARCHAR(160),
  street VARCHAR(255),
  street2 VARCHAR(255),
  city VARCHAR(120),
  region VARCHAR(120),
  "postalCode" VARCHAR(20),
  country VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(180),
  "deliveryInstructions" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sourceApplication" VARCHAR(80),
  "lastUsedAt" TIMESTAMP,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_delivery_addresses_user
  ON user_delivery_addresses("userId");

CREATE INDEX IF NOT EXISTS idx_user_delivery_addresses_user_active
  ON user_delivery_addresses("userId", "deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_delivery_addresses_one_default
  ON user_delivery_addresses("userId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;

CREATE TABLE IF NOT EXISTS user_invoice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(120),
  type VARCHAR(30) NOT NULL DEFAULT 'person',
  "firstName" VARCHAR(100),
  "lastName" VARCHAR(100),
  "companyName" VARCHAR(180),
  "companyId" VARCHAR(80),
  "taxId" VARCHAR(80),
  "vatId" VARCHAR(80),
  street VARCHAR(255),
  street2 VARCHAR(255),
  city VARCHAR(120),
  region VARCHAR(120),
  "postalCode" VARCHAR(20),
  country VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(180),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sourceApplication" VARCHAR(80),
  "lastUsedAt" TIMESTAMP,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invoice_profiles_user
  ON user_invoice_profiles("userId");

CREATE INDEX IF NOT EXISTS idx_user_invoice_profiles_user_active
  ON user_invoice_profiles("userId", "deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invoice_profiles_one_default
  ON user_invoice_profiles("userId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;
