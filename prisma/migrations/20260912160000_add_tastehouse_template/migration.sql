INSERT INTO "StoreTemplate" ("id","name","category","previewUrl","tierRank","isActive","config","createdAt")
VALUES ('tastehouse-template','TasteHouse — Food Delivery','Restaurant',NULL,3,true,'{}',CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "category"='Restaurant',"tierRank"=3,"isActive"=true;