-- BizNest Travel: private file attachments on trips and visa cases. Additive only.
CREATE TABLE "TravelAttachment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tripId" TEXT,
    "visaCaseId" TEXT,
    "travelerId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "publicId" TEXT NOT NULL,
    "note" TEXT,
    "uploadedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelAttachment_storeId_tripId_idx" ON "TravelAttachment"("storeId", "tripId");
CREATE INDEX "TravelAttachment_storeId_visaCaseId_idx" ON "TravelAttachment"("storeId", "visaCaseId");
ALTER TABLE "TravelAttachment" ADD CONSTRAINT "TravelAttachment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelAttachment" ADD CONSTRAINT "TravelAttachment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelAttachment" ADD CONSTRAINT "TravelAttachment_visaCaseId_fkey" FOREIGN KEY ("visaCaseId") REFERENCES "TravelVisaCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
