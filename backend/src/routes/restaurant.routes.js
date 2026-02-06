// backend/src/routes/restaurant.routes.js

const express = require("express");
const router = express.Router();
const {
  getRestaurants,
  getRestaurantById,
} = require("../controllers/restaurant.controller");

// Story 7: Browse restaurants
router.get("/restaurants", getRestaurants);
// Story 8: View basic restaurant profile
router.get("/restaurants/:id", getRestaurantById);

module.exports = router;
