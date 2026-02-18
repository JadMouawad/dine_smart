const express = require("express");
const router = express.Router();
const {
  getRestaurants,
  getRestaurantById,
} = require("../controllers/restaurant.controller");
const reviewRoutes = require("./review.routes");

// Reviews nested under /restaurants/:restaurantId/reviews (must be before /:id)
router.use("/:restaurantId/reviews", reviewRoutes);

// Story 7: Browse restaurants
router.get("/", getRestaurants);
// Story 8: View basic restaurant profile
router.get("/:id", getRestaurantById);

module.exports = router;
