CREATE TYPE "PluginStatus" AS ENUM ('ACTIVE','DISABLED');
CREATE TYPE "PluginBillingInterval" AS ENUM ('MONTHLY','YEARLY','ONE_TIME');
CREATE TYPE "StorePluginStatus" AS ENUM ('ACTIVE','SUSPENDED');
CREATE TYPE "FinancialAccountType" AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
CREATE TYPE "FinancialEntryStatus" AS ENUM ('DRAFT','POSTED','VOIDED');
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN','CLOSED');
CREATE TYPE "FinancialExpenseStatus" AS ENUM ('DRAFT','APPROVED','POSTED','REJECTED');

CREATE TABLE "Plugin" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "icon" TEXT,
  "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "billingInterval" "PluginBillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "isFree" BOOLEAN NOT NULL DEFAULT false,
  "isComingSoon" BOOLEAN NOT NULL DEFAULT false,
  "status" "PluginStatus" NOT NULL DEFAULT 'ACTIVE',
  "eligibleBusinessTypes" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plugin_key_key" ON "Plugin"("key");
CREATE INDEX "Plugin_status_sortOrder_idx" ON "Plugin"("status","sortOrder");
CREATE INDEX "Plugin_category_idx" ON "Plugin"("category");

CREATE TABLE "PluginPlanAccess" (
  "id" TEXT NOT NULL,
  "pluginId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginPlanAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PluginPlanAccess_pluginId_subscriptionId_key" ON "PluginPlanAccess"("pluginId","subscriptionId");
CREATE INDEX "PluginPlanAccess_subscriptionId_idx" ON "PluginPlanAccess"("subscriptionId");
ALTER TABLE "PluginPlanAccess" ADD CONSTRAINT "PluginPlanAccess_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PluginPlanAccess" ADD CONSTRAINT "PluginPlanAccess_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StorePlugin" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "pluginId" TEXT NOT NULL,
  "status" "StorePluginStatus" NOT NULL DEFAULT 'ACTIVE',
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "renewsAt" TIMESTAMP(3),
  "pastDueSince" TIMESTAMP(3),
  "lastPaymentAt" TIMESTAMP(3),
  CONSTRAINT "StorePlugin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StorePlugin_storeId_pluginId_key" ON "StorePlugin"("storeId","pluginId");
CREATE INDEX "StorePlugin_storeId_status_idx" ON "StorePlugin"("storeId","status");
ALTER TABLE "StorePlugin" ADD CONSTRAINT "StorePlugin_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorePlugin" ADD CONSTRAINT "StorePlugin_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FinancialAccountType" NOT NULL,
  "parentId" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialAccount_storeId_code_key" ON "FinancialAccount"("storeId","code");
CREATE INDEX "FinancialAccount_storeId_type_isActive_idx" ON "FinancialAccount"("storeId","type","isActive");
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FinancialPeriod" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialPeriod_storeId_startsAt_endsAt_key" ON "FinancialPeriod"("storeId","startsAt","endsAt");
CREATE INDEX "FinancialPeriod_storeId_status_idx" ON "FinancialPeriod"("storeId","status");
ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialJournalEntry" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "periodId" TEXT,
  "reference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "status" "FinancialEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "postedAt" TIMESTAMP(3),
  "postedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialJournalEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialJournalEntry_storeId_reference_key" ON "FinancialJournalEntry"("storeId","reference");
CREATE INDEX "FinancialJournalEntry_storeId_entryDate_idx" ON "FinancialJournalEntry"("storeId","entryDate");
CREATE INDEX "FinancialJournalEntry_storeId_status_idx" ON "FinancialJournalEntry"("storeId","status");
ALTER TABLE "FinancialJournalEntry" ADD CONSTRAINT "FinancialJournalEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialJournalEntry" ADD CONSTRAINT "FinancialJournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FinancialJournalLine" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "description" TEXT,
  "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT "FinancialJournalLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialJournalLine_journalEntryId_idx" ON "FinancialJournalLine"("journalEntryId");
CREATE INDEX "FinancialJournalLine_accountId_idx" ON "FinancialJournalLine"("accountId");
ALTER TABLE "FinancialJournalLine" ADD CONSTRAINT "FinancialJournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinancialJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialJournalLine" ADD CONSTRAINT "FinancialJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinancialExpense" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "expenseNo" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "vendorName" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "expenseAccountId" TEXT NOT NULL,
  "paymentAccountId" TEXT NOT NULL,
  "status" "FinancialExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "journalEntryId" TEXT,
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialExpense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialExpense_storeId_expenseNo_key" ON "FinancialExpense"("storeId","expenseNo");
CREATE UNIQUE INDEX "FinancialExpense_journalEntryId_key" ON "FinancialExpense"("journalEntryId");
CREATE INDEX "FinancialExpense_storeId_expenseDate_idx" ON "FinancialExpense"("storeId","expenseDate");
CREATE INDEX "FinancialExpense_storeId_status_idx" ON "FinancialExpense"("storeId","status");
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinancialJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'PLUGIN_PURCHASE';
