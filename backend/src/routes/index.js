const express = require("express");
const restaurantRoutes = require("./restaurant.routes");
const authRoutes = require("./authRoutes");

const router = express.Router();

// Auth routes
router.use("/auth", authRoutes);

// Restaurant routes
router.use("/restaurants", restaurantRoutes);

// Future route modules can be mounted here.
module.exports = router;
