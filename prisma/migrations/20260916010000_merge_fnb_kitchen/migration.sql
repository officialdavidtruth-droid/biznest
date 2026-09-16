-- Merge the former Kitchen Operations marketplace app into BizNest FnB.
-- Existing stores that had the old app installed are transferred to the
-- canonical fnb-operations entitlement before the old plugin is removed.
DO $$
DECLARE
  fnb_id TEXT;
  kitchen_id TEXT;
BEGIN
  SELECT id INTO fnb_id FROM "Plugin" WHERE key = 'fnb-operations' LIMIT 1;
  SELECT id INTO kitchen_id FROM "Plugin" WHERE key = 'restaurant-operations' LIMIT 1;

  IF fnb_id IS NOT NULL AND kitchen_id IS NOT NULL THEN
    INSERT INTO "StorePlugin" (id, "storeId", "pluginId", status, "installedAt", "updatedAt", "renewsAt", "pastDueSince", "lastPaymentAt")
    SELECT 'fnb-' || md5(sp.id), sp."storeId", fnb_id, sp.status, sp."installedAt", NOW(), sp."renewsAt", sp."pastDueSince", sp."lastPaymentAt"
    FROM "StorePlugin" sp
    WHERE sp."pluginId" = kitchen_id
      AND NOT EXISTS (
        SELECT 1 FROM "StorePlugin" existing
        WHERE existing."storeId" = sp."storeId" AND existing."pluginId" = fnb_id
      );

    DELETE FROM "StorePlugin" WHERE "pluginId" = kitchen_id;
    DELETE FROM "PluginPlanAccess" WHERE "pluginId" = kitchen_id;
    DELETE FROM "Plugin" WHERE id = kitchen_id;
  END IF;
END $$;

CREATE TYPE "FnbFulfillmentStatus" AS ENUM ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'FULFILLED', 'CANCELLED');
CREATE TYPE "FnbKitchenStatus" AS ENUM ('QUEUED', 'STARTED', 'READY', 'EXPO', 'SERVED', 'VOIDED');
CREATE TYPE "FnbOrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

ALTER TABLE "Order" ADD COLUMN "fulfillmentStatus" "FnbFulfillmentStatus";
ALTER TABLE "Order" ADD COLUMN "kitchenStatus" "FnbKitchenStatus";
ALTER TABLE "Order" ADD COLUMN "fnbOrderType" "FnbOrderType";
ALTER TABLE "Order" ADD COLUMN "fnbTableLabel" TEXT;

UPDATE "Order"
SET "fulfillmentStatus" = CASE
  WHEN status = 'IN_PROGRESS' THEN 'PREPARING'::"FnbFulfillmentStatus"
  WHEN status = 'DELIVERED' THEN 'READY'::"FnbFulfillmentStatus"
  WHEN status = 'COMPLETED' THEN 'FULFILLED'::"FnbFulfillmentStatus"
  WHEN status IN ('CANCELLED', 'REFUNDED', 'DISPUTED') THEN 'CANCELLED'::"FnbFulfillmentStatus"
  ELSE 'NEW'::"FnbFulfillmentStatus"
END,
"kitchenStatus" = CASE
  WHEN status = 'IN_PROGRESS' THEN 'STARTED'::"FnbKitchenStatus"
  WHEN status = 'DELIVERED' THEN 'READY'::"FnbKitchenStatus"
  WHEN status = 'COMPLETED' THEN 'SERVED'::"FnbKitchenStatus"
  WHEN status IN ('CANCELLED', 'REFUNDED', 'DISPUTED') THEN 'VOIDED'::"FnbKitchenStatus"
  ELSE 'QUEUED'::"FnbKitchenStatus"
END;

ALTER TABLE "Order" ALTER COLUMN "fulfillmentStatus" SET DEFAULT 'NEW';
ALTER TABLE "Order" ALTER COLUMN "fulfillmentStatus" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "kitchenStatus" SET DEFAULT 'QUEUED';
ALTER TABLE "Order" ALTER COLUMN "kitchenStatus" SET NOT NULL;

ALTER TABLE "OrderItem" ADD COLUMN "fnbStation" TEXT;

CREATE INDEX "Order_storeId_kitchenStatus_idx" ON "Order"("storeId", "kitchenStatus");
