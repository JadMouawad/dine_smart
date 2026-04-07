-- Vouchers for rewards redemption

CREATE TABLE IF NOT EXISTS vouchers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discount_percentage SMALLINT NOT NULL DEFAULT 10,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  unique_code VARCHAR(40) NOT NULL UNIQUE,
  expiration_date DATE NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vouchers_status_check CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_vouchers_user_id ON vouchers(user_id);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_percentage SMALLINT;
