// backend/src/routes/user.routes.js

const express = require("express");
const router = express.Router();
const auth = require("../middleware/requireAuth");
const controller = require("../controllers/authController");

// Get current user
router.get("/me", auth, controller.me);

module.exports = router;
