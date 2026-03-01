const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.get(
  "/restaurants/:id/table-config",
  authenticateToken,
  authorizeRoles("owner"),
  restaurantController.getOwnerRestaurantTableConfig
);

router.post(
  "/restaurants/:id/table-config",
  authenticateToken,
  authorizeRoles("owner"),
  restaurantController.upsertOwnerRestaurantTableConfig
);

module.exports = router;

