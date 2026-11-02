-- Tailoring jobs: store a customer phone number so the tailor can call when a job is ready.
ALTER TABLE "TailoringJob" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;

-- HR employees: annual rent paid, used for the Nigeria Tax Act 2025 rent relief in PAYE.
ALTER TABLE "HrEmployee" ADD COLUMN IF NOT EXISTS "annualRent" DECIMAL(14,2) NOT NULL DEFAULT 0;
