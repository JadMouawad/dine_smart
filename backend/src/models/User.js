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
