-- Migration: Add certificate_verified column to restaurants
-- Decouples health certificate badge from platform approval (is_verified)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS certificate_verified BOOLEAN NOT NULL DEFAULT false;
