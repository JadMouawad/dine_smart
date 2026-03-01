const pool = require("../config/db");

/**
 * Create verification token for user
 */
const create = async (userId, token, expiresAt) => {
  const query = `
    INSERT INTO email_verification_tokens (user_id, token, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, token, expires_at, created_at
  `;
  const result = await pool.query(query, [userId, token, expiresAt]);
  return result.rows[0];
};

/**
 * Find token (non-expired)
 */
const findByToken = async (token) => {
  const query = `
    SELECT evt.*, u.email, u.full_name
    FROM email_verification_tokens evt
    JOIN users u ON evt.user_id = u.id
    WHERE evt.token = $1 AND evt.expires_at > NOW()
  `;
  const result = await pool.query(query, [token]);
  return result.rows[0] || null;
};

/**
 * Find token (including expired, for error messages)
 */
const findByTokenAny = async (token) => {
  const query = `
    SELECT evt.*, u.email, u.full_name
    FROM email_verification_tokens evt
    JOIN users u ON evt.user_id = u.id
    WHERE evt.token = $1
  `;
  const result = await pool.query(query, [token]);
  return result.rows[0] || null;
};

/**
 * Delete token by id
 */
const deleteById = async (id) => {
  const query = `DELETE FROM email_verification_tokens WHERE id = $1`;
  await pool.query(query, [id]);
};

/**
 * Delete token by token string
 */
const deleteByToken = async (token) => {
  const query = `DELETE FROM email_verification_tokens WHERE token = $1`;
  await pool.query(query, [token]);
};

module.exports = {
  create,
  findByToken,
  findByTokenAny,
  deleteById,
  deleteByToken
};
