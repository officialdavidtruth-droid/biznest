-- Churn watch: last-login tracking + per-store warning-sign rows.
-- Idempotent (IF NOT EXISTS / duplicate_object guards) because earlier
-- migrations in this repo were applied out-of-band via `db push`.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
-- Start the "no login" clock at deploy for existing platform accounts so the
-- first sweep doesn't flag every store as dormant. Real sign-ins overwrite it.
UPDATE "User" SET "lastLoginAt" = CURRENT_TIMESTAMP
  WHERE "lastLoginAt" IS NULL AND "customerScopeStoreId" IS NULL;

DO $$ BEGIN
  CREATE TYPE "ChurnSignalKind" AS ENUM ('NO_LOGIN', 'NO_ORDERS', 'PAYMENT_FAILED', 'UNUSED_PLUGIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChurnSignal" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "kind" "ChurnSignalKind" NOT NULL,
  "subject" TEXT NOT NULL DEFAULT '',
  "detail" TEXT,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ChurnSignal_pkey" PRIMARY KEY ("id")
);

-- One OPEN signal per store/kind/subject; resolved rows are history and may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS "ChurnSignal_one_open_per_subject"
  ON "ChurnSignal"("storeId", "kind", "subject") WHERE "resolvedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "ChurnSignal_storeId_resolvedAt_idx" ON "ChurnSignal"("storeId", "resolvedAt");
CREATE INDEX IF NOT EXISTS "ChurnSignal_resolvedAt_kind_idx" ON "ChurnSignal"("resolvedAt", "kind");

DO $$ BEGIN
  ALTER TABLE "ChurnSignal"
    ADD CONSTRAINT "ChurnSignal_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
