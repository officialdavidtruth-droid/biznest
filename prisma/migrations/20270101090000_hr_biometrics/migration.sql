-- HR: scanner user id, clock sources, payslip breakdown, devices, raw punches, WebAuthn.
ALTER TABLE "HrEmployee" ADD COLUMN "deviceUserId" TEXT;
CREATE UNIQUE INDEX "HrEmployee_storeId_deviceUserId_key" ON "HrEmployee"("storeId", "deviceUserId");

ALTER TABLE "HrAttendance" ADD COLUMN "checkInSource" TEXT, ADD COLUMN "checkOutSource" TEXT;

ALTER TABLE "HrPayrollItem"
  ADD COLUMN "pension" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "nhf" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paye" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "HrSettings" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "shiftStart" TEXT NOT NULL DEFAULT '09:00',
  "graceMinutes" INTEGER NOT NULL DEFAULT 15,
  "requireBiometric" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrSettings_storeId_key" ON "HrSettings"("storeId");
ALTER TABLE "HrSettings" ADD CONSTRAINT "HrSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HrBiometricDevice" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "apiKeyHash" TEXT NOT NULL,
  "tzOffsetMinutes" INTEGER NOT NULL DEFAULT 60,
  "lastSeenAt" TIMESTAMP(3),
  "lastPunchAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrBiometricDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrBiometricDevice_serialNumber_key" ON "HrBiometricDevice"("serialNumber");
CREATE INDEX "HrBiometricDevice_storeId_idx" ON "HrBiometricDevice"("storeId");
ALTER TABLE "HrBiometricDevice" ADD CONSTRAINT "HrBiometricDevice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HrPunch" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "deviceId" TEXT,
  "employeeId" TEXT,
  "deviceUserId" TEXT,
  "punchedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "direction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPunch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPunch_storeId_deviceUserId_punchedAt_key" ON "HrPunch"("storeId", "deviceUserId", "punchedAt");
CREATE INDEX "HrPunch_storeId_punchedAt_idx" ON "HrPunch"("storeId", "punchedAt");
CREATE INDEX "HrPunch_storeId_employeeId_punchedAt_idx" ON "HrPunch"("storeId", "employeeId", "punchedAt");
ALTER TABLE "HrPunch" ADD CONSTRAINT "HrPunch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPunch" ADD CONSTRAINT "HrPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "HrBiometricDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrPunch" ADD CONSTRAINT "HrPunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HrWebAuthnCredential" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" TEXT,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "HrWebAuthnCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrWebAuthnCredential_credentialId_key" ON "HrWebAuthnCredential"("credentialId");
CREATE INDEX "HrWebAuthnCredential_storeId_employeeId_idx" ON "HrWebAuthnCredential"("storeId", "employeeId");
ALTER TABLE "HrWebAuthnCredential" ADD CONSTRAINT "HrWebAuthnCredential_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HrWebAuthnChallenge" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrWebAuthnChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HrWebAuthnChallenge_employeeId_purpose_idx" ON "HrWebAuthnChallenge"("employeeId", "purpose");
