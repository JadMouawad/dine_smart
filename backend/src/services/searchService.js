// src/services/searchService.js
const restaurantRepository = require("../repositories/restaurantRepository");

/**
 * Search restaurants by query string
 * Matches name, cuisine, or description
 * @param {string} query
 * @returns {Array} List of restaurant objects
 */
const searchRestaurants = async (query) => {
  if (!query || query.trim() === "") return [];
  const results = await restaurantRepository.searchRestaurants(query);
  return results;
};

module.exports = {
  searchRestaurants,
};
