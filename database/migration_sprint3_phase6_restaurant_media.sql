-- Sprint 3 Phase 6:
-- Persist restaurant profile media (logo and background image)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
