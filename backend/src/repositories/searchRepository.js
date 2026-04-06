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

// ── Recent Searches ────────────────────────────────────────────────────────

const MAX_RECENT = 5;

const upsertRecentSearch = async ({ userId, query }) => {
  await pool.query(
    `
      INSERT INTO recent_searches (user_id, query, searched_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, query)
      DO UPDATE SET searched_at = NOW()
    `,
    [userId, query]
  );

  // Keep only the most recent MAX_RECENT entries
  await pool.query(
    `
      DELETE FROM recent_searches
      WHERE user_id = $1
        AND id NOT IN (
          SELECT id FROM recent_searches
          WHERE user_id = $1
          ORDER BY searched_at DESC
          LIMIT $2
        )
    `,
    [userId, MAX_RECENT]
  );
};

const getRecentSearchesByUser = async (userId) => {
  const result = await pool.query(
    `
      SELECT id, query, searched_at
      FROM recent_searches
      WHERE user_id = $1
      ORDER BY searched_at DESC
      LIMIT $2
    `,
    [userId, MAX_RECENT]
  );
  return result.rows;
};

const deleteRecentSearchById = async ({ userId, searchId }) => {
  const result = await pool.query(
    `DELETE FROM recent_searches WHERE id = $1 AND user_id = $2 RETURNING id`,
    [searchId, userId]
  );
  return result.rows[0] || null;
};

const clearRecentSearchesByUser = async (userId) => {
  await pool.query(`DELETE FROM recent_searches WHERE user_id = $1`, [userId]);
};

// ── Search History (full, unlimited) ──────────────────────────────────────

const upsertSearchHistory = async ({ userId, query }) => {
  await pool.query(
    `INSERT INTO search_history (user_id, query, searched_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, query)
     DO UPDATE SET searched_at = NOW()`,
    [userId, query]
  );
};

const getSearchHistoryByUser = async (userId) => {
  const result = await pool.query(
    `SELECT id, query, searched_at
     FROM search_history
     WHERE user_id = $1
     ORDER BY searched_at DESC`,
    [userId]
  );
  return result.rows;
};

const clearSearchHistoryByUser = async (userId) => {
  await pool.query(`DELETE FROM search_history WHERE user_id = $1`, [userId]);
};

module.exports = {
  createSavedSearch,
  getSavedSearchesByUser,
  deleteSavedSearchById,
  upsertRecentSearch,
  getRecentSearchesByUser,
  deleteRecentSearchById,
  clearRecentSearchesByUser,
  upsertSearchHistory,
  getSearchHistoryByUser,
  clearSearchHistoryByUser,
};
