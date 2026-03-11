/**
 * User Model - Database operations for users table
 * Handles user registration, login, profile retrieval
 */

// Find user by email
const findByEmail = async (db, email) => {
  const query = `
  SELECT u.*, r.name AS role
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.email = $1
`;

  const result = await db.query(query, [email]);
  return result.rows[0] || null;
};

// Find user by ID
const findById = async (db, id) => {
  const query = `
    SELECT u.id, u.full_name, u.email, u.role_id, u.is_verified, u.provider, u.is_suspended, u.suspended_at,
           u.phone, u.latitude, u.longitude, u.profile_picture_url, u.created_at, u.updated_at, r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

// Find user by phone
const findByPhone = async (db, phone) => {
  const query = `
    SELECT u.*, r.name AS role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.phone = $1
  `;
  const result = await db.query(query, [phone]);
  return result.rows[0] || null;
};

// Create new user (local registration: provider=local, is_verified=false until email verified)
const create = async (db, {
  fullName,
  email,
  password,
  roleId = 1,
  latitude = null,
  longitude = null,
  phone = null,
}) => {
  const query = `
    INSERT INTO users (full_name, email, password, role_id, provider, is_verified, latitude, longitude, phone)
    VALUES ($1, $2, $3, $4, 'local', false, $5, $6, $7)
    RETURNING id, full_name, email, role_id, is_verified, provider, is_suspended, suspended_at, latitude, longitude, phone, created_at, updated_at
  `;
  const result = await db.query(query, [fullName, email, password, roleId, latitude, longitude, phone]);
  return result.rows[0];
};

// Get user by email with password (for authentication)
const findByEmailWithPassword = async (db, email) => {
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await db.query(query, [email]);
  return result.rows[0] || null;
};

// Find user by Google subject ID
const findByGoogleId = async (db, googleId) => {
  const query = `
    SELECT u.*, r.name AS role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.google_id = $1
  `;
  const result = await db.query(query, [googleId]);
  return result.rows[0] || null;
};

// Create a new OAuth user (no password, provider=google, is_verified=true)
const createOAuthUser = async (db, { fullName, email, googleId, roleId = 1 }) => {
  const insertQuery = `
    INSERT INTO users (full_name, email, google_id, role_id, provider, is_verified)
    VALUES ($1, $2, $3, $4, 'google', true)
    RETURNING id
  `;
  const insertResult = await db.query(insertQuery, [fullName, email, googleId, roleId]);
  const newId = insertResult.rows[0].id;
  return findById(db, newId);
};

// Link a Google ID to an existing email-registered account (mark verified)
const linkGoogleId = async (db, userId, googleId) => {
  const query = `
    UPDATE users SET google_id = $1, provider = 'google', is_verified = true, updated_at = NOW()
    WHERE id = $2
    RETURNING id
  `;
  const result = await db.query(query, [googleId, userId]);
  return findById(db, result.rows[0].id);
};

// Mark user as verified (for email verification flow)
const markVerified = async (db, userId) => {
  const query = `
    UPDATE users SET is_verified = true, updated_at = NOW()
    WHERE id = $1
    RETURNING id, full_name, email, role_id, is_verified, provider, is_suspended, suspended_at, latitude, longitude, created_at, updated_at
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0] || null;
};

module.exports = {
  findByEmail,
  findByPhone,
  findById,
  create,
  findByEmailWithPassword,
  findByGoogleId,
  createOAuthUser,
  linkGoogleId,
  markVerified
};
