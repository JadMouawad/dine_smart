const restaurantRepository = require("../repositories/restaurantRepository");
const searchRepository = require("../repositories/searchRepository");

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const searchRestaurants = async ({ query = "", cuisines = [], filters = {} }) => {
  return restaurantRepository.searchRestaurants(query, cuisines, filters);
};

const saveSearch = async ({ userId, name, filters }) => {
  const safeName = String(name || "").trim();
  if (!safeName) {
    return { success: false, status: 400, error: "name is required" };
  }
  if (safeName.length > 120) {
    return { success: false, status: 400, error: "name must be at most 120 characters" };
  }
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return { success: false, status: 400, error: "filters must be an object" };
  }

  const created = await searchRepository.createSavedSearch({
    userId,
    name: safeName,
    filtersJson: filters,
  });

  return { success: true, status: 201, data: created };
};

const getSavedSearches = async ({ userId }) => {
  const list = await searchRepository.getSavedSearchesByUser(userId);
  return { success: true, status: 200, data: list };
};

const deleteSavedSearch = async ({ userId, savedSearchId }) => {
  const parsedId = parsePositiveInt(savedSearchId, null);
  if (!parsedId) {
    return { success: false, status: 400, error: "Invalid saved search ID" };
  }

  const deleted = await searchRepository.deleteSavedSearchById({
    userId,
    savedSearchId: parsedId,
  });

  if (!deleted) {
    return { success: false, status: 404, error: "Saved search not found" };
  }

  return { success: true, status: 200, data: deleted };
};

module.exports = {
  searchRestaurants,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
};
