INSERT INTO "StoreTemplate" ("id","name","category","tierRank","isActive","config","createdAt","updatedAt")
VALUES ('tastehouse-template','TasteHouse — Food Delivery','Restaurant',3,true,'{}','2026-09-12 00:00:00','2026-09-12 00:00:00')
ON CONFLICT ("name") DO UPDATE SET "category"='Restaurant',"tierRank"=3,"isActive"=true;
