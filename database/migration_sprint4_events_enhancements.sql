-- Enhance events and attendee tracking

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS max_attendees INTEGER,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS location_override TEXT;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_attendees_status_check'
  ) THEN
    ALTER TABLE event_attendees
      ADD CONSTRAINT event_attendees_status_check
      CHECK (status IN ('confirmed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
