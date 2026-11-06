-- Members and billing (church, salon, fitness). Additive only.
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'MEMBER_PAYMENT';

CREATE TABLE "Member" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "notes" TEXT,
  "portalToken" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Member_portalToken_key" ON "Member"("portalToken");
CREATE INDEX "Member_storeId_active_idx" ON "Member"("storeId", "active");
CREATE INDEX "Member_storeId_name_idx" ON "Member"("storeId", "name");

CREATE TABLE "MemberPlan" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'MEMBERSHIP',
  "price" DECIMAL(12,2) NOT NULL DEFAULT 0, "interval" TEXT NOT NULL DEFAULT 'MONTHLY', "sessions" INTEGER, "validityDays" INTEGER,
  "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MemberPlan_storeId_kind_active_idx" ON "MemberPlan"("storeId", "kind", "active");

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "memberId" TEXT NOT NULL, "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "renewsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "sessionsLeft" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Membership_storeId_status_renewsAt_idx" ON "Membership"("storeId", "status", "renewsAt");
CREATE INDEX "Membership_memberId_idx" ON "Membership"("memberId");

CREATE TABLE "MemberCharge" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "memberId" TEXT, "membershipId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'DUES', "fund" TEXT, "label" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DUE', "dueDate" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3),
  "method" TEXT, "reference" TEXT, "receiptNo" TEXT, "note" TEXT, "donorName" TEXT, "donorEmail" TEXT,
  "reminderCount" INTEGER NOT NULL DEFAULT 0, "lastReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberCharge_storeId_receiptNo_key" ON "MemberCharge"("storeId", "receiptNo");
CREATE INDEX "MemberCharge_storeId_status_dueDate_idx" ON "MemberCharge"("storeId", "status", "dueDate");
CREATE INDEX "MemberCharge_storeId_kind_status_paidAt_idx" ON "MemberCharge"("storeId", "kind", "status", "paidAt");
CREATE INDEX "MemberCharge_memberId_status_idx" ON "MemberCharge"("memberId", "status");
CREATE INDEX "MemberCharge_membershipId_idx" ON "MemberCharge"("membershipId");

CREATE TABLE "MemberCheckIn" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "memberId" TEXT NOT NULL, "membershipId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "note" TEXT, "usedSession" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MemberCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MemberCheckIn_storeId_at_idx" ON "MemberCheckIn"("storeId", "at");
CREATE INDEX "MemberCheckIn_memberId_at_idx" ON "MemberCheckIn"("memberId", "at");

ALTER TABLE "Member" ADD CONSTRAINT "Member_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberPlan" ADD CONSTRAINT "MemberPlan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MemberPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemberCharge" ADD CONSTRAINT "MemberCharge_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberCharge" ADD CONSTRAINT "MemberCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberCharge" ADD CONSTRAINT "MemberCharge_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberCheckIn" ADD CONSTRAINT "MemberCheckIn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberCheckIn" ADD CONSTRAINT "MemberCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberCheckIn" ADD CONSTRAINT "MemberCheckIn_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "memberChargeId" TEXT;
CREATE INDEX "Payment_memberChargeId_idx" ON "Payment"("memberChargeId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberChargeId_fkey" FOREIGN KEY ("memberChargeId") REFERENCES "MemberCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
