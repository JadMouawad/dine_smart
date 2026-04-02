CREATE TABLE IF NOT EXISTS reservation_disabled_slots (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  seating_preference TEXT NOT NULL DEFAULT 'any',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_disabled_slots_preference_check CHECK (seating_preference IN ('any', 'indoor', 'outdoor')),
  CONSTRAINT reservation_disabled_slots_unique UNIQUE (restaurant_id, reservation_date, reservation_time, seating_preference)
);

CREATE INDEX IF NOT EXISTS idx_reservation_disabled_slots_lookup
  ON reservation_disabled_slots (restaurant_id, reservation_date, reservation_time);