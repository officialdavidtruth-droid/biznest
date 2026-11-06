-- Event ticketing. Additive only.
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'TICKET_PURCHASE';

CREATE TABLE "TicketEvent" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "venue" TEXT, "imageUrl" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TicketEvent_storeId_slug_key" ON "TicketEvent"("storeId", "slug");
CREATE INDEX "TicketEvent_storeId_status_startsAt_idx" ON "TicketEvent"("storeId", "status", "startsAt");

CREATE TABLE "TicketTier" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "name" TEXT NOT NULL, "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "capacity" INTEGER NOT NULL, "sold" INTEGER NOT NULL DEFAULT 0, "maxPerOrder" INTEGER NOT NULL DEFAULT 10, "saleEndsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketTier_eventId_active_idx" ON "TicketTier"("eventId", "active");

CREATE TABLE "TicketOrder" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "buyerName" TEXT NOT NULL, "buyerEmail" TEXT, "buyerPhone" TEXT,
  "total" DECIMAL(12,2) NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "accessToken" TEXT NOT NULL, "method" TEXT, "reference" TEXT,
  "receiptNo" TEXT, "note" TEXT, "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TicketOrder_accessToken_key" ON "TicketOrder"("accessToken");
CREATE UNIQUE INDEX "TicketOrder_storeId_receiptNo_key" ON "TicketOrder"("storeId", "receiptNo");
CREATE INDEX "TicketOrder_storeId_status_createdAt_idx" ON "TicketOrder"("storeId", "status", "createdAt");
CREATE INDEX "TicketOrder_eventId_status_idx" ON "TicketOrder"("eventId", "status");

CREATE TABLE "TicketOrderItem" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "tierId" TEXT NOT NULL, "qty" INTEGER NOT NULL, "unitPrice" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "TicketOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketOrderItem_orderId_idx" ON "TicketOrderItem"("orderId");

CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "tierId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "holderName" TEXT, "status" TEXT NOT NULL DEFAULT 'VALID', "checkedInAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");
CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrderItem" ADD CONSTRAINT "TicketOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrderItem" ADD CONSTRAINT "TicketOrderItem_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TicketEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "ticketOrderId" TEXT;
CREATE INDEX "Payment_ticketOrderId_idx" ON "Payment"("ticketOrderId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ticketOrderId_fkey" FOREIGN KEY ("ticketOrderId") REFERENCES "TicketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
