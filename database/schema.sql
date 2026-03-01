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
  phone VARCHAR(30),
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  is_verified BOOLEAN DEFAULT false,
  approval_status restaurant_approval_status DEFAULT 'pending',
  rejection_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  seating_preference VARCHAR(50),
  special_request TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  confirmation_id VARCHAR(20) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reservations_status_check CHECK (status IN ('confirmed', 'cancelled', 'no-show', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_datetime
  ON reservations(restaurant_id, reservation_date, reservation_time);

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

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  CONSTRAINT flagged_reviews_status_check CHECK (status IN ('pending', 'resolved', 'dismissed'))
);

-- Insert default roles
INSERT INTO roles (name) VALUES ('user'), ('owner'), ('admin')
ON CONFLICT DO NOTHING;

UPDATE users
SET role_id = 2
WHERE email = 'carlaayach@gmail.com';

SELECT role_id FROM users WHERE email='carlaayach@gmail.com';

-- Test restaurants for backend search
INSERT INTO restaurants (name, cuisine, description, address, phone, rating, is_verified, approval_status)
VALUES
  ('Test Italian Restaurant', 'Italian', 'A cozy Italian place', 'Beirut, Lebanon', '+961 01 234567', 4.5, true, 'approved'),
  ('Little Italy', 'Italian', 'Famous for pizza and pasta', 'Beirut, Lebanon', '+961 01 234568', 4.2, true, 'approved'),
  ('Sushi World', 'Japanese', 'Fresh sushi and rolls', 'Beirut, Lebanon', '+961 01 234569', 4.7, true, 'approved'),
  ('Burger House', 'American', 'Burgers and fries', 'Beirut, Lebanon', '+961 01 234570', 4.0, true, 'approved'),
  ('Curry Palace', 'Indian', 'Spicy Indian cuisine', 'Beirut, Lebanon', '+961 01 234571', 4.3, true, 'approved')
ON CONFLICT DO NOTHING;

INSERT INTO restaurant_table_configs (
  restaurant_id,
  total_capacity,
  table_2_person,
  table_4_person,
  table_6_person,
  indoor_capacity,
  outdoor_capacity
)
SELECT
  r.id,
  38,
  5,
  5,
  3,
  24,
  14
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1
  FROM restaurant_table_configs rtc
  WHERE rtc.restaurant_id = r.id
);
