-- BizNest SEO + CRM
ALTER TABLE "Store"
  ADD COLUMN "seoKeywords" TEXT,
  ADD COLUMN "seoCanonicalUrl" TEXT,
  ADD COLUMN "seoOgImage" TEXT,
  ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seoGoogleVerification" TEXT;

CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW','CONTACTED','QUALIFIED','PROPOSAL','WON','LOST');
CREATE TYPE "CrmLeadSource" AS ENUM ('WEBSITE','FORM','WHATSAPP','EMAIL','PHONE','BOOKING','ORDER','REFERRAL','SOCIAL','MANUAL','OTHER');

CREATE TABLE "CrmLead" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "customerId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "source" "CrmLeadSource" NOT NULL DEFAULT 'MANUAL',
  "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
  "value" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "notes" TEXT,
  "lastContactedAt" TIMESTAMP(3),
  "nextFollowUpAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CrmActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CrmLead_storeId_status_idx" ON "CrmLead"("storeId","status");
CREATE INDEX "CrmLead_storeId_source_idx" ON "CrmLead"("storeId","source");
CREATE INDEX "CrmLead_storeId_nextFollowUpAt_idx" ON "CrmLead"("storeId","nextFollowUpAt");
CREATE INDEX "CrmLead_storeId_createdAt_idx" ON "CrmLead"("storeId","createdAt");
CREATE INDEX "CrmLead_storeId_email_idx" ON "CrmLead"("storeId","email");
CREATE INDEX "CrmLead_storeId_phone_idx" ON "CrmLead"("storeId","phone");
CREATE INDEX "CrmActivity_leadId_createdAt_idx" ON "CrmActivity"("leadId","createdAt");
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "StoreCustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove AI website builder from plan positioning while preserving existing plan IDs.
UPDATE "Subscription"
SET "name" = 'Growth Store'
WHERE "name" = 'Custom AI-Built Store';
UPDATE "Subscription"
SET "features" = COALESCE("features",'{}'::jsonb) - 'aiStoreBuilder'
WHERE "name" IN ('Growth Store','Business Mogul');
