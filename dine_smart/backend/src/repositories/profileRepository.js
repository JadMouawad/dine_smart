const pool = require("../config/db");
const User = require("../models/User");

/**
 * Get profile by user ID
 */
const getById = async (userId) => {
  return await User.findById(pool, userId);
};

/**
 * Update user profile (allowlisted fields only)
 * Accepts fullName from API, maps to full_name in DB
 */
const updateById = async (userId, data) => {
  const updates = {};
  if (data.fullName !== undefined) updates.full_name = data.fullName;
  if (data.full_name !== undefined) updates.full_name = data.full_name;

  if (Object.keys(updates).length === 0) {
    return await User.findById(pool, userId);
  }

  const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
  const values = Object.values(updates);
  values.push(userId);

  const query = `
    UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${values.length}
  `;
  await pool.query(query, values);
  return await User.findById(pool, userId);
};

module.exports = {
  getById,
  updateById
};
