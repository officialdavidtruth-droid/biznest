-- Payout wallet: payouts can wait in HELD until SupaAdmin releases them.
-- IF NOT EXISTS keeps this safe to re-run.
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'HELD';
