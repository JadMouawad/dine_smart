// backend/src/models/restaurant.model.js

// NOTE: This model is DB-ready.
// Once the database connection module exists, import it and use it here.

// Example later:
// const db = require("../config/db");

async function getAllRestaurants(db) {
  // Returns all restaurants (for Browse list)
  const query = `
    SELECT id, name, cuisine, address, rating
    FROM restaurants
    ORDER BY id ASC;
  `;
  return db.query(query);
}

async function getRestaurantById(db, id) {
  // Returns one restaurant (for Profile page)
  const query = `
    SELECT id, name, cuisine, address, rating
    FROM restaurants
    WHERE id = $1;
  `;
  return db.query(query, [id]);
}
git branch
module.exports = {
  getAllRestaurants,
  getRestaurantById,
};
