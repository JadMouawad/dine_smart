-- Add no-show tracking and temporary bans
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_until DATE;
