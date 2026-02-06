const express = require("express");
const router = express.Router();
const {
  getRestaurants,
  getRestaurantById
} = require("../controllers/restaurant.controller");

// Story 7: Browse restaurants
router.get("/", getRestaurants);
// Story 8: View basic restaurant profile
router.get("/:id", getRestaurantById);

module.exports = router;
