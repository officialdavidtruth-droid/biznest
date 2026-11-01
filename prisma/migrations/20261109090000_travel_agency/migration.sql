-- BizNest Travel: additive only (new tables, no changes to existing tables).
CREATE TABLE "TravelClient" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "fullName" TEXT NOT NULL, "email" TEXT, "phone" TEXT,
  "nationality" TEXT, "passportNo" TEXT, "passportExpiry" TIMESTAMP(3), "dateOfBirth" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelClient_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelSupplier" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'OTHER',
  "contactName" TEXT, "email" TEXT, "phone" TEXT, "notes" TEXT, "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelSupplier_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelPackage" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL, "destination" TEXT NOT NULL,
  "durationDays" INTEGER NOT NULL DEFAULT 1, "pricePerPerson" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'NGN',
  "departureDate" TIMESTAMP(3), "seats" INTEGER NOT NULL DEFAULT 0, "inclusions" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelPackage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelTrip" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "reference" TEXT NOT NULL, "clientId" TEXT NOT NULL, "packageId" TEXT,
  "title" TEXT NOT NULL, "destination" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ENQUIRY',
  "departDate" TIMESTAMP(3), "returnDate" TIMESTAMP(3), "currency" TEXT NOT NULL DEFAULT 'NGN',
  "totalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0, "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelTrip_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelTraveler" (
  "id" TEXT NOT NULL, "tripId" TEXT NOT NULL, "fullName" TEXT NOT NULL, "passportNo" TEXT, "passportExpiry" TIMESTAMP(3),
  "dateOfBirth" TIMESTAMP(3), "nationality" TEXT, "isLead" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "TravelTraveler_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelTripItem" (
  "id" TEXT NOT NULL, "tripId" TEXT NOT NULL, "supplierId" TEXT, "kind" TEXT NOT NULL DEFAULT 'OTHER', "description" TEXT NOT NULL,
  "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3), "confirmationRef" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0, "sellPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelTripItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelPayment" (
  "id" TEXT NOT NULL, "tripId" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "method" TEXT NOT NULL DEFAULT 'TRANSFER',
  "status" TEXT NOT NULL DEFAULT 'RECEIVED', "dueDate" TIMESTAMP(3), "paidAt" TIMESTAMP(3), "reference" TEXT, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelPayment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TravelVisaCase" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "country" TEXT NOT NULL,
  "visaType" TEXT NOT NULL DEFAULT 'TOURIST', "status" TEXT NOT NULL DEFAULT 'DOCUMENTS', "checklist" JSONB,
  "appointmentAt" TIMESTAMP(3), "submittedAt" TIMESTAMP(3), "fee" DECIMAL(12,2) NOT NULL DEFAULT 0, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelVisaCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TravelClient_storeId_fullName_idx" ON "TravelClient"("storeId", "fullName");
CREATE INDEX "TravelClient_storeId_phone_idx" ON "TravelClient"("storeId", "phone");
CREATE INDEX "TravelSupplier_storeId_isArchived_idx" ON "TravelSupplier"("storeId", "isArchived");
CREATE INDEX "TravelPackage_storeId_isActive_idx" ON "TravelPackage"("storeId", "isActive");
CREATE UNIQUE INDEX "TravelTrip_storeId_reference_key" ON "TravelTrip"("storeId", "reference");
CREATE INDEX "TravelTrip_storeId_status_idx" ON "TravelTrip"("storeId", "status");
CREATE INDEX "TravelTrip_storeId_departDate_idx" ON "TravelTrip"("storeId", "departDate");
CREATE INDEX "TravelTrip_clientId_idx" ON "TravelTrip"("clientId");
CREATE INDEX "TravelTraveler_tripId_idx" ON "TravelTraveler"("tripId");
CREATE INDEX "TravelTripItem_tripId_idx" ON "TravelTripItem"("tripId");
CREATE INDEX "TravelTripItem_supplierId_idx" ON "TravelTripItem"("supplierId");
CREATE INDEX "TravelPayment_tripId_status_idx" ON "TravelPayment"("tripId", "status");
CREATE INDEX "TravelVisaCase_storeId_status_idx" ON "TravelVisaCase"("storeId", "status");
CREATE INDEX "TravelVisaCase_clientId_idx" ON "TravelVisaCase"("clientId");

ALTER TABLE "TravelClient" ADD CONSTRAINT "TravelClient_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelSupplier" ADD CONSTRAINT "TravelSupplier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelPackage" ADD CONSTRAINT "TravelPackage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelTrip" ADD CONSTRAINT "TravelTrip_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelTrip" ADD CONSTRAINT "TravelTrip_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TravelClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TravelTrip" ADD CONSTRAINT "TravelTrip_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TravelTraveler" ADD CONSTRAINT "TravelTraveler_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelTripItem" ADD CONSTRAINT "TravelTripItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelTripItem" ADD CONSTRAINT "TravelTripItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "TravelSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TravelPayment" ADD CONSTRAINT "TravelPayment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelVisaCase" ADD CONSTRAINT "TravelVisaCase_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelVisaCase" ADD CONSTRAINT "TravelVisaCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TravelClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
