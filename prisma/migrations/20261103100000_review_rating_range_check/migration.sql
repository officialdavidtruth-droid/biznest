-- Review.rating is documented as 1-5 but nothing enforced it, so a bad value
-- could be stored and later crash pages that render stars from it.
--
-- NOT VALID: the constraint is enforced for every new insert and any update that
-- touches a row, but existing rows are not scanned. That keeps this migration
-- from failing the deploy (the build runs `prisma migrate deploy`) if legacy bad
-- data exists, and it never silently rewrites anyone's ratings.
--
-- To also validate old rows, after checking for bad data:
--   SELECT id, rating FROM "Review" WHERE rating NOT BETWEEN 1 AND 5;
--   -- fix or delete those rows, then:
--   ALTER TABLE "Review" VALIDATE CONSTRAINT "Review_rating_range_check";
--   -- then re-sync the stored averages: npx tsx prisma/backfill-business-ratings.ts
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range_check" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
