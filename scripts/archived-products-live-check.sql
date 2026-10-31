-- Read-only check: products that are archived (hidden "deleted" products kept for order and
-- stock history) but still published. Before the fix in lib/actions/product.ts, a restock
-- (purchase-order receipt, refund or stock adjustment) could republish an archived product
-- whose out-of-stock automation flag was still set. The storefront filtered on isPublished
-- only, so such a product was live while the admin list showed it as "Archived".
SELECT s.slug, p.id, p.name, p."archivedAt"
FROM "Product" p
JOIN "Store" s ON s.id = p."storeId"
WHERE p."archivedAt" IS NOT NULL AND p."isPublished" = true
ORDER BY s.slug, p.name;

-- Review the rows above first. If they should stay hidden (archived means hidden), run:
-- UPDATE "Product" SET "isPublished" = false WHERE "archivedAt" IS NOT NULL AND "isPublished" = true;
-- UPDATE "InventoryItem" SET "autoUnpublished" = false
--   WHERE "productId" IN (SELECT id FROM "Product" WHERE "archivedAt" IS NOT NULL);
-- UPDATE "ProductVariant" SET "autoUnpublished" = false
--   WHERE "productId" IN (SELECT id FROM "Product" WHERE "archivedAt" IS NOT NULL);
