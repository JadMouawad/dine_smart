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

// GET /api/restaurants/mine — returns the restaurant owned by the logged-in owner
const getMyRestaurant = async (req, res) => {
  try {
    const restaurant = await restaurantService.getRestaurantByOwnerId(req.user.id);
    if (!restaurant) return res.status(404).json({ message: "No restaurant found" });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/restaurants/mine — update the restaurant owned by the logged-in owner
const updateMyRestaurant = async (req, res) => {
  try {
    const restaurant = await restaurantService.getRestaurantByOwnerId(req.user.id);
    if (!restaurant) return res.status(404).json({ message: "No restaurant found" });
    if (restaurant.approval_status !== "approved") {
      return res.status(403).json({
        message: "Restaurant pending approval. Profile updates are locked until approval.",
      });
    }

    const updated = await restaurantService.updateRestaurant(restaurant.id, {
      ...req.body,
    });
    res.json(updated);
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

const TABLE_CONFIG_KEYS = [
  "total_capacity",
  "table_2_person",
  "table_4_person",
  "table_6_person",
  "indoor_capacity",
  "outdoor_capacity",
];

const parseTableConfigPayload = (payload) => {
  const parsed = {};
  for (const key of TABLE_CONFIG_KEYS) {
    if (payload[key] == null || payload[key] === "") {
      return { error: `${key} is required` };
    }
    const value = parseInt(payload[key], 10);
    if (Number.isNaN(value)) {
      return { error: `${key} must be a number` };
    }
    if (key === "total_capacity" && value <= 0) {
      return { error: "total_capacity must be greater than 0" };
    }
    if (key !== "total_capacity" && value < 0) {
      return { error: `${key} cannot be negative` };
    }
    parsed[key] = value;
  }

  if (parsed.indoor_capacity + parsed.outdoor_capacity > parsed.total_capacity) {
    return { error: "indoor_capacity and outdoor_capacity cannot exceed total_capacity" };
  }

  return { parsed };
};

const getOwnerRestaurantTableConfig = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id, 10);
    if (Number.isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const ownedRestaurant = await restaurantService.getRestaurantByIdAndOwnerId(restaurantId, req.user.id);
    if (!ownedRestaurant) {
      return res.status(403).json({ message: "Forbidden: You can only manage your own restaurant" });
    }

    const config = await restaurantService.getTableConfigByRestaurantId(restaurantId);
    if (!config) {
      return res.status(404).json({ message: "Table configuration not found" });
    }

    return res.status(200).json(config);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const upsertOwnerRestaurantTableConfig = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id, 10);
    if (Number.isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const ownedRestaurant = await restaurantService.getRestaurantByIdAndOwnerId(restaurantId, req.user.id);
    if (!ownedRestaurant) {
      return res.status(403).json({ message: "Forbidden: You can only manage your own restaurant" });
    }

    const { parsed, error } = parseTableConfigPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const saved = await restaurantService.upsertTableConfigByRestaurantId(restaurantId, parsed);
    return res.status(200).json(saved);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurant,
  getMyRestaurant,
  updateMyRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getOwnerRestaurantTableConfig,
  upsertOwnerRestaurantTableConfig,
};
