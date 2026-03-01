const pool = require("../config/db");

const createSavedSearch = async ({ userId, name, filtersJson }) => {
  const result = await pool.query(
    `
      INSERT INTO saved_searches (user_id, name, filters_json)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id, user_id, name, filters_json, created_at
    `,
    [userId, name, JSON.stringify(filtersJson)]
  );
  return result.rows[0] || null;
};

const getSavedSearchesByUser = async (userId) => {
  const result = await pool.query(
    `
      SELECT id, user_id, name, filters_json, created_at
      FROM saved_searches
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return result.rows;
};

const deleteSavedSearchById = async ({ userId, savedSearchId }) => {
  const result = await pool.query(
    `
      DELETE FROM saved_searches
      WHERE id = $1
        AND user_id = $2
      RETURNING id, user_id, name
    `,
    [savedSearchId, userId]
  );
  return result.rows[0] || null;
};

module.exports = {
  createSavedSearch,
  getSavedSearchesByUser,
  deleteSavedSearchById,
};
