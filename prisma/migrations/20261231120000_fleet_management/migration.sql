CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "name" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "driverName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "odometer" INTEGER NOT NULL DEFAULT 0,
    "nextServiceKm" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FleetLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometer" INTEGER,
    "litres" DECIMAL(10,2),
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FleetLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FleetVehicle_storeId_registration_key" ON "FleetVehicle"("storeId", "registration");
CREATE INDEX "FleetVehicle_storeId_status_idx" ON "FleetVehicle"("storeId", "status");
CREATE INDEX "FleetLog_storeId_loggedAt_idx" ON "FleetLog"("storeId", "loggedAt");
CREATE INDEX "FleetLog_vehicleId_loggedAt_idx" ON "FleetLog"("vehicleId", "loggedAt");

ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FleetLog" ADD CONSTRAINT "FleetLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FleetLog" ADD CONSTRAINT "FleetLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
