-- BizNest Travel: sub-agents and commission. Additive only.
CREATE TABLE "TravelAgent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "defaultRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "defaultBasis" TEXT NOT NULL DEFAULT 'SELL',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelAgent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelAgent_storeId_isArchived_idx" ON "TravelAgent"("storeId", "isArchived");
ALTER TABLE "TravelAgent" ADD CONSTRAINT "TravelAgent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TravelAgentPayment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "method" TEXT NOT NULL DEFAULT 'TRANSFER',
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelAgentPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelAgentPayment_storeId_agentId_status_idx" ON "TravelAgentPayment"("storeId", "agentId", "status");
ALTER TABLE "TravelAgentPayment" ADD CONSTRAINT "TravelAgentPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelAgentPayment" ADD CONSTRAINT "TravelAgentPayment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TravelAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelTrip" ADD COLUMN "agentId" TEXT;
ALTER TABLE "TravelTrip" ADD COLUMN "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "TravelTrip" ADD COLUMN "commissionBasis" TEXT NOT NULL DEFAULT 'SELL';
CREATE INDEX "TravelTrip_agentId_idx" ON "TravelTrip"("agentId");
ALTER TABLE "TravelTrip" ADD CONSTRAINT "TravelTrip_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TravelAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
