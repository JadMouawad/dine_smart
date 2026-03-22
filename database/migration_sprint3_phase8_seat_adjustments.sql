-- Add manual seat adjustments per reservation slot
CREATE TABLE IF NOT EXISTS reservation_slot_adjustments (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  seating_preference VARCHAR(50) NOT NULL DEFAULT 'any',
  adjustment INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reservation_slot_adjustments_preference_check CHECK (seating_preference IN ('any', 'indoor', 'outdoor')),
  CONSTRAINT reservation_slot_adjustments_unique UNIQUE (restaurant_id, reservation_date, reservation_time, seating_preference)
);
