-- BizNest Travel: payments made to suppliers (payables tracking). Additive only.
CREATE TABLE "TravelSupplierPayment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "method" TEXT NOT NULL DEFAULT 'TRANSFER',
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelSupplierPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelSupplierPayment_storeId_supplierId_status_idx" ON "TravelSupplierPayment"("storeId", "supplierId", "status");
ALTER TABLE "TravelSupplierPayment" ADD CONSTRAINT "TravelSupplierPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelSupplierPayment" ADD CONSTRAINT "TravelSupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "TravelSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
