const pool = require("../config/db");

const getOwnerUpdates = async ({ ownerId }) => {
  const result = await pool.query(
    `
      SELECT
        ru.id,
        ru.restaurant_id,
        r.name AS restaurant_name,
        ru.update_type,
        ru.title,
        ru.message,
        ru.created_at
      FROM restaurant_updates ru
      JOIN restaurants r ON r.id = ru.restaurant_id
      WHERE r.owner_id = $1
      ORDER BY ru.created_at DESC
    `,
    [ownerId]
  );
  return result.rows;
};

const createOwnerUpdate = async ({ restaurantId, updateType, title, message }) => {
  const result = await pool.query(
    `
      INSERT INTO restaurant_updates (restaurant_id, update_type, title, message)
      VALUES ($1, $2, $3, $4)
      RETURNING id, restaurant_id, update_type, title, message, created_at
    `,
    [restaurantId, updateType, title, message]
  );
  return result.rows[0] || null;
};

module.exports = {
  getOwnerUpdates,
  createOwnerUpdate,
};
