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

-- Insert default roles
INSERT INTO roles (name) VALUES ('user'), ('owner'), ('admin')
ON CONFLICT DO NOTHING;

UPDATE users
SET role_id = 2
WHERE email = 'carlaayach@gmail.com';

SELECT role_id FROM users WHERE email='carlaayach@gmail.com';

-- Test restaurants for backend search
INSERT INTO restaurants (name, cuisine, description, address, phone, rating)
VALUES
  ('Test Italian Restaurant', 'Italian', 'A cozy Italian place', 'Beirut, Lebanon', '+961 01 234567', 4.5),
  ('Little Italy', 'Italian', 'Famous for pizza and pasta', 'Beirut, Lebanon', '+961 01 234568', 4.2),
  ('Sushi World', 'Japanese', 'Fresh sushi and rolls', 'Beirut, Lebanon', '+961 01 234569', 4.7),
  ('Burger House', 'American', 'Burgers and fries', 'Beirut, Lebanon', '+961 01 234570', 4.0),
  ('Curry Palace', 'Indian', 'Spicy Indian cuisine', 'Beirut, Lebanon', '+961 01 234571', 4.3)
ON CONFLICT DO NOTHING;