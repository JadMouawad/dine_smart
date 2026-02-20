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
  password VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cuisine VARCHAR(50),
  description TEXT,
  address VARCHAR(255),
  phone VARCHAR(30),
  rating DECIMAL(3,2) DEFAULT 0,
  owner_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name) VALUES ('user'), ('owner'), ('admin')
ON CONFLICT DO NOTHING;

UPDATE users
SET role_id = 2
WHERE email = 'carla@gmail.com';

SELECT role_id FROM users WHERE email='carla@gmail.com';


