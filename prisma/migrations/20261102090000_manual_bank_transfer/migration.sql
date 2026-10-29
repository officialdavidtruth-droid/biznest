-- Manual bank-transfer payments. Idempotent because earlier migrations in this
-- repo were applied out-of-band via `db push`.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "manualPayEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "manualBankName" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "manualAccountName" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "manualAccountNumber" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "manualPayNote" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProofAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProofNote" TEXT;
