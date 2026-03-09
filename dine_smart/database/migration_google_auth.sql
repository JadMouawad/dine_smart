-- Migration: Add Google OAuth support
-- Run this against your existing database BEFORE deploying backend changes.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).

-- 1. Add google_id column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- 2. Make password nullable (OAuth users have no password)
ALTER TABLE users
  ALTER COLUMN password DROP NOT NULL;

-- 3. Index for fast google_id lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id)
  WHERE google_id IS NOT NULL;
