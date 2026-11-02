-- BizNest Travel: refunds against a trip payment (full or partial, one per payment). Additive only.
ALTER TABLE "TravelPayment" ADD COLUMN "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "TravelPayment" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "TravelPayment" ADD COLUMN "refundReference" TEXT;
ALTER TABLE "TravelPayment" ADD COLUMN "refundReason" TEXT;
ALTER TABLE "TravelPayment" ADD COLUMN "refundedByEmail" TEXT;
