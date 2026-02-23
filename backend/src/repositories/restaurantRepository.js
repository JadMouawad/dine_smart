// src/repositories/restaurantRepository.js
const pool = require("../config/db");

const createRestaurant = async (data) => {
  const { name, description, cuisine, address, openingTime, closingTime, ownerId } = data;
  const result = await pool.query(
    `INSERT INTO restaurants (name, description, cuisine, address, opening_time, closing_time, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, description, cuisine, address, openingTime || null, closingTime || null, ownerId]
  );
  return result.rows[0];
};

const getAllRestaurants = async () => {
  const result = await pool.query(`SELECT * FROM restaurants`);
  return result.rows;
};

const getRestaurantById = async (id) => {
  const result = await pool.query(`SELECT * FROM restaurants WHERE id = $1`, [id]);
  return result.rows[0];
};

const updateRestaurant = async (id, data) => {
  const allowedKeys = [
    "name", "description", "cuisine", "address", "phone",
    "opening_time", "closing_time", "menu_sections"
  ];
  const fields = [];
  const values = [];
  let index = 1;

  for (const key of allowedKeys) {
    if (!(key in data)) continue;
    fields.push(`${key} = $${index}`);
    const val = data[key];
    values.push(key === "menu_sections" && (Array.isArray(val) || typeof val === "object")
      ? JSON.stringify(val)
      : val);
    index++;
  }

  if (fields.length === 0) return await getRestaurantById(id);

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
    const result = await pool.query(`SELECT * FROM restaurants ORDER BY name`);
    return result.rows;
  }

  const conditions = [];
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

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
  updateRestaurantRating,
};
