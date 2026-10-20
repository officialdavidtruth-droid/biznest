-- City ledger accounts for Financial Control
CREATE TABLE "FinancialCityLedgerAccount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "financialAccountId" TEXT NOT NULL,
  "accountNo" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "creditLimit" DECIMAL(12,2),
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialCityLedgerAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialCityLedgerAccount_financialAccountId_key" ON "FinancialCityLedgerAccount"("financialAccountId");
CREATE UNIQUE INDEX "FinancialCityLedgerAccount_storeId_accountNo_key" ON "FinancialCityLedgerAccount"("storeId", "accountNo");
CREATE UNIQUE INDEX "FinancialCityLedgerAccount_storeId_name_key" ON "FinancialCityLedgerAccount"("storeId", "name");
CREATE INDEX "FinancialCityLedgerAccount_storeId_isActive_idx" ON "FinancialCityLedgerAccount"("storeId", "isActive");
ALTER TABLE "FinancialCityLedgerAccount" ADD CONSTRAINT "FinancialCityLedgerAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialCityLedgerAccount" ADD CONSTRAINT "FinancialCityLedgerAccount_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
