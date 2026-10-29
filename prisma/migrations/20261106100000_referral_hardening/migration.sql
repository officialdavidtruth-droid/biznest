-- Referral hardening: anti-abuse settings, promised-points snapshot, cancel/reverse support, ledger linkage.
ALTER TYPE "ReferralStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

ALTER TABLE "Store"
  ADD COLUMN "referralMinOrderAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "referralMaxRewardsPerReferrer" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "referralExpiryDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Referral"
  ADD COLUMN "promisedReferrerPoints" INTEGER,
  ADD COLUMN "promisedRefereePoints" INTEGER,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "reversedAt" TIMESTAMP(3);

ALTER TABLE "StoreLoyaltyEntry" ADD COLUMN "referralId" TEXT;
CREATE INDEX "StoreLoyaltyEntry_referralId_idx" ON "StoreLoyaltyEntry"("referralId");
ALTER TABLE "StoreLoyaltyEntry"
  ADD CONSTRAINT "StoreLoyaltyEntry_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
