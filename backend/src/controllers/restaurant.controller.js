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
  const restaurant = await restaurantService.getRestaurantById(req.params.id);
    if (!restaurant) {
    return res.status(404).json({ message: "Restaurant not found" });
    }
  } catch (error) {
    return res.status(500).json({message: error.message });
  }
};
module.exports = {
  getRestaurants,
  getRestaurantById,
};
