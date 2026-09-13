-- Rename the hotel storefront template without changing the hotel storefront design,
-- template id, configuration, or existing store assignments.
UPDATE "StoreTemplate"
SET "name" = 'Veloura — Superior Luxury Hotel'
WHERE "name" = 'THELUSO — Superior Luxury Hotel';
