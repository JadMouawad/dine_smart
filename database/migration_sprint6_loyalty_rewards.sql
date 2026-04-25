-- Loyalty points and rewards system

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_points_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type VARCHAR(20) NOT NULL,
  source_id INTEGER NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_points_ledger_type_check CHECK (source_type IN ('reservation', 'event', 'reward_redeem', 'reservation_cancel', 'event_cancel')),
  CONSTRAINT user_points_ledger_unique UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_user_points_ledger_user_id ON user_points_ledger(user_id);

CREATE TABLE IF NOT EXISTS user_rewards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_code VARCHAR(50) NOT NULL,
  points_spent INTEGER NOT NULL DEFAULT 100,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_rewards_unique UNIQUE (user_id, reward_code)
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id);
