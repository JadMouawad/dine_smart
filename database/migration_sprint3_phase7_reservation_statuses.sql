-- Sprint 3 Phase 7:
-- Reservation workflow statuses for owner moderation.
-- Upcoming owner queue uses pending/accepted; past uses rejected/cancelled/expired.

ALTER TABLE reservations
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'no-show', 'completed', 'confirmed'));

