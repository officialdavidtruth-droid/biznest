-- Closes the double-booking race window in createBooking (lib/actions/booking.ts).
--
-- That action checked for a conflicting booking with findFirst, then created
-- the new one in a *separate* statement. Two requests arriving close enough
-- together (two customers tapping "Confirm" on the same slot within
-- milliseconds of each other) could both pass the check before either had
-- finished the create, producing two active bookings for the same
-- service+staff+time. No amount of re-checking in application code closes
-- that gap -- only a database constraint can, because Postgres serializes
-- concurrent writes against the same index entry and rejects the loser.
--
-- Scoped to staffId IS NOT NULL: a specific staff member can only be in one
-- place at a time, so that's a genuine 1-slot resource. A NULL staffId
-- represents the unassigned queue, which has no such 1-person constraint
-- (the business may have several people who could take it), so it keeps
-- relying on the existing application-level check rather than being forced
-- into a false single-slot limit here.
--
-- Partial (WHERE status <> 'CANCELLED'): a cancelled booking must not keep
-- blocking the slot it used to occupy.
--
-- Idempotent so re-running this migration (or applying it after the index
-- already exists via a hotfix) doesn't fail the deploy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'Booking_staff_slot_unique'
  ) THEN
    CREATE UNIQUE INDEX "Booking_staff_slot_unique"
      ON "Booking" ("serviceId", "staffId", "scheduledAt")
      WHERE "status" <> 'CANCELLED' AND "staffId" IS NOT NULL;
  END IF;
END $$;
