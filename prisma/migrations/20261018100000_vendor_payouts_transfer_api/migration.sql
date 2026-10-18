-- Vendor payouts via the gateway Transfer API (replaces subaccount splits).
-- Additive only: existing subaccount columns are left in place until the
-- final cleanup step so in-flight split payments and refunds keep working.

ALTER TABLE "Store" ADD COLUMN "paystackRecipientCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "payoutBankCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "payoutAccountNumber" TEXT;

CREATE TYPE "PayoutStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED');

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'QUEUED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "reference" TEXT NOT NULL,
    "gatewayTransferId" TEXT,
    "destination" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payout_paymentId_key" ON "Payout"("paymentId");
CREATE UNIQUE INDEX "Payout_reference_key" ON "Payout"("reference");
CREATE INDEX "Payout_storeId_createdAt_idx" ON "Payout"("storeId", "createdAt");
CREATE INDEX "Payout_status_nextAttemptAt_idx" ON "Payout"("status", "nextAttemptAt");

ALTER TABLE "Payout" ADD CONSTRAINT "Payout_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
