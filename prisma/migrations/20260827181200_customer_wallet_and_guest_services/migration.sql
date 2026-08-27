-- Customer wallet + guest service checkout

ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'WALLET';
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'SERVICE_BOOKING';
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'WALLET_FUNDING';

CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'REFUNDED');
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "WalletTransactionType" AS ENUM ('FUNDING', 'PAYMENT', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "WalletPaymentRequestStatus" AS ENUM ('PENDING', 'REDEEMED', 'CANCELLED', 'EXPIRED');

ALTER TABLE "Booking"
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentAmount" DECIMAL(12,2),
  ADD COLUMN "paymentCurrency" TEXT NOT NULL DEFAULT 'NGN';

CREATE UNIQUE INDEX "Booking_paymentReference_key" ON "Booking"("paymentReference");

CREATE TABLE "StoreWallet" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreWallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreWallet_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StoreWallet_storeId_userId_key" ON "StoreWallet"("storeId", "userId");
CREATE INDEX "StoreWallet_userId_idx" ON "StoreWallet"("userId");
CREATE INDEX "StoreWallet_storeId_status_idx" ON "StoreWallet"("storeId", "status");

CREATE TABLE "WalletPaymentRequest" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "WalletPaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletPaymentRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletPaymentRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WalletPaymentRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "StoreWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WalletPaymentRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WalletPaymentRequest_tokenHash_key" ON "WalletPaymentRequest"("tokenHash");
CREATE INDEX "WalletPaymentRequest_storeId_status_idx" ON "WalletPaymentRequest"("storeId", "status");
CREATE INDEX "WalletPaymentRequest_bookingId_status_idx" ON "WalletPaymentRequest"("bookingId", "status");
CREATE INDEX "WalletPaymentRequest_walletId_idx" ON "WalletPaymentRequest"("walletId");
CREATE INDEX "WalletPaymentRequest_expiresAt_idx" ON "WalletPaymentRequest"("expiresAt");

CREATE TABLE "WalletTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" "WalletTransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "reference" TEXT NOT NULL,
  "paymentId" TEXT,
  "bookingId" TEXT,
  "orderId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "StoreWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WalletTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WalletTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WalletTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");
CREATE UNIQUE INDEX "WalletTransaction_paymentId_key" ON "WalletTransaction"("paymentId");
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");
CREATE INDEX "WalletTransaction_bookingId_idx" ON "WalletTransaction"("bookingId");
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");

ALTER TABLE "Payment"
  ADD COLUMN "bookingId" TEXT,
  ADD COLUMN "walletId" TEXT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "StoreWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE INDEX "Payment_walletId_idx" ON "Payment"("walletId");

  
