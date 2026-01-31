// backend/src/services/restaurantService.js
// Service layer for restaurants (Story 7 + 8)

const RestaurantModel = require("../models/restaurant.model");

// NOTE:
// DB isn't wired yet, so these throw for now.
// Once db connection exists, we'll pass `db` into the model functions.

const getAllRestaurants = async () => {
  throw new Error("DB not connected yet");
};

const getRestaurantById = async (id) => {
  throw new Error("DB not connected yet");
};

module.exports = {
  getAllRestaurants,
  getRestaurantById,
};