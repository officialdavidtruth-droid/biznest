-- Door readers that check room key cards against BizNest, and a log of every scan.
CREATE TABLE "DoorReader" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "roomId" TEXT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DoorReader_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RoomAccessScan" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "cardUid" TEXT NOT NULL,
    "cardId" TEXT,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomAccessScan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DoorReader_token_key" ON "DoorReader"("token");
CREATE INDEX "DoorReader_storeId_isActive_idx" ON "DoorReader"("storeId", "isActive");
CREATE INDEX "DoorReader_roomId_idx" ON "DoorReader"("roomId");
CREATE INDEX "RoomAccessScan_storeId_createdAt_idx" ON "RoomAccessScan"("storeId", "createdAt");
CREATE INDEX "RoomAccessScan_readerId_createdAt_idx" ON "RoomAccessScan"("readerId", "createdAt");
ALTER TABLE "DoorReader" ADD CONSTRAINT "DoorReader_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoorReader" ADD CONSTRAINT "DoorReader_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAccessScan" ADD CONSTRAINT "RoomAccessScan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAccessScan" ADD CONSTRAINT "RoomAccessScan_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "DoorReader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
