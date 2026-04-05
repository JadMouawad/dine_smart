-- DineSmart PostgreSQL schema

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_name_check CHECK (name IN ('user', 'owner', 'admin'))
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),                        -- nullable: OAuth users have no password
  google_id VARCHAR(255) UNIQUE,                -- Google subject ID for OAuth users
  role_id INTEGER NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
  is_verified BOOLEAN DEFAULT true,             -- false until email verified (local users)
  provider VARCHAR(20) DEFAULT 'local',         -- 'local' | 'google'
  is_suspended BOOLEAN DEFAULT false,
  suspended_at TIMESTAMPTZ,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  banned_until DATE,
  phone VARCHAR(30),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  profile_picture_url TEXT,
  is_subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_preferences TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_updates (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  update_type VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurant_updates_type_check CHECK (update_type IN ('news', 'offers'))
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'restaurant_approval_status'
  ) THEN
    CREATE TYPE restaurant_approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cuisine VARCHAR(50),
  description TEXT,
  address VARCHAR(255),
  phone VARCHAR(30),
  rating DECIMAL(3,2) DEFAULT 0,
  owner_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  opening_time VARCHAR(20),
  closing_time VARCHAR(20),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  price_range VARCHAR(4),
  dietary_support TEXT[] DEFAULT ARRAY[]::TEXT[],
  logo_url TEXT,
  cover_url TEXT,
  gallery_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_verified BOOLEAN DEFAULT false,
  approval_status restaurant_approval_status DEFAULT 'pending',
  rejection_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurants_price_range_check
    CHECK (price_range IS NULL OR price_range IN ('$', '$$', '$$$', '$$$$'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment VARCHAR(500),
  owner_response TEXT,
  owner_response_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_restaurant ON reviews(user_id, restaurant_id);

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  seating_preference VARCHAR(50),
  special_request TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  confirmation_id VARCHAR(20) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reservations_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'no-show', 'completed', 'confirmed'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_datetime
  ON reservations(restaurant_id, reservation_date, reservation_time);
CREATE INDEX IF NOT EXISTS idx_waitlist_slot_pending
  ON reservation_waitlist(restaurant_id, reservation_date, reservation_time, status);

CREATE TABLE IF NOT EXISTS restaurant_table_configs (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
  table_2_person INTEGER DEFAULT 0,
  table_4_person INTEGER DEFAULT 0,
  table_6_person INTEGER DEFAULT 0,
  indoor_capacity INTEGER DEFAULT 0,
  outdoor_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservation_slot_adjustments (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  seating_preference VARCHAR(50) NOT NULL DEFAULT 'any',
  adjustment INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reservation_slot_adjustments_preference_check CHECK (seating_preference IN ('any', 'indoor', 'outdoor')),
  CONSTRAINT reservation_slot_adjustments_unique UNIQUE (restaurant_id, reservation_date, reservation_time, seating_preference)
);

CREATE TABLE IF NOT EXISTS reservation_waitlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_waitlist_status_check CHECK (status IN ('pending', 'notified', 'cancelled')),
  CONSTRAINT reservation_waitlist_unique UNIQUE (user_id, restaurant_id, reservation_date, reservation_time)
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url TEXT,
  event_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  max_attendees INTEGER,
  is_free BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC(10,2),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  location_override TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT events_date_range_check CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendees_count INTEGER NOT NULL DEFAULT 1,
  seating_preference VARCHAR(20) NOT NULL DEFAULT 'any',
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_attendees_seating_check CHECK (seating_preference IN ('any', 'indoor', 'outdoor')),
  CONSTRAINT event_attendees_status_check CHECK (status IN ('confirmed', 'cancelled')),
  CONSTRAINT event_attendees_unique UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_events (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS flagged_reviews (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT flagged_reviews_status_check CHECK (status IN ('pending', 'resolved', 'dismissed')),
  CONSTRAINT flagged_reviews_review_user_unique UNIQUE (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  filters_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_geo ON restaurants(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_restaurants_price_range ON restaurants(price_range);
CREATE INDEX IF NOT EXISTS idx_restaurants_dietary_support ON restaurants USING GIN(dietary_support);
CREATE INDEX IF NOT EXISTS idx_events_restaurant_dates ON events(restaurant_id, is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON saved_events(event_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON saved_searches(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- Insert default roles
INSERT INTO roles (name) VALUES ('user'), ('owner'), ('admin')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings (key, value_json)
VALUES ('ai_chat_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;



-- User favorites (restaurant bookmarks)
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, restaurant_id)
);

-- JWT token blacklist (for logout invalidation)
CREATE TABLE IF NOT EXISTS token_blacklist (
  jti        VARCHAR(36) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- AI conversation logs
CREATE TABLE IF NOT EXISTS ai_conversation_logs (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_message       TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  latency_ms         INTEGER NOT NULL DEFAULT 0,
  model_provider     VARCHAR(80) NOT NULL,
  model_name         VARCHAR(120) NOT NULL,
  request_context    JSONB,
  response_metadata  JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_created_at ON ai_conversation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_user_id ON ai_conversation_logs(user_id);
