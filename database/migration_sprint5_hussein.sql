-- Sprint 5 Hussein Rashid
-- - Reset password support
-- - User health certificate uploads
-- - Owner business license uploads

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_license_url TEXT;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_license_name VARCHAR(255);

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS health_certificate_url TEXT;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS health_certificate_name VARCHAR(255);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at
  ON password_reset_tokens(expires_at);
