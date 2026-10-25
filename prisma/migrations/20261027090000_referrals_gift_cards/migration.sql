-- Referral program + store gift cards (additive; nothing existing is altered
-- except three defaulted columns on "Store").

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "GiftCardTransactionType" AS ENUM ('ISSUE', 'REDEEM', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REWARDED', 'CANCELLED');

-- AlterTable: per-store referral program settings (off by default)
ALTER TABLE "Store"
  ADD COLUMN "referralEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "referralReferrerPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "referralRefereePoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialAmount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT,
    "purchaserId" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id"),
    -- Defence in depth: a balance can never go negative, whatever the app does.
    CONSTRAINT "GiftCard_balance_nonneg" CHECK ("balance" >= 0),
    CONSTRAINT "GiftCard_initial_positive" CHECK ("initialAmount" > 0)
);

CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "type" "GiftCardTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "qualifyingOrderId" TEXT,
    "referrerPoints" INTEGER NOT NULL DEFAULT 0,
    "refereePoints" INTEGER NOT NULL DEFAULT 0,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Referral_no_self_referral" CHECK ("referrerId" <> "refereeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_storeId_code_key" ON "GiftCard"("storeId", "code");
CREATE INDEX "GiftCard_storeId_status_idx" ON "GiftCard"("storeId", "status");
CREATE INDEX "GiftCard_storeId_recipientEmail_idx" ON "GiftCard"("storeId", "recipientEmail");
CREATE INDEX "GiftCardTransaction_giftCardId_createdAt_idx" ON "GiftCardTransaction"("giftCardId", "createdAt");
CREATE INDEX "GiftCardTransaction_orderId_idx" ON "GiftCardTransaction"("orderId");
CREATE UNIQUE INDEX "ReferralCode_storeId_code_key" ON "ReferralCode"("storeId", "code");
CREATE UNIQUE INDEX "ReferralCode_storeId_userId_key" ON "ReferralCode"("storeId", "userId");
CREATE UNIQUE INDEX "Referral_qualifyingOrderId_key" ON "Referral"("qualifyingOrderId");
CREATE UNIQUE INDEX "Referral_storeId_refereeId_key" ON "Referral"("storeId", "refereeId");
CREATE INDEX "Referral_storeId_referrerId_idx" ON "Referral"("storeId", "referrerId");
CREATE INDEX "Referral_storeId_status_idx" ON "Referral"("storeId", "status");

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_qualifyingOrderId_fkey" FOREIGN KEY ("qualifyingOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
