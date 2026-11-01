-- Hotel and restaurant gallery editors stored their content in the StorePage row with slug "gallery", the same
-- slug as the owner's written Gallery page, so saving one overwrote the other.
-- Template gallery content now lives under "template-gallery". Rows with slug "gallery" that have no text body
-- are template content (owner text pages always carry a "body"), so they are renamed. Run this before or with
-- the deploy of the matching code, otherwise template galleries briefly show their defaults.
UPDATE "StorePage" AS p
SET "slug" = 'template-gallery'
WHERE p."slug" = 'gallery'
  AND NOT (p."content"::jsonb ? 'body')
  AND p."content"::jsonb <> '{"blocks": []}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM "StorePage" t WHERE t."storeId" = p."storeId" AND t."slug" = 'template-gallery'
  );
