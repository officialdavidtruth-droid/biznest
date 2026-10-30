-- Read-only check: products whose currency differs from their store's currency.
-- Run this BEFORE any backfill. Rewriting Product.currency changes what a price
-- means (20 USD would become 20 NGN), so each mismatch needs a human decision.
SELECT s.slug, s.currency AS store_currency, p.currency AS product_currency, COUNT(*) AS products
FROM "Product" p
JOIN "Store" s ON s.id = p."storeId"
WHERE p.currency <> s.currency
GROUP BY s.slug, s.currency, p.currency
ORDER BY products DESC;
