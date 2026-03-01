// src/routes/index.js
const express = require("express");
const router = express.Router();

// Import your route files
const searchRoutes = require("./searchRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const reservationRoutes = require("./reservationRoutes");
const ownerRoutes = require("./ownerRoutes");
const adminRoutes = require("./adminRoutes");
const eventsRoutes = require("./eventsRoutes");
const discoverRoutes = require("./discoverRoutes");
const reviewModerationRoutes = require("./reviewModerationRoutes");
const requireAuth = require("../middleware/requireAuth");
const profileController = require("../controllers/profileController");

// Mount routes
router.use("/search", searchRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/events", eventsRoutes);
router.use("/discover", discoverRoutes);
router.use("/reviews", reviewModerationRoutes);
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/me", profileRoutes); // alias so frontend /api/me works
router.get("/users/profile", requireAuth, profileController.getProfile);
router.use("/reservations", reservationRoutes);
router.use("/owner", ownerRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
