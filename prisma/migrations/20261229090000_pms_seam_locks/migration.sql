ALTER TYPE "LockProvider" ADD VALUE 'SEAM';
ALTER TABLE "LockIntegration" ADD COLUMN "seamApiKeyEnc" TEXT;
ALTER TABLE "LockIntegration" ADD COLUMN "seamSystemId" TEXT;
