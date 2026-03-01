// src/repositories/restaurantRepository.js
const pool = require("../config/db");

const createRestaurant = async (data) => {
  const {
    name,
    description,
    cuisine,
    address,
    phone,
    rating,
    openingTime,
    closingTime,
    opening_time: openingTimeRaw,
    closing_time: closingTimeRaw,
    ownerId,
  } = data;
  const openingValue = openingTime || openingTimeRaw || null;
  const closingValue = closingTime || closingTimeRaw || null;
  const result = await pool.query(
    `INSERT INTO restaurants (
      name, description, cuisine, address, opening_time, closing_time, owner_id, is_verified, approval_status
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'pending') RETURNING *`,
    [name, description, cuisine, address, openingValue, closingValue, ownerId]
  );
  const restaurant = result.rows[0];

  await pool.query(
    `INSERT INTO restaurant_table_configs (
      restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person, indoor_capacity, outdoor_capacity
    )
    VALUES ($1, 38, 5, 5, 3, 24, 14)
    ON CONFLICT (restaurant_id) DO NOTHING`,
    [restaurant.id]
  );

  return restaurant;
};

const getAllRestaurants = async () => {
  const result = await pool.query(`
    SELECT *
    FROM restaurants
    WHERE is_verified = true
      AND approval_status = 'approved'
    ORDER BY name
  `);
  return result.rows;
};

const getRestaurantById = async (id) => {
  const result = await pool.query(`
    SELECT *
    FROM restaurants
    WHERE id = $1
      AND is_verified = true
      AND approval_status = 'approved'
  `, [id]);
  return result.rows[0];
};

const updateRestaurant = async (id, data) => {
  const fields = [];
  const values = [];
  let index = 1;
for (const key in data) {
  fields.push(`${key} = $${index}`);

  // ✅ FIX: stringify menu JSON before saving
  if (key === "menu_sections" || key === "menu") {
    values.push(JSON.stringify(data[key]));
  } else {
    values.push(data[key]);
  }

  index++;
}

  values.push(id);
  const result = await pool.query(
    `UPDATE restaurants SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
};

const getRestaurantByOwnerId = async (ownerId) => {
  const result = await pool.query(`SELECT * FROM restaurants WHERE owner_id = $1 LIMIT 1`, [ownerId]);
  return result.rows[0] || null;
};

const getRestaurantByIdAndOwnerId = async (restaurantId, ownerId) => {
  const result = await pool.query(
    `SELECT * FROM restaurants WHERE id = $1 AND owner_id = $2 LIMIT 1`,
    [restaurantId, ownerId]
  );
  return result.rows[0] || null;
};

const deleteRestaurant = async (id) => {
  const result = await pool.query(
    `DELETE FROM restaurants WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

const searchRestaurants = async (query, cuisines = []) => {
  const trimmed = (query || "").trim();
  const cuisineList = Array.isArray(cuisines) ? cuisines : [cuisines].filter(Boolean);

  if (!trimmed && cuisineList.length === 0) {
    const result = await pool.query(`
      SELECT *
      FROM restaurants
      WHERE is_verified = true
        AND approval_status = 'approved'
      ORDER BY name
    `);
    return result.rows;
  }

  const conditions = [
    "is_verified = true",
    "approval_status = 'approved'",
  ];
  const values = [];
  let idx = 1;

  if (trimmed) {
    const searchPattern = `%${trimmed}%`;
    conditions.push(`(name ILIKE $${idx} OR cuisine ILIKE $${idx} OR description ILIKE $${idx})`);
    values.push(searchPattern);
    idx++;
  }

  if (cuisineList.length > 0) {
    conditions.push(`cuisine = ANY($${idx}::text[])`);
    values.push(cuisineList);
    idx++;
  }

  const sql = `SELECT * FROM restaurants WHERE ${conditions.join(" AND ")} ORDER BY name`;
  const result = await pool.query(sql, values);
  return result.rows;
};

const updateRestaurantRating = async (restaurantId, rating) => {
  await pool.query(
    `UPDATE restaurants SET rating = $1, updated_at = NOW() WHERE id = $2`,
    [rating, restaurantId]
  );
};

const getTableConfigByRestaurantId = async (restaurantId) => {
  const result = await pool.query(
    `SELECT id, restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person,
            indoor_capacity, outdoor_capacity, created_at, updated_at
     FROM restaurant_table_configs
     WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const upsertTableConfigByRestaurantId = async (restaurantId, config) => {
  const {
    total_capacity,
    table_2_person,
    table_4_person,
    table_6_person,
    indoor_capacity,
    outdoor_capacity,
  } = config;

  const result = await pool.query(
    `INSERT INTO restaurant_table_configs (
      restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person, indoor_capacity, outdoor_capacity
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (restaurant_id) DO UPDATE
    SET total_capacity = EXCLUDED.total_capacity,
        table_2_person = EXCLUDED.table_2_person,
        table_4_person = EXCLUDED.table_4_person,
        table_6_person = EXCLUDED.table_6_person,
        indoor_capacity = EXCLUDED.indoor_capacity,
        outdoor_capacity = EXCLUDED.outdoor_capacity,
        updated_at = NOW()
    RETURNING id, restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person,
              indoor_capacity, outdoor_capacity, created_at, updated_at`,
    [
      restaurantId,
      total_capacity,
      table_2_person,
      table_4_person,
      table_6_person,
      indoor_capacity,
      outdoor_capacity,
    ]
  );
  return result.rows[0];
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  getRestaurantByIdAndOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
  updateRestaurantRating,
  getTableConfigByRestaurantId,
  upsertTableConfigByRestaurantId,
};
