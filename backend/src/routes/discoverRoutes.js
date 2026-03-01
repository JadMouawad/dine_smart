const express = require("express");
const router = express.Router();
const discoverController = require("../controllers/discoverController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.get("/", authenticateToken, authorizeRoles("user"), discoverController.getDiscoverFeed);

module.exports = router;
