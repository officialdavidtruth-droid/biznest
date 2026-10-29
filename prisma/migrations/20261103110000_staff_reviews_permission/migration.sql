-- Reviews used to sit behind the "marketing" staff permission, which doesn't
-- describe it. It now has its own "reviews" permission (see
-- lib/access/staff-permissions.ts and lib/constants/dashboard-nav.ts).
--
-- Grant it to every existing staff member (including pending invites) who has
-- "marketing" today, so nobody gains or loses access to the Reviews page on
-- deploy. Owners can then adjust it per person from the staff screen.
UPDATE "StoreStaff"
SET "permissions" = array_append("permissions", 'reviews')
WHERE 'marketing' = ANY("permissions")
  AND NOT ('reviews' = ANY("permissions"));
