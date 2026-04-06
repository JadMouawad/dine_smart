-- Sprint 5: Recent searches per user account
-- Stores the last N search queries per user, synced across devices.

CREATE TABLE IF NOT EXISTS recent_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query VARCHAR(255) NOT NULL,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recent_searches_unique UNIQUE (user_id, query)
);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user_id ON recent_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_searches_searched_at ON recent_searches(searched_at DESC);
