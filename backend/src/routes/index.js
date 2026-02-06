const express = require("express");
const restaurantRoutes = require("./restaurant.routes");
const userRoutes = require("./user.routes");

const router = express.Router();

router.use("/restaurants", restaurantRoutes);
router.use("/", userRoutes);

// Future route modules (e.g., auth) can be mounted here.
module.exports = router;
