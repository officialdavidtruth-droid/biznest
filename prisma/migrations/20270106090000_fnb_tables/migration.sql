-- Restaurant tables, each with its own QR token.
CREATE TABLE IF NOT EXISTS "FnbTable" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "seats" INTEGER,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FnbTable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FnbTable_token_key" ON "FnbTable"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "FnbTable_storeId_name_key" ON "FnbTable"("storeId", "name");
CREATE INDEX IF NOT EXISTS "FnbTable_storeId_active_idx" ON "FnbTable"("storeId", "active");
ALTER TABLE "FnbTable" ADD CONSTRAINT "FnbTable_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
