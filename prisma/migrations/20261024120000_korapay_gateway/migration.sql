-- Korapay as a third payment gateway (SupaAdmin can switch it on).
-- IF NOT EXISTS keeps this safe to re-run.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'KORAPAY';
