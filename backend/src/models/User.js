/**
 * User Model - Database operations for users table
 * Handles user registration, login, profile retrieval
 */

// Find user by email
const findByEmail = async (db, email) => {
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await db.query(query, [email]);
  return result.rows[0] || null;
};

// Find user by ID
const findById = async (db, id) => {
  const query = "SELECT id, full_name, email, role_id, created_at, updated_at FROM users WHERE id = $1";
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

// Create new user
const create = async (db, { fullName, email, password, roleId = 3 }) => {
  const query = `
    INSERT INTO users (full_name, email, password, role_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, full_name, email, role_id, created_at, updated_at
  `;
  const result = await db.query(query, [fullName, email, password, roleId]);
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
  const query = "SELECT * FROM users WHERE google_id = $1";
  const result = await db.query(query, [googleId]);
  return result.rows[0] || null;
};

// Create a new OAuth user (no password)
const createOAuthUser = async (db, { fullName, email, googleId, roleId = 3 }) => {
  const query = `
    INSERT INTO users (full_name, email, google_id, role_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, full_name, email, role_id, created_at, updated_at
  `;
  const result = await db.query(query, [fullName, email, googleId, roleId]);
  return result.rows[0];
};

// Link a Google ID to an existing email-registered account
const linkGoogleId = async (db, userId, googleId) => {
  const query = `
    UPDATE users SET google_id = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, full_name, email, role_id, created_at, updated_at
  `;
  const result = await db.query(query, [googleId, userId]);
  return result.rows[0];
};

module.exports = {
  findByEmail,
  findById,
  create,
  findByEmailWithPassword,
  findByGoogleId,
  createOAuthUser,
  linkGoogleId
};
