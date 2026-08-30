-- Adds a cancelledAt timestamp to PropertyReservation, mirroring
-- checkedInAt/checkedOutAt, so cancellations (and no-shows) are recorded
-- with a timestamp rather than just a status flip.

ALTER TABLE "PropertyReservation" ADD COLUMN "cancelledAt" TIMESTAMP(3);
