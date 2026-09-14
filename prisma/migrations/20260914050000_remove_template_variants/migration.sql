-- Remove the 16 temporary template variants while preserving the original four templates.
DELETE FROM "StoreTemplate"
WHERE "name" IN (
  'Grandeur — Heritage Dining',
  'Grandeur — Modern Atelier',
  'Grandeur — Midnight Supper Club',
  'Grandeur — Garden Dining',
  'Veloura — Grand Residence',
  'Veloura — Urban Luxe',
  'Veloura — Coastal Retreat',
  'Veloura — Modern Palace',
  'TasteHouse — Street Kitchen',
  'TasteHouse — Fresh Market',
  'TasteHouse — Night Bites',
  'TasteHouse — Family Table',
  'Example — Tech Atelier',
  'Example — Future Lab',
  'Example — Digital Market',
  'Example — Neo Store'
);
