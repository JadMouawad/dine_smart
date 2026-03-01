const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const reviewController = require("../controllers/reviewController");
const eventController = require("../controllers/eventController");
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

router.post(
  "/events",
  authenticateToken,
  authorizeRoles("owner"),
  eventController.createOwnerEvent
);

router.get(
  "/events",
  authenticateToken,
  authorizeRoles("owner"),
  eventController.getOwnerEvents
);

router.put(
  "/events/:id",
  authenticateToken,
  authorizeRoles("owner"),
  eventController.updateOwnerEvent
);

router.delete(
  "/events/:id",
  authenticateToken,
  authorizeRoles("owner"),
  eventController.deleteOwnerEvent
);

router.post(
  "/reviews/:id/respond",
  authenticateToken,
  authorizeRoles("owner"),
  reviewController.respondToReviewAsOwner
);

module.exports = router;
