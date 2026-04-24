-- Performance indexes for reservation/search hot paths.
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_reservations_slot_active
  ON reservations (restaurant_id, reservation_date, reservation_time)
  WHERE status IN ('pending', 'accepted', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_created_recent
  ON reservations (restaurant_id, created_at DESC)
  WHERE status IN ('accepted', 'confirmed', 'completed');

CREATE INDEX IF NOT EXISTS idx_events_active_end_date
  ON events (restaurant_id, end_date)
  WHERE is_active = true;
