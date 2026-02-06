// backend/src/services/restaurantService.js
// Service layer for restaurants (Story 7 + 8)
const db = require("../config/db");
const RestaurantModel = require("../models/restaurant.model");

//Get all restaurants available (Story 7)

const getAllRestaurants = async () => {
   const result = await RestaurantModel.getAllRestaurants(db);
   return result.rows;
};
// Get only one restaurant by ID (Story 8)

const getRestaurantById = async (id) => {
 const result = await RestaurantModel.getRestaurantById(db, id);
 return result.rows[0] || null;
};

module.exports = {
  getAllRestaurants,
  getRestaurantById,
};