-- Template reset: remove every legacy storefront template and leave only the
-- newly approved Grandeur Restaurant template. Store.templateId is nullable,
-- so old assignments are cleared before the legacy rows are deleted.

INSERT INTO "StoreTemplate" (
  "id", "name", "category", "previewUrl", "config", "tierRank", "isActive", "createdAt"
)
VALUES (
  'grandeur-template-v1',
  'Grandeur — Fine Dining Restaurant',
  'Restaurant',
  NULL,
  '{"variationName":"Grandeur — Fine Dining Restaurant","tierRank":3,"bg":"#F7F1E8","ink":"#1D1712","card":"#FFFDF9","accent":"#C8944A","accentSoft":"#D9AD68","muted":"#746B63","border":"#E7DED3","font":"''Inter'', sans-serif","headlineFont":"''Playfair Display'', Georgia, serif","radius":"18px","eyebrow":"FINE DINING • GREAT COMPANY","headline":"Exceptional Taste, Memorable Moments","sub":"A premium restaurant experience built around dining, reservations, ordering and a complete customer journey.","cta":"View Our Menu","layout":"list","heroStyle":"fullbleed","catalogLabel":"Popular Dishes","density":"relaxed","surfaceDark":"#0D0A07","sections":["hero","categories","catalog","features","about","gallery","testimonials","contact","newsletter"]}'::jsonb,
  3,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET
  "category" = EXCLUDED."category",
  "config" = EXCLUDED."config",
  "tierRank" = EXCLUDED."tierRank",
  "isActive" = true;

UPDATE "Store"
SET "templateId" = NULL
WHERE "templateId" IS NOT NULL
  AND "templateId" <> (SELECT "id" FROM "StoreTemplate" WHERE "name" = 'Grandeur — Fine Dining Restaurant' LIMIT 1);

DELETE FROM "StoreTemplate"
WHERE "name" <> 'Grandeur — Fine Dining Restaurant';
