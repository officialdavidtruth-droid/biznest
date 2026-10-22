-- Channel sync: OTA calendar connections (iCal) + channel-manager requests.
CREATE TABLE IF NOT EXISTS "ChannelConnection" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT,
  "importUrl" TEXT,
  "exportToken" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncMessage" TEXT,
  "lastBlockCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChannelBlock" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "uid" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChannelManagerRequest" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "propertyCode" TEXT,
  "contactEmail" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelManagerRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConnection_exportToken_key" ON "ChannelConnection"("exportToken");
CREATE INDEX IF NOT EXISTS "ChannelConnection_storeId_idx" ON "ChannelConnection"("storeId");
CREATE INDEX IF NOT EXISTS "ChannelConnection_roomId_idx" ON "ChannelConnection"("roomId");
CREATE INDEX IF NOT EXISTS "ChannelConnection_isActive_lastSyncAt_idx" ON "ChannelConnection"("isActive", "lastSyncAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelBlock_connectionId_uid_key" ON "ChannelBlock"("connectionId", "uid");
CREATE INDEX IF NOT EXISTS "ChannelBlock_roomId_startDate_endDate_idx" ON "ChannelBlock"("roomId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "ChannelBlock_storeId_idx" ON "ChannelBlock"("storeId");
CREATE INDEX IF NOT EXISTS "ChannelManagerRequest_storeId_idx" ON "ChannelManagerRequest"("storeId");
CREATE INDEX IF NOT EXISTS "ChannelManagerRequest_status_idx" ON "ChannelManagerRequest"("status");

ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelBlock" ADD CONSTRAINT "ChannelBlock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelBlock" ADD CONSTRAINT "ChannelBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelBlock" ADD CONSTRAINT "ChannelBlock_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelManagerRequest" ADD CONSTRAINT "ChannelManagerRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
