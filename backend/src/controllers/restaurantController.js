// src/controllers/restaurantController.js
const restaurantService = require("../services/restaurantService");

const createRestaurant = async (req, res) => {
  try {
    const data = { ...req.body, ownerId: req.user.id };
    const restaurant = await restaurantService.createRestaurant(data);
    res.status(201).json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await restaurantService.getAllRestaurants();
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getRestaurant = async (req, res) => {
  try {
    const restaurant = await restaurantService.getRestaurantById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateRestaurant = async (req, res) => {
  try {
    const updated = await restaurantService.updateRestaurant(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteRestaurant = async (req, res) => {
  try {
    const deleted = await restaurantService.deleteRestaurant(req.params.id);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
};
