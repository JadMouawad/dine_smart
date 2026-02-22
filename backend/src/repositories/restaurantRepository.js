// src/repositories/restaurantRepository.js
const pool = require("../config/db");

const createRestaurant = async (data) => {
  const { name, description, cuisine, address, ownerId } = data;
  const result = await pool.query(
    `INSERT INTO restaurants (name, description, cuisine, address, owner_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, description, cuisine, address, ownerId]
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
  const fields = [];
  const values = [];
  let index = 1;

  for (const key in data) {
    fields.push(`${key} = $${index}`);
    values.push(data[key]);
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

const deleteRestaurant = async (id) => {
  const result = await pool.query(
    `DELETE FROM restaurants WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

const searchRestaurants = async (query) => {
  const searchQuery = `%${query}%`;
  const result = await pool.query(
    `SELECT * FROM restaurants WHERE name ILIKE $1 OR cuisine ILIKE $1 OR description ILIKE $1`,
    [searchQuery]
  );
  return result.rows;
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
};
