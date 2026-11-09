-- CreateTable
CREATE TABLE "VendorReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIGNED_UP',
    "planId" TEXT,
    "planName" TEXT,
    "planPrice" DECIMAL(12,2),
    "reward" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unlockCount" INTEGER NOT NULL DEFAULT 0,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "confirmAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signupIpHash" TEXT,
    "withdrawalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorReferralWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "reference" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT,
    "bankName" TEXT,
    "gatewayTransferId" TEXT,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorReferralWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorReferralCode_userId_key" ON "VendorReferralCode"("userId");
CREATE UNIQUE INDEX "VendorReferralCode_code_key" ON "VendorReferralCode"("code");
CREATE UNIQUE INDEX "VendorReferral_refereeId_key" ON "VendorReferral"("refereeId");
CREATE UNIQUE INDEX "VendorReferral_paymentReference_key" ON "VendorReferral"("paymentReference");
CREATE INDEX "VendorReferral_referrerId_status_idx" ON "VendorReferral"("referrerId", "status");
CREATE INDEX "VendorReferral_status_confirmAt_idx" ON "VendorReferral"("status", "confirmAt");
CREATE INDEX "VendorReferral_withdrawalId_idx" ON "VendorReferral"("withdrawalId");
CREATE UNIQUE INDEX "VendorReferralWithdrawal_reference_key" ON "VendorReferralWithdrawal"("reference");
CREATE INDEX "VendorReferralWithdrawal_status_idx" ON "VendorReferralWithdrawal"("status");
CREATE INDEX "VendorReferralWithdrawal_userId_createdAt_idx" ON "VendorReferralWithdrawal"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "VendorReferralCode" ADD CONSTRAINT "VendorReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorReferral" ADD CONSTRAINT "VendorReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorReferral" ADD CONSTRAINT "VendorReferral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorReferral" ADD CONSTRAINT "VendorReferral_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "VendorReferralWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorReferralWithdrawal" ADD CONSTRAINT "VendorReferralWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
