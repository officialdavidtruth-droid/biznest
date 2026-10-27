-- Persisted PMS maintenance tickets (previously held only in browser state).
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "MaintenanceTicketStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "PropertyMaintenanceTicket" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceTicketStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    CONSTRAINT "PropertyMaintenanceTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyMaintenanceTicket_storeId_status_reportedAt_idx" ON "PropertyMaintenanceTicket"("storeId", "status", "reportedAt");
CREATE INDEX "PropertyMaintenanceTicket_roomId_status_idx" ON "PropertyMaintenanceTicket"("roomId", "status");

ALTER TABLE "PropertyMaintenanceTicket" ADD CONSTRAINT "PropertyMaintenanceTicket_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMaintenanceTicket" ADD CONSTRAINT "PropertyMaintenanceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
