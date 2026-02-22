// src/routes/index.js
const express = require("express");
const router = express.Router();

// Import your route files
const searchRoutes = require("./searchRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");

// Mount routes
router.use("/search", searchRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/me", profileRoutes); // alias so frontend /api/me works

module.exports = router;
