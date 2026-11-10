-- Delete the retired Marketing Starter / Marketing Pro plans. A plan a store still points at is left in place
-- (already hidden), so no store ever loses its plan.
DELETE FROM "Subscription" s
WHERE s."name" IN ('Marketing Starter', 'Marketing Pro')
  AND NOT EXISTS (SELECT 1 FROM "Store" st WHERE st."subscriptionId" = s."id");
