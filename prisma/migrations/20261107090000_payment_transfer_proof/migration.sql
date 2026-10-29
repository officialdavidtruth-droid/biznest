-- Proof-of-transfer screenshots for bank-transfer payments that have no Order row
-- (invoices, quote deposits, service bookings, PMS deposits). Idempotent.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "proofUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "proofAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "proofNote" TEXT;
