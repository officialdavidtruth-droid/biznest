-- Store the original customer quote-request brief and supporting references
-- directly on Quote so every storefront request has a first-class record in
-- the merchant Quotes workspace.
ALTER TABLE "Quote" ADD COLUMN "serviceType" TEXT;
ALTER TABLE "Quote" ADD COLUMN "brief" TEXT;
ALTER TABLE "Quote" ADD COLUMN "budget" DECIMAL(12,2);
ALTER TABLE "Quote" ADD COLUMN "deadline" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "referenceFiles" JSONB;
