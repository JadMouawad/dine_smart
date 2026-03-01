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

// Mount routes
router.use("/search", searchRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/me", profileRoutes); // alias so frontend /api/me works
router.use("/reservations", reservationRoutes);
router.use("/owner", ownerRoutes);

module.exports = router;
