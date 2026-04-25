-- Add 'no-show' to event_attendees status constraint
ALTER TABLE event_attendees
  DROP CONSTRAINT IF EXISTS event_attendees_status_check;

ALTER TABLE event_attendees
  ADD CONSTRAINT event_attendees_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'no-show'));
