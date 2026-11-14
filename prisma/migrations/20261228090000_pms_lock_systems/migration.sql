CREATE TYPE "LockProvider" AS ENUM ('TTLOCK', 'BRIDGE');
CREATE TYPE "AccessGrantStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKE_PENDING', 'REVOKED', 'FAILED');

CREATE TABLE "LockIntegration" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" "LockProvider" NOT NULL,
    "ttClientId" TEXT,
    "ttClientSecretEnc" TEXT,
    "ttUsername" TEXT,
    "ttPasswordMd5Enc" TEXT,
    "ttTokenEnc" TEXT,
    "ttTokenExpiresAt" TIMESTAMP(3),
    "bridgeToken" TEXT,
    "bridgeLastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LockIntegration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RoomLock" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "lockId" TEXT NOT NULL,
    "lockLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomLock_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StayAccessGrant" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "provider" "LockProvider" NOT NULL,
    "lockId" TEXT NOT NULL,
    "externalId" TEXT,
    "passcode" TEXT,
    "status" "AccessGrantStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StayAccessGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LockIntegration_storeId_key" ON "LockIntegration"("storeId");
CREATE UNIQUE INDEX "LockIntegration_bridgeToken_key" ON "LockIntegration"("bridgeToken");
CREATE UNIQUE INDEX "RoomLock_roomId_key" ON "RoomLock"("roomId");
CREATE INDEX "RoomLock_storeId_idx" ON "RoomLock"("storeId");
CREATE INDEX "StayAccessGrant_reservationId_status_idx" ON "StayAccessGrant"("reservationId", "status");
CREATE INDEX "StayAccessGrant_storeId_provider_status_idx" ON "StayAccessGrant"("storeId", "provider", "status");
ALTER TABLE "LockIntegration" ADD CONSTRAINT "LockIntegration_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomLock" ADD CONSTRAINT "RoomLock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomLock" ADD CONSTRAINT "RoomLock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayAccessGrant" ADD CONSTRAINT "StayAccessGrant_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayAccessGrant" ADD CONSTRAINT "StayAccessGrant_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PropertyReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
