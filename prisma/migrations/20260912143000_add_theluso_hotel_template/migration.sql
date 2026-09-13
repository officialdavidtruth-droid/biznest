INSERT INTO "StoreTemplate" ("id","name","category","previewUrl","config","tierRank","isActive","createdAt")
VALUES ('theluso-hotel-template-v1','THELUSO — Superior Luxury Hotel','Hotel',NULL,
'{"variationName":"THELUSO — Superior Luxury Hotel","tierRank":3,"bg":"#F7F4EE","ink":"#152534","card":"#FFFFFF","accent":"#C88D3B","accentSoft":"#E0AE64","muted":"#6F7479","border":"#E4E1DA","font":"''Inter'', sans-serif","headlineFont":"Georgia, serif","radius":"6px","eyebrow":"SUPERIOR LUXURY","headline":"More Than a Stay","sub":"Elegant spaces. Exceptional service. Unforgettable experiences.","cta":"Book Your Stay","layout":"grid","heroStyle":"fullbleed","catalogLabel":"Rooms & Suites","density":"relaxed","surfaceDark":"#04131B","sections":["hero","availability","catalog","features","amenities","gallery","testimonials","contact","newsletter"]}'::jsonb,
3,true,CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "category"=EXCLUDED."category","config"=EXCLUDED."config","tierRank"=EXCLUDED."tierRank","isActive"=true;
UPDATE "Store" s SET "templateId"=(SELECT "id" FROM "StoreTemplate" WHERE "name"='THELUSO — Superior Luxury Hotel' LIMIT 1)
WHERE lower(coalesce(s."businessType",'')) LIKE '%hotel%';
