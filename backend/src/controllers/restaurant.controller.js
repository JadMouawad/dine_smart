// backend/src/controllers/restaurant.controller.js
// Handles HTTP requests for restaurants (Story 7 & 8)
const restaurantService = require("../services/restaurantService");
// GET /restaurants  (Browse list)
const getRestaurants = async (req, res) => {
  try {
    const restaurants = await restaurantService.getAllRestaurants();
    return res.status(200).json(restaurants);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /restaurants/:id  (Basic profile)
const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await restaurantService.getRestaurantById(id);
    return res.status(200).json(restaurant);
  } catch (error) {
    return res.status(500).json({message: error.message });
  }
};
module.exports = {
  getRestaurants,
  getRestaurantById,
};
