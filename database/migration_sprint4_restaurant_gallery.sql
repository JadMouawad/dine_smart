-- Sprint 4:
-- Persist multiple restaurant gallery photos

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT ARRAY[]::TEXT[];
