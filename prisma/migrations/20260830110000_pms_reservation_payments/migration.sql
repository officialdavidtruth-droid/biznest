-- Wires PropertyReservation into the shared Payment model so hotel
-- deposits/stay charges settle through the same Paystack/Flutterwave
-- webhook + callback routes as every other payment type (orders, service
-- bookings, invoices, quotes, wallet funding), instead of PMS being the
-- only revenue path with no payment integration at all.
--
-- All new columns are nullable / defaulted so existing reservations remain
-- valid: nothing here requires a hotel to start charging through BizNest.

CREATE TYPE "PropertyPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID');

ALTER TABLE "PropertyReservation"
  ADD COLUMN "depositAmount" DECIMAL(12,2),
  ADD COLUMN "paymentCurrency" TEXT,
  ADD COLUMN "paymentStatus" "PropertyPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "paymentReference" TEXT;

CREATE UNIQUE INDEX "PropertyReservation_paymentReference_key" ON "PropertyReservation"("paymentReference");

-- Extend the existing PaymentPurpose enum used by Payment.purpose.
ALTER TYPE "PaymentPurpose" ADD VALUE 'PMS_RESERVATION';

ALTER TABLE "Payment" ADD COLUMN "reservationId" TEXT;

CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "PropertyReservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
