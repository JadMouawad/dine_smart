-- Waitlist for reservation slots
CREATE TABLE IF NOT EXISTS reservation_waitlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_waitlist_status_check CHECK (status IN ('pending', 'notified', 'cancelled')),
  CONSTRAINT reservation_waitlist_unique UNIQUE (user_id, restaurant_id, reservation_date, reservation_time)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_slot_pending
  ON reservation_waitlist(restaurant_id, reservation_date, reservation_time, status);
