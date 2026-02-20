// src/controllers/searchController.js
const restaurantService = require("../services/restaurantService");

const searchRestaurants = async (req, res) => {
  try {
    const { query } = req.query;
    const results = await restaurantService.searchRestaurants(query || "");
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { searchRestaurants };
