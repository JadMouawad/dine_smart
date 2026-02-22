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

const updateRestaurant = async (id, data) => {
  return await restaurantRepository.updateRestaurant(id, data);
};

const deleteRestaurant = async (id) => {
  return await restaurantRepository.deleteRestaurant(id);
};

const searchRestaurants = async (query) => {
  return await restaurantRepository.searchRestaurants(query);
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
};
