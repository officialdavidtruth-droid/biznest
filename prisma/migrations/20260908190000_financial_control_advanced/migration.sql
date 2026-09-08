CREATE TYPE "FinancialBankTransactionStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');
CREATE TYPE "FinancialBudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

CREATE TABLE "FinancialBankAccount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "financialAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bankName" TEXT,
  "accountName" TEXT,
  "maskedNumber" TEXT,
  "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialBankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialBankAccount_storeId_name_key" ON "FinancialBankAccount"("storeId", "name");
CREATE INDEX "FinancialBankAccount_storeId_isActive_idx" ON "FinancialBankAccount"("storeId", "isActive");
ALTER TABLE "FinancialBankAccount" ADD CONSTRAINT "FinancialBankAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialBankAccount" ADD CONSTRAINT "FinancialBankAccount_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinancialBankTransaction" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "FinancialBankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedJournalEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialBankTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialBankTransaction_storeId_transactionDate_idx" ON "FinancialBankTransaction"("storeId", "transactionDate");
CREATE INDEX "FinancialBankTransaction_bankAccountId_status_idx" ON "FinancialBankTransaction"("bankAccountId", "status");
ALTER TABLE "FinancialBankTransaction" ADD CONSTRAINT "FinancialBankTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialBankTransaction" ADD CONSTRAINT "FinancialBankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "FinancialBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialBudget" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "FinancialBudgetStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialBudget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialBudget_storeId_name_key" ON "FinancialBudget"("storeId", "name");
CREATE INDEX "FinancialBudget_storeId_status_idx" ON "FinancialBudget"("storeId", "status");
ALTER TABLE "FinancialBudget" ADD CONSTRAINT "FinancialBudget_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialBudgetLine" (
  "id" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "FinancialBudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialBudgetLine_budgetId_accountId_key" ON "FinancialBudgetLine"("budgetId", "accountId");
CREATE INDEX "FinancialBudgetLine_accountId_idx" ON "FinancialBudgetLine"("accountId");
ALTER TABLE "FinancialBudgetLine" ADD CONSTRAINT "FinancialBudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "FinancialBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialBudgetLine" ADD CONSTRAINT "FinancialBudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinancialAsset" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "assetNo" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "purchaseDate" TIMESTAMP(3) NOT NULL,
  "purchaseCost" DECIMAL(12,2) NOT NULL,
  "usefulLifeMonths" INTEGER NOT NULL,
  "residualValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
  "accumulatedDepreciation" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialAsset_storeId_assetNo_key" ON "FinancialAsset"("storeId", "assetNo");
CREATE INDEX "FinancialAsset_storeId_status_idx" ON "FinancialAsset"("storeId", "status");
ALTER TABLE "FinancialAsset" ADD CONSTRAINT "FinancialAsset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
