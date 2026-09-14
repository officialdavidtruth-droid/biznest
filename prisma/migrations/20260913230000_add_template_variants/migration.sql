INSERT INTO "StoreTemplate" ("id","name","category","previewUrl","tierRank","isActive","config","createdAt") VALUES
('grandeur-heritage','Grandeur — Heritage Dining','Restaurant',NULL,3,true,'{"family":"restaurant","variant":2,"layout":"split"}',CURRENT_TIMESTAMP),
('grandeur-atelier','Grandeur — Modern Atelier','Restaurant',NULL,3,true,'{"family":"restaurant","variant":3,"layout":"asymmetric"}',CURRENT_TIMESTAMP),
('grandeur-midnight','Grandeur — Midnight Supper Club','Restaurant',NULL,3,true,'{"family":"restaurant","variant":4,"layout":"cinematic"}',CURRENT_TIMESTAMP),
('grandeur-garden','Grandeur — Garden Dining','Restaurant',NULL,3,true,'{"family":"restaurant","variant":5,"layout":"garden"}',CURRENT_TIMESTAMP),
('veloura-residence','Veloura — Grand Residence','Hotel',NULL,3,true,'{"family":"hotel","variant":2,"layout":"residence"}',CURRENT_TIMESTAMP),
('veloura-urban','Veloura — Urban Luxe','Hotel',NULL,3,true,'{"family":"hotel","variant":3,"layout":"urban"}',CURRENT_TIMESTAMP),
('veloura-coastal','Veloura — Coastal Retreat','Hotel',NULL,3,true,'{"family":"hotel","variant":4,"layout":"coastal"}',CURRENT_TIMESTAMP),
('veloura-palace','Veloura — Modern Palace','Hotel',NULL,3,true,'{"family":"hotel","variant":5,"layout":"palace"}',CURRENT_TIMESTAMP),
('tastehouse-street','TasteHouse — Street Kitchen','Restaurant',NULL,3,true,'{"family":"food","variant":2,"layout":"street"}',CURRENT_TIMESTAMP),
('tastehouse-market','TasteHouse — Fresh Market','Restaurant',NULL,3,true,'{"family":"food","variant":3,"layout":"market"}',CURRENT_TIMESTAMP),
('tastehouse-night','TasteHouse — Night Bites','Restaurant',NULL,3,true,'{"family":"food","variant":4,"layout":"night"}',CURRENT_TIMESTAMP),
('tastehouse-family','TasteHouse — Family Table','Restaurant',NULL,3,true,'{"family":"food","variant":5,"layout":"family"}',CURRENT_TIMESTAMP),
('example-atelier','Example — Tech Atelier','Electronics & Retail',NULL,2,true,'{"family":"retail","variant":2,"layout":"atelier"}',CURRENT_TIMESTAMP),
('example-lab','Example — Future Lab','Electronics & Retail',NULL,2,true,'{"family":"retail","variant":3,"layout":"lab"}',CURRENT_TIMESTAMP),
('example-market','Example — Digital Market','Electronics & Retail',NULL,2,true,'{"family":"retail","variant":4,"layout":"market"}',CURRENT_TIMESTAMP),
('example-neo','Example — Neo Store','Electronics & Retail',NULL,2,true,'{"family":"retail","variant":5,"layout":"neo"}',CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "category"=EXCLUDED."category","tierRank"=EXCLUDED."tierRank","isActive"=true,"config"=EXCLUDED."config";
