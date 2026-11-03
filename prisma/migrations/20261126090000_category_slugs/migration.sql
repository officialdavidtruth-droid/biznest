-- Category slugs: readable /category/<slug> URLs instead of /category/<cuid>. Additive and idempotent (safe to re-run).

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- 1) Backfill: slugify the name; the first category with a given slug in a store keeps it, later ones get -2, -3 ...
WITH base AS (
  SELECT
    c."id",
    c."storeId",
    c."createdAt",
    COALESCE(
      NULLIF(LEFT(TRIM(BOTH '-' FROM REGEXP_REPLACE(REPLACE(LOWER(c."name"), '&', ' and '), '[^a-z0-9]+', '-', 'g')), 60), ''),
      'category'
    ) AS b
  FROM "Category" c
  WHERE c."slug" IS NULL AND c."storeId" IS NOT NULL
),
ranked AS (
  SELECT "id", b, ROW_NUMBER() OVER (PARTITION BY "storeId", b ORDER BY "createdAt", "id") AS rn
  FROM base
)
UPDATE "Category" c
SET "slug" = CASE WHEN r.rn = 1 THEN r.b ELSE r.b || '-' || r.rn END
FROM ranked r
WHERE c."id" = r."id";

-- 2) Safety net: if a generated "-2" collided with a real "...-2" name, make the later row unique with its id tail,
--    so the unique index below can never fail a deploy.
WITH dupes AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "storeId", "slug" ORDER BY "createdAt", "id") AS rn
  FROM "Category"
  WHERE "storeId" IS NOT NULL AND "slug" IS NOT NULL
)
UPDATE "Category" c
SET "slug" = c."slug" || '-' || RIGHT(c."id", 5)
FROM dupes d
WHERE c."id" = d."id" AND d.rn > 1;

-- 3) One slug per store (rows with a NULL storeId or NULL slug are not constrained).
CREATE UNIQUE INDEX IF NOT EXISTS "Category_storeId_slug_key" ON "Category"("storeId", "slug");
