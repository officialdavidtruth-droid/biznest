-- Bring-your-own payment gateway keys per store.
ALTER TABLE "Store"
  ADD COLUMN "ownGatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownGatewayProvider" "PaymentProvider",
  ADD COLUMN "ownPaystackSecretKey" TEXT,
  ADD COLUMN "ownPaystackPublicKey" TEXT,
  ADD COLUMN "ownFlutterwaveSecretKey" TEXT,
  ADD COLUMN "ownFlutterwavePublicKey" TEXT,
  ADD COLUMN "ownFlutterwaveSecretHash" TEXT,
  ADD COLUMN "ownGatewayVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Payment" ADD COLUMN "usesStoreGateway" BOOLEAN NOT NULL DEFAULT false;
