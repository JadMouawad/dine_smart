-- Sprint 3 Phase 5: persist user location for distance-based restaurant features

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

CREATE INDEX IF NOT EXISTS idx_users_geo ON users(latitude, longitude);
