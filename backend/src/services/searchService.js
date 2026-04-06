const restaurantRepository = require("../repositories/restaurantRepository");
const searchRepository = require("../repositories/searchRepository");
const restaurantService = require("./restaurantService");

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const searchRestaurants = async ({ query = "", cuisines = [], filters = {} }) => {
  const trimmedQuery = String(query || "").trim();
  const cuisineList = Array.isArray(cuisines) ? cuisines.filter(Boolean) : [cuisines].filter(Boolean);

  const primaryResults = await restaurantRepository.searchRestaurants(trimmedQuery, cuisineList, filters);
  if (primaryResults.length || !trimmedQuery || cuisineList.length > 0) {
    return primaryResults;
  }

  const fuzzyRestaurant = await restaurantService.findRestaurantByName(trimmedQuery);
  if (!fuzzyRestaurant) {
    return primaryResults;
  }

  return restaurantRepository.searchRestaurants(fuzzyRestaurant.name, cuisineList, filters);
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

// ── Recent Searches ────────────────────────────────────────────────────────

const addRecentSearch = async ({ userId, query }) => {
  const trimmed = String(query || "").trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false, status: 400, error: "Query too short" };
  }
  if (trimmed.length > 255) {
    return { success: false, status: 400, error: "Query too long" };
  }
  await searchRepository.upsertRecentSearch({ userId, query: trimmed });
  return { success: true, status: 200 };
};

const getRecentSearches = async ({ userId }) => {
  const list = await searchRepository.getRecentSearchesByUser(userId);
  return { success: true, status: 200, data: list };
};

const removeRecentSearch = async ({ userId, searchId }) => {
  const parsedId = parsePositiveInt(searchId, null);
  if (!parsedId) return { success: false, status: 400, error: "Invalid ID" };
  await searchRepository.deleteRecentSearchById({ userId, searchId: parsedId });
  return { success: true, status: 200 };
};

const clearRecentSearches = async ({ userId }) => {
  await searchRepository.clearRecentSearchesByUser(userId);
  return { success: true, status: 200 };
};

module.exports = {
  searchRestaurants,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
  clearRecentSearches,
};