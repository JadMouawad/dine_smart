-- Migration: Add profile/auth/verification support
-- Run this against your existing database before deploying backend changes.
-- Safe to run multiple times (uses IF NOT EXISTS guards).

-- 1. Add is_verified to users (default true for existing users)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;

-- 2. Add provider to users ('local' | 'google')
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'local';

-- 3. Set provider for existing users based on google_id
UPDATE users SET provider = 'google' WHERE google_id IS NOT NULL;
UPDATE users SET provider = 'local' WHERE google_id IS NULL OR provider IS NULL;

-- 4. Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);
