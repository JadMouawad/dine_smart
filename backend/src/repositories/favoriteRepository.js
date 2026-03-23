const pool = require("../config/db");

/**
 * Get all favorites for a user (returns full restaurant rows)
 */
const getFavoritesByUserId = async (userId) => {
  const result = await pool.query(
    `
      SELECT
        r.id,
        r.name,
        r.cuisine,
        r.price_range,
        r.rating,
        r.cover_url,
        r.logo_url,
        r.address
      FROM user_favorites uf
      JOIN restaurants r ON r.id = uf.restaurant_id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC
    `,
    [userId]
  );
  return result.rows;
};

/**
 * Add a favorite (idempotent — ON CONFLICT DO NOTHING)
 */
const addFavorite = async (userId, restaurantId) => {
  await pool.query(
    `INSERT INTO user_favorites (user_id, restaurant_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, restaurantId]
  );
};

/**
 * Remove a favorite
 */
const removeFavorite = async (userId, restaurantId) => {
  await pool.query(
    `DELETE FROM user_favorites WHERE user_id = $1 AND restaurant_id = $2`,
    [userId, restaurantId]
  );
};

/**
 * Get all favorited restaurant IDs for a user (lightweight check)
 */
const getFavoriteIdsByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT restaurant_id FROM user_favorites WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map((row) => row.restaurant_id);
};

module.exports = {
  getFavoritesByUserId,
  addFavorite,
  removeFavorite,
  getFavoriteIdsByUserId,
};
