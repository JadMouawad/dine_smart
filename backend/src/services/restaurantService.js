// src/services/restaurantService.js
const restaurantRepository = require("../repositories/restaurantRepository");

const createRestaurant = async (data) => {
  return await restaurantRepository.createRestaurant(data);
};

const getAllRestaurants = async () => {
  return await restaurantRepository.getAllRestaurants();
};

const getRestaurantById = async (id) => {
  return await restaurantRepository.getRestaurantById(id);
};

const getRestaurantByOwnerId = async (ownerId) => {
  return await restaurantRepository.getRestaurantByOwnerId(ownerId);
};

const getRestaurantByIdAndOwnerId = async (restaurantId, ownerId) => {
  return await restaurantRepository.getRestaurantByIdAndOwnerId(restaurantId, ownerId);
};

const updateRestaurant = async (id, data) => {
  return await restaurantRepository.updateRestaurant(id, data);
};

const deleteRestaurant = async (id) => {
  return await restaurantRepository.deleteRestaurant(id);
};

const searchRestaurants = async (query, cuisines, filters = {}) => {
  return await restaurantRepository.searchRestaurants(query || "", cuisines, filters);
};

const getTableConfigByRestaurantId = async (restaurantId) => {
  return await restaurantRepository.getTableConfigByRestaurantId(restaurantId);
};

const upsertTableConfigByRestaurantId = async (restaurantId, config) => {
  return await restaurantRepository.upsertTableConfigByRestaurantId(restaurantId, config);
};

const restaurantNameCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const findRestaurantByName = async (name) => {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return null;

  const cached = restaurantNameCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const restaurant = await restaurantRepository.findRestaurantByName(name);

  restaurantNameCache.set(key, {
    value: restaurant,
    timestamp: Date.now()
  });

  return restaurant;
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  getRestaurantByIdAndOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
  getTableConfigByRestaurantId,
  upsertTableConfigByRestaurantId,
  findRestaurantByName,
};
