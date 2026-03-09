const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.use(authenticateToken, authorizeRoles("admin"));

router.get("/stats", adminController.getStats);
router.get("/activity", adminController.getRecentActivity);

router.get("/restaurants/pending", adminController.getPendingRestaurants);
router.put("/restaurants/:id/approve", adminController.approveRestaurant);
router.put("/restaurants/:id/reject", adminController.rejectRestaurant);

router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserDetails);
router.put("/users/:id/suspend", adminController.suspendUser);
router.delete("/users/:id", adminController.deleteUser);

router.get("/flagged-reviews", adminController.getFlaggedReviews);
router.put("/flagged-reviews/:id/dismiss", adminController.dismissFlaggedReview);
router.delete("/flagged-reviews/:id", adminController.deleteFlaggedReview);

module.exports = router;

