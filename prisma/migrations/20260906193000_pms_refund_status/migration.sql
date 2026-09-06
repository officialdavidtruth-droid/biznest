-- Allow a PMS reservation to distinguish a successfully refunded payment
-- from a merely unpaid/cancelled reservation.
ALTER TYPE "PropertyPaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
