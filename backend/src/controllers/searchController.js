// src/controllers/searchController.js
const restaurantService = require("../services/restaurantService");

const searchRestaurants = async (req, res) => {
  try {
    const { query, cuisine } = req.query;
    const cuisines = cuisine != null
      ? String(cuisine).split(",").map((c) => c.trim()).filter(Boolean)
      : [];
    const results = await restaurantService.searchRestaurants(query || "", cuisines);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { searchRestaurants };
