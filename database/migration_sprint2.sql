-- Sprint 2: reviews table, restaurant hours, user profile fields, token blacklist

-- 1. Reviews table (for restaurant reviews and ratings)
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_restaurant ON reviews(user_id, restaurant_id);

-- 2. Restaurant opening/closing time (if columns missing)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS opening_time VARCHAR(20);
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS closing_time VARCHAR(20);

-- 3. User profile: phone and profile picture URL
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 4. Logout token blacklist (invalidate JWT on logout; uses jti from token)
CREATE TABLE IF NOT EXISTS token_blacklist (
  id SERIAL PRIMARY KEY,
  jti VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
