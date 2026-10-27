-- Owner opt-in for the end-of-day summary email. Idempotent because earlier
-- migrations in this repo were applied out-of-band via `db push`.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "dailySummaryEmail" BOOLEAN NOT NULL DEFAULT false;
