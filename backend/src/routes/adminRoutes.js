const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.use(authenticateToken, authorizeRoles("admin"));

router.get("/stats", adminController.getStats);
router.get("/activity", adminController.getRecentActivity);
router.get("/ai/logs", adminController.getRecentAiLogs);
router.get("/ai/settings", adminController.getAiSettings);
router.put("/ai/settings", adminController.updateAiSettings);

router.get("/restaurants/pending", adminController.getPendingRestaurants);
router.put("/restaurants/:id/approve", adminController.approveRestaurant);
router.put("/restaurants/:id/reject", adminController.rejectRestaurant);

router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserDetails);
router.put("/users/:id/suspend", adminController.suspendUser);
router.delete("/users/:id", adminController.deleteUser);

router.get("/flagged-reviews", adminController.getFlaggedReviews);
router.put("/flagged-reviews/bulk-action", adminController.bulkModerateFlaggedReviews);
router.put("/flagged-reviews/:id/action", adminController.moderateFlaggedReview);
router.put("/flagged-reviews/:id/dismiss", adminController.dismissFlaggedReview);
router.delete("/flagged-reviews/:id", adminController.deleteFlaggedReview);

router.post("/updates/send", adminController.sendSubscriptionUpdate);

router.get("/restaurants/health-certificates", adminController.getRestaurantsWithHealthCertificates);
router.put("/restaurants/:id/verify", adminController.verifyRestaurant);
router.put("/restaurants/:id/unverify", adminController.unverifyRestaurant);

router.get("/export/csv", adminController.exportStatsCsv);

router.get("/restaurants/deletion-requests", adminController.getPendingDeletionRestaurants);
router.post("/restaurants/:id/deletion-requests/approve", adminController.approveRestaurantDeletion);
router.post("/restaurants/:id/deletion-requests/reject", adminController.rejectRestaurantDeletion);

module.exports = router;

