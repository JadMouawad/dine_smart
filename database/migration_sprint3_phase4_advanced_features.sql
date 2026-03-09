-- Sprint 3 Phase 4 (Advanced Features)
-- - Events enhancements
-- - Review flagging dedupe + owner responses
-- - Advanced search geo/filter support
-- - Saved searches

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS price_range VARCHAR(4);

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS dietary_support TEXT[] DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurants_price_range_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_price_range_check
      CHECK (price_range IS NULL OR price_range IN ('$', '$$', '$$$', '$$$$'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurants_geo
  ON restaurants(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_restaurants_price_range
  ON restaurants(price_range);

CREATE INDEX IF NOT EXISTS idx_restaurants_dietary_support
  ON restaurants USING GIN(dietary_support);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE events
SET start_date = COALESCE(start_date, event_date),
    end_date = COALESCE(end_date, event_date)
WHERE start_date IS NULL
   OR end_date IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_date_range_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_date_range_check
      CHECK (
        start_date IS NULL
        OR end_date IS NULL
        OR start_date <= end_date
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_restaurant_dates
  ON events(restaurant_id, is_active, start_date, end_date);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS owner_response TEXT;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS owner_response_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  filters_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id
  ON saved_searches(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at
  ON saved_searches(created_at DESC);

WITH ranked_flags AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY review_id, user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM flagged_reviews
)
DELETE FROM flagged_reviews fr
USING ranked_flags rf
WHERE fr.id = rf.id
  AND rf.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flagged_reviews_review_user_unique
  ON flagged_reviews(review_id, user_id);
