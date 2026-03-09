-- Sprint 3 Phase 1 foundation:
-- - Restaurant moderation columns
-- - Reservations and table config tables
-- - Events and flagged reviews tables

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'restaurant_approval_status'
  ) THEN
    CREATE TYPE restaurant_approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS approval_status restaurant_approval_status DEFAULT 'pending';

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);

-- Backfill existing records so current catalog remains visible after status gating.
UPDATE restaurants
SET is_verified = true,
    approval_status = 'approved'
WHERE is_verified = false
  AND approval_status = 'pending';

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  seating_preference VARCHAR(50),
  special_request TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  confirmation_id VARCHAR(20) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reservations_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'no-show', 'completed', 'confirmed'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_datetime
  ON reservations(restaurant_id, reservation_date, reservation_time);

CREATE TABLE IF NOT EXISTS restaurant_table_configs (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
  table_2_person INTEGER DEFAULT 0,
  table_4_person INTEGER DEFAULT 0,
  table_6_person INTEGER DEFAULT 0,
  indoor_capacity INTEGER DEFAULT 0,
  outdoor_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO restaurant_table_configs (
  restaurant_id,
  total_capacity,
  table_2_person,
  table_4_person,
  table_6_person,
  indoor_capacity,
  outdoor_capacity
)
SELECT
  r.id,
  38,
  5,
  5,
  3,
  24,
  14
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1
  FROM restaurant_table_configs rtc
  WHERE rtc.restaurant_id = r.id
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flagged_reviews (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT flagged_reviews_status_check CHECK (status IN ('pending', 'resolved', 'dismissed'))
);
