const pool = require("../config/db");

const add = async (jti, expiresAt) => {
  await pool.query(
    `INSERT INTO token_blacklist (jti, expires_at)
     VALUES ($1, $2)
     ON CONFLICT (jti) DO UPDATE
     SET expires_at = GREATEST(token_blacklist.expires_at, EXCLUDED.expires_at)`,
    [jti, new Date(expiresAt * 1000)]
  );
};

const isBlacklisted = async (jti) => {
  try {
    const result = await pool.query(
      `SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW()`,
      [jti]
    );
    return result.rows.length > 0;
  } catch (error) {
    error.message = `Unable to verify token blacklist state: ${error.message}`;
    throw error;
  }
};

const deleteExpired = async () => {
  await pool.query(`DELETE FROM token_blacklist WHERE expires_at <= NOW()`);
};

module.exports = { add, isBlacklisted, deleteExpired };
